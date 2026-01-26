import type { AnalysisResult, TestFailure, HambugsyConfig } from "./types.js";

export class Orchestrator {
  private config: HambugsyConfig;

  constructor(config: HambugsyConfig) {
    this.config = config;
  }

  async analyze(failures: TestFailure[]): Promise<AnalysisResult[]> {
    // TODO: Implement full analysis pipeline
    return failures.map((failure) => ({
      failure,
      verdict: "unknown" as const,
      confidence: 0,
      reasoning: "Analysis not yet implemented",
      suggestions: [],
    }));
  }

  getConfig(): HambugsyConfig {
    return this.config;
  }
}
