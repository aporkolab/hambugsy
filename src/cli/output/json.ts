import type { AnalysisResult } from "../../core/types.js";

export class JsonOutput {
  formatResult(result: AnalysisResult): string {
    return JSON.stringify(result, null, 2);
  }

  formatResults(results: AnalysisResult[]): string {
    return JSON.stringify(
      {
        results,
        summary: {
          total: results.length,
          testBugs: results.filter((r) => r.verdict === "test").length,
          codeBugs: results.filter((r) => r.verdict === "code").length,
          unknown: results.filter((r) => r.verdict === "unknown").length,
        },
      },
      null,
      2
    );
  }

  print(results: AnalysisResult[]): void {
    console.log(this.formatResults(results));
  }
}
