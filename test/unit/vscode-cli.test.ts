import { describe, it, expect } from "vitest";
import {
  buildCliInvocation,
  escapeHtml,
  extractSuggestions,
  parseCliJson,
  summarizeResults,
} from "../../vscode-extension/src/cli.js";

describe("VS Code extension CLI bridge", () => {
  describe("buildCliInvocation", () => {
    const hostilePath = '/tmp/$(touch pwned)/a "b".java';

    it("passes arguments without a shell on POSIX", () => {
      expect(buildCliInvocation(["analyze", hostilePath], "linux")).toEqual({
        command: "npx",
        args: ["hambugsy", "analyze", hostilePath],
        shell: false,
      });
    });

    it("quotes every argument for cmd on Windows", () => {
      const invocation = buildCliInvocation(["analyze", "C:\\My Project & Co"], "win32");
      expect(invocation.command).toBe("npx.cmd");
      expect(invocation.shell).toBe(true);
      expect(invocation.args).toEqual(['"hambugsy"', '"analyze"', '"C:\\My Project & Co"']);
    });

    it.each(["%TEMP%", "!TEMP!", 'a"b', "a\rb", "a\nb"])(
      "rejects cmd expansion or quote characters on Windows: %s",
      (part) => {
        expect(() => buildCliInvocation(["analyze", `C:\\${part}\\test.java`], "win32"))
          .toThrow(/Windows CLI paths/);
      }
    );
  });

  describe("parseCliJson", () => {
    it("parses a report even when the CLI exited with 1 (bugs found)", () => {
      expect(parseCliJson<{ results: unknown[] }>({ stdout: '{"results":[]}', stderr: "", exitCode: 1 })).toEqual({
        results: [],
      });
    });

    it("explains non-JSON output with the tail of stderr", () => {
      expect(() => parseCliJson({ stdout: "", stderr: "boom\nreal cause", exitCode: 2 })).toThrow(
        /exit code 2[\s\S]*real cause/
      );
    });
  });

  it("summarizes verdict counts from results", () => {
    const results = ["CODE_BUG", "CODE_BUG", "OUTDATED_TEST", "FLAKY_TEST", "PASSED"].map((type) => ({
      verdict: { type: type as "CODE_BUG" },
    }));
    expect(summarizeResults(results)).toEqual({
      codeBugs: 2,
      outdatedTests: 1,
      flakyTests: 1,
      environmentIssues: 0,
      passed: 1,
    });
  });

  it("flattens suggestions from the suggest report", () => {
    const suggestion = { methodName: "m", filePath: "F.java", lineNumber: 3, priority: "HIGH", rationale: "r" };
    expect(
      extractSuggestions({ coverageByMethod: [{ suggestions: [suggestion] }, { suggestions: [] }, {}] })
    ).toEqual([suggestion]);
    expect(extractSuggestions(null)).toEqual([]);
    expect(extractSuggestions({ suggestions: [suggestion] })).toEqual([]);
  });

  it("escapes HTML for the details webview", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;"
    );
    expect(escapeHtml(undefined)).toBe("");
  });
});
