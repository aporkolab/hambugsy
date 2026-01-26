import type { DiagnosticResult, TestFailure, HambugsyConfig, Verdict } from "./types.js";

export class Orchestrator {
  private config: HambugsyConfig;

  constructor(config: HambugsyConfig) {
    this.config = config;
  }

  async analyze(failures: TestFailure[]): Promise<DiagnosticResult[]> {
    // TODO: Implement full analysis pipeline
    return failures.map((failure) => {
      const verdict: Verdict = {
        type: "ENVIRONMENT_ISSUE",
        confidence: 0,
        reason: "Analysis not yet implemented",
        explanation: "The analysis pipeline is not yet implemented.",
        recommendation: {
          action: "INVESTIGATE",
          description: "Implement the analysis pipeline",
          affectedFiles: [],
          priority: "MEDIUM",
        },
      };

      return {
        testName: failure.testName,
        testFile: failure.testFile,
        verdict,
        confidence: 0,
        reasoning: "Analysis not yet implemented",
        suggestions: [],
      };
    });
  }

  getConfig(): HambugsyConfig {
    return this.config;
  }
}
