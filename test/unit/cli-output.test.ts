import { describe, it, expect } from "vitest";
import { join } from "path";
import type { Stats } from "fs";
import { shouldPrintBanner } from "../../src/cli/banner.js";
import { createWatchFilter } from "../../src/cli/watch-filter.js";
import { escapeData, escapeProperty, formatGitHubAnnotations } from "../../src/cli/output/github.js";
import { JsonOutput } from "../../src/cli/output/json.js";
import type { DiagnosticResult, VerdictType } from "../../src/core/types.js";

function result(type: VerdictType, testFile: string, reasoning = "reason"): DiagnosticResult {
  return {
    testName: "testSomething",
    testFile,
    confidence: 0.8999999999999999,
    reasoning,
    suggestions: [],
    verdict: {
      type,
      confidence: 0.8999999999999999,
      reason: "r",
      explanation: "e",
      recommendation: { action: "FIX_CODE", description: "d", affectedFiles: [], priority: "HIGH" },
    },
  } as DiagnosticResult;
}

describe("shouldPrintBanner", () => {
  it("prints for interactive console output", () => {
    expect(shouldPrintBanner(["analyze", "."], true)).toBe(true);
    expect(shouldPrintBanner(["analyze", "--format", "console"], true)).toBe(true);
  });

  it("skips machine-readable formats in both option syntaxes", () => {
    expect(shouldPrintBanner(["analyze", "--format", "json"], true)).toBe(false);
    expect(shouldPrintBanner(["analyze", "--format=github"], true)).toBe(false);
    expect(shouldPrintBanner(["suggest", "--format=markdown"], true)).toBe(false);
  });

  it("skips when stdout is not a terminal", () => {
    expect(shouldPrintBanner(["analyze"], false)).toBe(false);
    expect(shouldPrintBanner(["analyze"], undefined)).toBe(false);
  });
});

describe("createWatchFilter", () => {
  const root = join("/work", "build", "project");
  const file = { isFile: () => true } as Stats;
  const dir = { isFile: () => false } as Stats;
  const ignored = createWatchFilter(root);

  it("watches supported source files even when the project lives under build/", () => {
    expect(ignored(join(root, "src", "Calc.java"), file)).toBe(false);
    expect(ignored(join(root, "app.test.ts"), file)).toBe(false);
    expect(ignored(root, dir)).toBe(false);
    expect(ignored(join(root, "src"), dir)).toBe(false);
  });

  it("ignores dependency and build directories inside the project", () => {
    expect(ignored(join(root, "node_modules"))).toBe(true);
    expect(ignored(join(root, "target", "classes", "A.java"), file)).toBe(true);
    expect(ignored(join(root, ".git", "HEAD"), file)).toBe(true);
  });

  it("ignores unsupported files and declaration files", () => {
    expect(ignored(join(root, "README.md"), file)).toBe(true);
    expect(ignored(join(root, "types.d.ts"), file)).toBe(true);
  });
});

describe("GitHub annotations", () => {
  it("escapes workflow command data and properties", () => {
    expect(escapeData("50% off\nline2\r")).toBe("50%25 off%0Aline2%0D");
    expect(escapeProperty("C:\\a,b")).toBe("C%3A\\a%2Cb");
  });

  it("emits one annotation per result with relative paths and a summary", () => {
    const cwd = join("/repo");
    const lines = formatGitHubAnnotations(
      [
        result("CODE_BUG", join(cwd, "src", "FooTest.java"), "first\nsecond"),
        result("OUTDATED_TEST", join(cwd, "BarTest.java")),
      ],
      cwd
    );
    expect(lines).toEqual([
      "::error file=src/FooTest.java::CODE_BUG: first%0Asecond",
      "::warning file=BarTest.java::OUTDATED_TEST: reason",
      "::notice::Hambugsy found 1 code bug(s) and 1 test issue(s)",
    ]);
  });
});

describe("JsonOutput", () => {
  it("rounds confidences and counts verdicts", () => {
    const parsed = JSON.parse(
      new JsonOutput().formatResults([
        result("CODE_BUG", "a"),
        result("FLAKY_TEST", "b"),
        result("OUTDATED_TEST", "c"),
        result("PASSED", "d"),
        result("ENVIRONMENT_ISSUE", "e"),
      ])
    );
    expect(parsed.results[0].confidence).toBe(0.9);
    expect(parsed.results[0].verdict.confidence).toBe(0.9);
    expect(parsed.summary).toEqual({ total: 5, testIssues: 2, codeBugs: 1, passed: 1, environmentIssues: 1 });
  });
});
