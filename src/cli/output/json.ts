import type { DiagnosticResult } from "../../core/types.js";

export class JsonOutput {
  formatResult(result: DiagnosticResult): string {
    return JSON.stringify(result, null, 2);
  }

  formatResults(results: DiagnosticResult[]): string {
    return JSON.stringify(
      {
        results,
        summary: {
          total: results.length,
          testIssues: results.filter(
            (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
          ).length,
          codeBugs: results.filter((r) => r.verdict.type === "CODE_BUG").length,
          passed: results.filter((r) => r.verdict.type === "PASSED").length,
          environmentIssues: results.filter((r) => r.verdict.type === "ENVIRONMENT_ISSUE").length,
        },
      },
      null,
      2
    );
  }

  print(results: DiagnosticResult[]): void {
    console.log(this.formatResults(results));
  }
}
