import type { TestFailure, AnalysisResult } from "../core/types.js";

export class CopilotService {
  private isAvailable: boolean = false;

  async checkAvailability(): Promise<boolean> {
    // TODO: Check if GitHub Copilot CLI is available
    this.isAvailable = false;
    return this.isAvailable;
  }

  async analyzeFailure(_failure: TestFailure): Promise<AnalysisResult | null> {
    if (!this.isAvailable) {
      return null;
    }

    // TODO: Implement Copilot-based analysis
    return null;
  }
}
