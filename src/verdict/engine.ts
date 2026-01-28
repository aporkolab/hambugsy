import type {
  AnalysisResult,
  Verdict,
  VerdictType,
  Recommendation,
  Priority,
} from "../core/types.js";
import { CopilotBridge } from "../services/copilot.js";
import { GitService } from "../services/git.js";

// ============================================================================
// Constants
// ============================================================================

/** Base confidence level when determining verdicts */
const BASE_CONFIDENCE = 0.7;
/** Confidence boost for clear commit messages (conventional commits, JIRA) */
const CLEAR_COMMIT_BOOST = 0.1;
/** Confidence boost for strong test-source correlation */
const STRONG_CORRELATION_BOOST = 0.05;
/** Confidence boost for clear return value mismatches */
const RETURN_MISMATCH_BOOST = 0.1;
/** Maximum confidence level (never 100% certain) */
const MAX_CONFIDENCE = 0.99;
/** Confidence level for passed tests (no divergence) */
const PASSED_CONFIDENCE = 0.99;

// ============================================================================
// VerdictEngine
// ============================================================================

export class VerdictEngine {
  private copilot: CopilotBridge;
  private git: GitService;

  constructor(copilot: CopilotBridge, git: GitService) {
    this.copilot = copilot;
    this.git = git;
  }

  // ==========================================================================
  // Main Verdict Determination
  // ==========================================================================

  /**
   * Determine the verdict for an analysis result
   */
  async determine(analysis: AnalysisResult): Promise<Verdict> {
    // 1. If no divergence -> PASSED
    if (!analysis.divergence) {
      return this.createPassedVerdict();
    }

    // 2. Compare modification times
    const { testFile, sourceFile } = this.extractFiles(analysis);
    const comparison = await this.git.compareLastModification(testFile, sourceFile);

    const codeIsNewer = comparison.moreRecent === sourceFile;
    const lastCodeCommit = analysis.gitContext.lastCodeChange;

    if (codeIsNewer && lastCodeCommit) {
      // Check if the code change was intentional
      const isIntentional = this.git.isIntentionalChange(lastCodeCommit.message);

      if (isIntentional) {
        // 2. Code is newer AND commit was intentional -> OUTDATED_TEST
        return this.createOutdatedTestVerdict(analysis);
      } else {
        // 3. Code is newer AND commit was accidental -> CODE_BUG (regression)
        return this.createCodeBugVerdict(analysis, true);
      }
    }

    // 4. Test is newer or equal -> CODE_BUG
    return this.createCodeBugVerdict(analysis, false);
  }

  // ==========================================================================
  // Confidence Calculation
  // ==========================================================================

  /**
   * Calculate confidence score for a verdict
   */
  calculateConfidence(analysis: AnalysisResult, verdictType: VerdictType): number {
    let confidence = BASE_CONFIDENCE;

    // Boost for clear commit message (conventional commits, JIRA tickets)
    const lastCommit = analysis.gitContext.lastCodeChange;
    if (lastCommit && this.hasClearCommitMessage(lastCommit.message)) {
      confidence += CLEAR_COMMIT_BOOST;
    }

    // Boost for strong correlation between test and source
    if (this.hasStrongCorrelation(analysis)) {
      confidence += STRONG_CORRELATION_BOOST;
    }

    // Boost for RETURN_VALUE_MISMATCH divergence (clearest signal)
    if (analysis.divergence?.type === "RETURN_VALUE_MISMATCH") {
      confidence += RETURN_MISMATCH_BOOST;
    }

    // High confidence when no divergence detected
    if (verdictType === "PASSED") {
      confidence = PASSED_CONFIDENCE;
    }

    // Never claim 100% certainty
    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private hasClearCommitMessage(message: string): boolean {
    // Check for conventional commit format or JIRA ticket
    const clearPatterns = [
      /^(feat|fix|refactor|test|docs|style|perf|chore|build|ci)[:\s(]/i,
      /[A-Z]{2,}-\d+/, // JIRA-123
      /^(add|remove|update|implement|fix)\s+/i,
    ];

    return clearPatterns.some((p) => p.test(message));
  }

  private hasStrongCorrelation(analysis: AnalysisResult): boolean {
    const strongTypes = ["NAMING_CONVENTION", "ANNOTATION", "EXPLICIT_REFERENCE"];
    return strongTypes.includes(analysis.pair.correlationType);
  }

  // ==========================================================================
  // Verdict Creators
  // ==========================================================================

  private createPassedVerdict(): Verdict {
    return {
      type: "PASSED",
      confidence: PASSED_CONFIDENCE,
      reason: "No divergence detected between test expectation and code behavior",
      explanation:
        "The test expectations align with the actual code behavior. " +
        "No issues were found during analysis.",
      recommendation: {
        action: "NO_ACTION",
        description: "No changes required",
        affectedFiles: [],
        priority: "LOW",
      },
    };
  }

  async createOutdatedTestVerdict(analysis: AnalysisResult): Promise<Verdict> {
    const confidence = this.calculateConfidence(analysis, "OUTDATED_TEST");
    const { testFile, sourceFile } = this.extractFiles(analysis);

    const lastCodeCommit = analysis.gitContext.lastCodeChange;
    const commitInfo = lastCodeCommit
      ? `Commit: ${lastCodeCommit.hash.substring(0, 7)} - "${lastCodeCommit.message}"`
      : "";

    // Try to get a fix suggestion from Copilot
    const recommendation = await this.createTestUpdateRecommendation(
      analysis,
      testFile,
      sourceFile
    );

    return {
      type: "OUTDATED_TEST",
      confidence,
      reason: `The source code was intentionally updated but the test was not updated to match. ${commitInfo}`,
      explanation: this.buildOutdatedTestExplanation(analysis),
      recommendation,
    };
  }

  async createCodeBugVerdict(
    analysis: AnalysisResult,
    isRegression: boolean
  ): Promise<Verdict> {
    const confidence = this.calculateConfidence(analysis, "CODE_BUG");
    const { testFile, sourceFile } = this.extractFiles(analysis);

    const lastCodeCommit = analysis.gitContext.lastCodeChange;

    // Try to get a fix suggestion from Copilot
    const recommendation = await this.createCodeFixRecommendation(
      analysis,
      testFile,
      sourceFile
    );

    const reason = isRegression
      ? `Regression detected: recent code change broke existing functionality. ` +
        `Commit: ${lastCodeCommit?.hash.substring(0, 7) ?? "unknown"}`
      : `Code does not behave as the test expects`;

    return {
      type: "CODE_BUG",
      confidence,
      reason,
      explanation: this.buildCodeBugExplanation(analysis, isRegression),
      recommendation,
    };
  }

  // ==========================================================================
  // Recommendation Builders
  // ==========================================================================

  private async createTestUpdateRecommendation(
    analysis: AnalysisResult,
    testFile: string,
    sourceFile: string
  ): Promise<Recommendation> {
    const baseRecommendation: Recommendation = {
      action: "UPDATE_TEST",
      description: `Update the test in ${testFile} to match the new behavior in ${sourceFile}`,
      affectedFiles: [testFile],
      priority: this.determinePriority(analysis),
    };

    // Try to get Copilot suggestion
    try {
      const suggestion = await this.copilot.suggestFix({
        testCode: analysis.pair.test.body,
        sourceCode: analysis.pair.source.body,
        errorMessage: analysis.divergence?.description ?? "Test expectation mismatch",
        filePath: testFile,
      });

      return {
        ...baseRecommendation,
        suggestedFix: suggestion.suggestion,
      };
    } catch (error) {
      // Copilot not available or failed - return base recommendation without AI suggestion
      // CopilotError is expected when Copilot is not installed/authenticated
      // Other errors are silently ignored to not disrupt the analysis flow
      void error; // Acknowledge the error variable
      return baseRecommendation;
    }
  }

  private async createCodeFixRecommendation(
    analysis: AnalysisResult,
    testFile: string,
    sourceFile: string
  ): Promise<Recommendation> {
    const baseRecommendation: Recommendation = {
      action: "FIX_CODE",
      description: `Fix the code in ${sourceFile} to match the expected behavior defined in ${testFile}`,
      affectedFiles: [sourceFile],
      priority: this.determinePriority(analysis),
    };

    // Try to get Copilot suggestion
    try {
      const suggestion = await this.copilot.suggestFix({
        testCode: analysis.pair.test.body,
        sourceCode: analysis.pair.source.body,
        errorMessage: analysis.divergence?.description ?? "Code behavior mismatch",
        filePath: sourceFile,
      });

      return {
        ...baseRecommendation,
        suggestedFix: suggestion.suggestion,
      };
    } catch (error) {
      // Copilot not available or failed - return base recommendation without AI suggestion
      void error; // Acknowledge the error variable
      return baseRecommendation;
    }
  }

  private determinePriority(analysis: AnalysisResult): Priority {
    const divergenceType = analysis.divergence?.type;

    // Critical divergences
    if (divergenceType === "EXCEPTION_MISMATCH") {
      return "CRITICAL";
    }

    // High priority divergences
    if (
      divergenceType === "RETURN_VALUE_MISMATCH" ||
      divergenceType === "STATE_MUTATION"
    ) {
      return "HIGH";
    }

    return "MEDIUM";
  }

  // ==========================================================================
  // Explanation Builders
  // ==========================================================================

  private buildOutdatedTestExplanation(analysis: AnalysisResult): string {
    const parts: string[] = [];

    parts.push("The analysis indicates that the test is outdated:");
    parts.push("");

    // Divergence info
    if (analysis.divergence) {
      parts.push(`• Divergence type: ${analysis.divergence.type}`);
      parts.push(`• ${analysis.divergence.description}`);
      parts.push(
        `• Expected: ${analysis.divergence.expected}, Got: ${analysis.divergence.actual}`
      );
      parts.push("");
    }

    // Git context
    const lastCode = analysis.gitContext.lastCodeChange;
    const lastTest = analysis.gitContext.lastTestChange;

    if (lastCode) {
      parts.push(`Source last modified: ${lastCode.date.toISOString().split("T")[0]}`);
      parts.push(`  by ${lastCode.author}: "${lastCode.message}"`);
    }

    if (lastTest) {
      parts.push(`Test last modified: ${lastTest.date.toISOString().split("T")[0]}`);
      parts.push(`  by ${lastTest.author}: "${lastTest.message}"`);
    }

    parts.push("");
    parts.push(
      "Recommendation: Update the test assertions to match the new expected behavior."
    );

    return parts.join("\n");
  }

  private buildCodeBugExplanation(
    analysis: AnalysisResult,
    isRegression: boolean
  ): string {
    const parts: string[] = [];

    if (isRegression) {
      parts.push("A regression was detected - recent code changes broke existing functionality:");
    } else {
      parts.push("The code does not behave as expected by the test:");
    }
    parts.push("");

    // Divergence info
    if (analysis.divergence) {
      parts.push(`• Divergence type: ${analysis.divergence.type}`);
      parts.push(`• ${analysis.divergence.description}`);
      parts.push(
        `• Test expects: ${analysis.divergence.expected}`
      );
      parts.push(
        `• Code produces: ${analysis.divergence.actual}`
      );
      parts.push("");
    }

    // Location info
    if (analysis.divergence) {
      parts.push(`Test assertion at line ${analysis.divergence.testLine}`);
      parts.push(`Code issue at line ${analysis.divergence.codeLine}`);
      parts.push("");
    }

    // Git context for regression
    if (isRegression && analysis.gitContext.lastCodeChange) {
      const commit = analysis.gitContext.lastCodeChange;
      parts.push(`Likely caused by commit: ${commit.hash.substring(0, 7)}`);
      parts.push(`  Author: ${commit.author}`);
      parts.push(`  Message: "${commit.message}"`);
      parts.push("");
    }

    parts.push(
      "Recommendation: Fix the code to match the expected behavior, or if the new behavior is intentional, update the test."
    );

    return parts.join("\n");
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  private extractFiles(analysis: AnalysisResult): {
    testFile: string;
    sourceFile: string;
  } {
    return {
      testFile: analysis.pair.test.filePath,
      sourceFile: analysis.pair.source.filePath,
    };
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createVerdictEngine(
  copilot: CopilotBridge,
  git: GitService
): VerdictEngine {
  return new VerdictEngine(copilot, git);
}
