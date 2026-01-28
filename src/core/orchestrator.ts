import type { DiagnosticResult, TestFailure, HambugsyConfig, Verdict } from "./types.js";

/**
 * Orchestrator provides a high-level interface for coordinating test failure analysis.
 *
 * Note: The primary analysis logic is implemented in the CLI commands (analyze.ts, fix.ts)
 * which provide more granular control over the analysis pipeline. This class serves as
 * a simplified entry point for programmatic usage and future API integration.
 *
 * For full-featured analysis, use the CLI commands directly or the VerdictEngine.
 */
export class Orchestrator {
  private config: HambugsyConfig;

  constructor(config: HambugsyConfig) {
    this.config = config;
  }

  /**
   * Analyze test failures and return diagnostic results.
   *
   * This method provides a basic analysis for each failure. For advanced analysis
   * including AI-powered divergence detection and git history analysis, use the
   * CLI analyze command or the VerdictEngine directly.
   */
  async analyze(failures: TestFailure[]): Promise<DiagnosticResult[]> {
    return failures.map((failure) => {
      const verdict: Verdict = {
        type: "ENVIRONMENT_ISSUE",
        confidence: 0.5,
        reason: "Requires detailed analysis",
        explanation: "Use the CLI analyze command for full AI-powered analysis with git history and divergence detection.",
        recommendation: {
          action: "INVESTIGATE",
          description: "Run 'hambugsy analyze' for detailed diagnostics",
          affectedFiles: [failure.testFile],
          priority: "MEDIUM",
        },
      };

      return {
        testName: failure.testName,
        testFile: failure.testFile,
        verdict,
        confidence: 0.5,
        reasoning: "Basic analysis - run CLI for full diagnostics",
        suggestions: ["Run: hambugsy analyze " + failure.testFile],
      };
    });
  }

  getConfig(): HambugsyConfig {
    return this.config;
  }
}
