import type { TestFailure, Verdict } from "../core/types.js";

export class VerdictEngine {
  analyze(failure: TestFailure): Verdict {
    // TODO: Implement verdict logic based on:
    // - Stack trace analysis
    // - Recent git changes
    // - Error message patterns
    // - Test vs source code modifications

    const reasoning = this.buildReasoning(failure);

    return {
      type: "ENVIRONMENT_ISSUE",
      confidence: 0,
      reason: reasoning,
      explanation: "Unable to determine the cause of the failure.",
      recommendation: {
        action: "INVESTIGATE",
        description: "Manual investigation required",
        affectedFiles: failure.sourceFile ? [failure.sourceFile] : [],
        priority: "MEDIUM",
      },
    };
  }

  private buildReasoning(failure: TestFailure): string {
    const parts: string[] = [];

    if (failure.errorMessage) {
      parts.push(`Error: ${failure.errorMessage}`);
    }

    if (failure.sourceFile && failure.sourceLine) {
      parts.push(`Location: ${failure.sourceFile}:${failure.sourceLine}`);
    }

    return parts.join("\n") || "Insufficient data for analysis";
  }
}
