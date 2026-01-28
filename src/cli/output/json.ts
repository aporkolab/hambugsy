import type { DiagnosticResult } from "../../core/types.js";

/**
 * Round confidence values to avoid floating-point precision issues (e.g., 0.8999999999999999 -> 0.9)
 */
function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sanitize a diagnostic result for JSON output, rounding confidence values
 */
function sanitizeResult(result: DiagnosticResult): DiagnosticResult {
  return {
    ...result,
    confidence: roundConfidence(result.confidence),
    verdict: {
      ...result.verdict,
      confidence: roundConfidence(result.verdict.confidence),
    },
  };
}

export class JsonOutput {
  formatResult(result: DiagnosticResult): string {
    return JSON.stringify(sanitizeResult(result), null, 2);
  }

  formatResults(results: DiagnosticResult[]): string {
    const sanitizedResults = results.map(sanitizeResult);

    return JSON.stringify(
      {
        results: sanitizedResults,
        summary: {
          total: sanitizedResults.length,
          testIssues: sanitizedResults.filter(
            (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
          ).length,
          codeBugs: sanitizedResults.filter((r) => r.verdict.type === "CODE_BUG").length,
          passed: sanitizedResults.filter((r) => r.verdict.type === "PASSED").length,
          environmentIssues: sanitizedResults.filter((r) => r.verdict.type === "ENVIRONMENT_ISSUE").length,
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
