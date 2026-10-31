import { describe, it, expect } from "vitest";
import { GitError, GitService, type Commit } from "../../src/services/git.js";
import { VerdictEngine } from "../../src/verdict/engine.js";
import type { CopilotBridge } from "../../src/services/copilot.js";
import type { AnalysisResult } from "../../src/core/types.js";

function commit(message: string, date: string): Commit {
  return { hash: "abc123", author: "dev", date: new Date(date), message };
}

/** GitService with canned history, so no git process is spawned. */
class FakeGit extends GitService {
  constructor(private readonly history: Record<string, Commit[]> | Error) {
    super();
  }
  override async getHistory(filePath: string): Promise<Commit[]> {
    if (this.history instanceof Error) throw this.history;
    return this.history[filePath] ?? [];
  }
}

function analysis(lastCodeChange: Commit | null): AnalysisResult {
  return {
    pair: {
      test: { name: "testDiscount", filePath: "/p/OrderServiceTest.java", lineNumber: 10 },
      source: { name: "discount", filePath: "/p/OrderService.java", lineNumber: 5 },
      confidence: 0.9,
      correlationType: "NAMING_CONVENTION",
    },
    testExpectation: {} as AnalysisResult["testExpectation"],
    codeBehavior: {} as AnalysisResult["codeBehavior"],
    divergence: {
      type: "RETURN_VALUE_MISMATCH",
      description: "expected 90 got 85",
      testLine: 10,
      codeLine: 5,
      expected: "90",
      actual: "85",
    },
    gitContext: { lastTestChange: null, lastCodeChange, recentCommits: [], blame: null },
  } as unknown as AnalysisResult;
}

describe("GitService.isIntentionalChange", () => {
  const git = new GitService();

  it("treats conventional feature/refactor commits as intentional", () => {
    expect(git.isIntentionalChange("feat: new discount policy")).toBe(true);
    expect(git.isIntentionalChange("refactor(order): simplify")).toBe(true);
  });

  it("recognises ticket keys although the message is lowercased", () => {
    expect(git.isIntentionalChange("PROJ-123 adjust premium discount")).toBe(true);
  });

  it("treats fixes, typos and reverts as unintentional", () => {
    expect(git.isIntentionalChange("fix: rounding")).toBe(false);
    expect(git.isIntentionalChange("oops, wrong constant")).toBe(false);
    expect(git.isIntentionalChange("Revert \"feat: x\"")).toBe(false);
  });

  it("defaults to intentional when no pattern matches", () => {
    expect(git.isIntentionalChange("random message")).toBe(true);
  });
});

describe("GitService.compareLastModification", () => {
  it("returns the more recently changed file", async () => {
    const git = new FakeGit({
      "a.java": [commit("x", "2026-01-02T00:00:00Z")],
      "b.java": [commit("y", "2026-01-01T00:00:00Z")],
    });
    expect((await git.compareLastModification("a.java", "b.java")).moreRecent).toBe("a.java");
    expect((await git.compareLastModification("b.java", "a.java")).moreRecent).toBe("a.java");
  });

  it("reports neither file when both changed in the same commit", async () => {
    const same = [commit("feat: both", "2026-01-01T00:00:00Z")];
    const git = new FakeGit({ "a.java": same, "b.java": same });
    expect((await git.compareLastModification("a.java", "b.java")).moreRecent).toBe("");
  });

  it("reports neither file for inline tests in the same file", async () => {
    const git = new FakeGit({ "lib.rs": [commit("x", "2026-01-01T00:00:00Z")] });
    expect((await git.compareLastModification("lib.rs", "lib.rs")).moreRecent).toBe("");
  });

  it("falls back to the only file with history", async () => {
    const git = new FakeGit({ "b.java": [commit("y", "2026-01-01T00:00:00Z")] });
    expect((await git.compareLastModification("a.java", "b.java")).moreRecent).toBe("b.java");
  });
});

describe("VerdictEngine.determine", () => {
  const copilot = {} as CopilotBridge;

  it("passes when there is no divergence", async () => {
    const engine = new VerdictEngine(copilot, new FakeGit({}));
    const verdict = await engine.determine({ ...analysis(null), divergence: null });
    expect(verdict.type).toBe("PASSED");
  });

  it("still returns a verdict outside a git repository", async () => {
    const engine = new VerdictEngine(copilot, new FakeGit(new GitError("not a git repository", true)));
    const verdict = await engine.determine(analysis(null));
    expect(verdict.type).toBe("CODE_BUG");
  });

  it("calls the test outdated when newer code came from an intentional commit", async () => {
    const codeCommit = commit("feat: lower premium discount", "2026-02-01T00:00:00Z");
    const engine = new VerdictEngine(
      copilot,
      new FakeGit({
        "/p/OrderService.java": [codeCommit],
        "/p/OrderServiceTest.java": [commit("test: add", "2026-01-01T00:00:00Z")],
      })
    );
    expect((await engine.determine(analysis(codeCommit))).type).toBe("OUTDATED_TEST");
  });

  it("calls it a code bug when newer code came from an unintentional commit", async () => {
    const codeCommit = commit("oops quick change", "2026-02-01T00:00:00Z");
    const engine = new VerdictEngine(
      copilot,
      new FakeGit({
        "/p/OrderService.java": [codeCommit],
        "/p/OrderServiceTest.java": [commit("test: add", "2026-01-01T00:00:00Z")],
      })
    );
    expect((await engine.determine(analysis(codeCommit))).type).toBe("CODE_BUG");
  });

  it("never reports full certainty", () => {
    const engine = new VerdictEngine(copilot, new FakeGit({}));
    const confidence = engine.calculateConfidence(analysis(commit("feat: PROJ-1 x", "2026-01-01")), "CODE_BUG");
    expect(confidence).toBeGreaterThan(0.5);
    expect(confidence).toBeLessThan(1);
  });
});
