import { execa, ExecaError } from "execa";
import PQueue from "p-queue";
import type { MissingTest } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface TestExpectationAnalysis {
  description: string;
  expectedInputs: string[];
  expectedOutputs: string[];
  expectedExceptions: string[];
}

export interface CodeBehaviorAnalysis {
  description: string;
  sideEffects: string[];
  returnBehavior: string;
  errorConditions: string[];
}

export interface FixSuggestion {
  file: string;
  suggestion: string;
  explanation: string;
}

export interface FixContext {
  testCode: string;
  sourceCode: string;
  errorMessage: string;
  filePath: string;
}

export class CopilotError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly isTimeout: boolean = false,
    public readonly isNotInstalled: boolean = false
  ) {
    super(message);
    this.name = "CopilotError";
  }
}

// ============================================================================
// CopilotBridge
// ============================================================================

export class CopilotBridge {
  private queue: PQueue;
  private isAvailable: boolean | null = null;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options?: { timeout?: number; maxRetries?: number }) {
    this.timeout = options?.timeout ?? 30000;
    this.maxRetries = options?.maxRetries ?? 3;

    // Rate limiting: max 2 concurrent, max 5 per second
    this.queue = new PQueue({
      concurrency: 2,
      interval: 1000,
      intervalCap: 5,
    });
  }

  // ==========================================================================
  // Availability Check
  // ==========================================================================

  async checkAvailability(): Promise<boolean> {
    if (this.isAvailable !== null) {
      return this.isAvailable;
    }

    try {
      await execa("gh", ["copilot", "--version"], { timeout: 5000 });
      this.isAvailable = true;
    } catch {
      // Expected when gh copilot is not installed - not an error condition
      this.isAvailable = false;
    }

    return this.isAvailable;
  }

  // ==========================================================================
  // Core Methods
  // ==========================================================================

  /**
   * Ask Copilot to explain code with a specific question
   */
  async explain(code: string, question: string): Promise<string> {
    await this.ensureAvailable();

    const prompt = `${question}\n\nCode:\n\`\`\`\n${code}\n\`\`\``;
    return this.executeWithRetry(() => this.runGhCopilotExplain(prompt));
  }

  /**
   * Analyze what a test expects
   */
  async analyzeTestExpectation(testCode: string): Promise<TestExpectationAnalysis> {
    await this.ensureAvailable();

    const prompt = `Analyze this test method. What does it expect? What inputs does it test? What outputs or exceptions does it verify?\n\nTest code:\n\`\`\`\n${testCode}\n\`\`\``;

    const response = await this.executeWithRetry(() =>
      this.runGhCopilotExplain(prompt)
    );

    return this.parseTestExpectation(response);
  }

  /**
   * Analyze what a piece of code does
   */
  async analyzeCodeBehavior(code: string): Promise<CodeBehaviorAnalysis> {
    await this.ensureAvailable();

    const prompt = `Analyze this code. What does it do? What are its side effects? What does it return? Under what conditions might it throw exceptions?\n\nCode:\n\`\`\`\n${code}\n\`\`\``;

    const response = await this.executeWithRetry(() =>
      this.runGhCopilotExplain(prompt)
    );

    return this.parseCodeBehavior(response);
  }

  /**
   * Explain why test and source code might diverge
   */
  async explainDivergence(testCode: string, sourceCode: string): Promise<string> {
    await this.ensureAvailable();

    const prompt = `Compare this test with the source code it tests. Why might the test be failing? What is the divergence between what the test expects and what the code does?\n\nTest:\n\`\`\`\n${testCode}\n\`\`\`\n\nSource code:\n\`\`\`\n${sourceCode}\n\`\`\``;

    return this.executeWithRetry(() => this.runGhCopilotExplain(prompt));
  }

  /**
   * Suggest a fix for a failing test
   */
  async suggestFix(context: FixContext): Promise<FixSuggestion> {
    await this.ensureAvailable();

    const prompt = `Fix this failing test. The error is: ${context.errorMessage}\n\nTest:\n\`\`\`\n${context.testCode}\n\`\`\`\n\nSource:\n\`\`\`\n${context.sourceCode}\n\`\`\``;

    const response = await this.executeWithRetry(() =>
      this.runGhCopilotSuggest(prompt)
    );

    return {
      file: context.filePath,
      suggestion: response,
      explanation: "Suggested fix based on test-source divergence analysis",
    };
  }

  /**
   * Suggest missing tests for a piece of code
   */
  async suggestMissingTests(code: string, filePath: string): Promise<MissingTest[]> {
    await this.ensureAvailable();

    const prompt = `What tests are missing for this code? Consider null checks, empty collections, boundary conditions, exception handling, and edge cases.\n\nCode:\n\`\`\`\n${code}\n\`\`\``;

    const response = await this.executeWithRetry(() =>
      this.runGhCopilotExplain(prompt)
    );

    return this.parseMissingTests(response, filePath);
  }

  // ==========================================================================
  // Private: Execution
  // ==========================================================================

  private async ensureAvailable(): Promise<void> {
    const available = await this.checkAvailability();
    if (!available) {
      throw new CopilotError(
        "GitHub Copilot CLI is not available. Install it with: gh extension install github/gh-copilot",
        undefined,
        false,
        true
      );
    }
  }

  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(async () => {
      let lastError: Error | undefined;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Don't retry on certain errors
          if (this.isNonRetryableError(lastError)) {
            throw this.wrapError(lastError);
          }

          // Wait before retry (exponential backoff)
          if (attempt < this.maxRetries) {
            await this.sleep(Math.pow(2, attempt) * 500);
          }
        }
      }

      throw this.wrapError(lastError!);
    }) as Promise<T>;
  }

  private async runGhCopilotExplain(prompt: string): Promise<string> {
    try {
      const { stdout } = await execa("gh", ["copilot", "explain", prompt], {
        timeout: this.timeout,
        reject: true,
      });
      return stdout.trim();
    } catch (error) {
      throw this.handleExecaError(error);
    }
  }

  private async runGhCopilotSuggest(prompt: string): Promise<string> {
    try {
      const { stdout } = await execa(
        "gh",
        ["copilot", "suggest", "-t", "code", prompt],
        {
          timeout: this.timeout,
          reject: true,
        }
      );
      return stdout.trim();
    } catch (error) {
      throw this.handleExecaError(error);
    }
  }

  // ==========================================================================
  // Private: Error Handling
  // ==========================================================================

  private handleExecaError(error: unknown): Error {
    if (error instanceof Error) {
      const execaError = error as ExecaError;

      if (execaError.timedOut) {
        return new CopilotError(
          `Copilot request timed out after ${this.timeout}ms`,
          error,
          true
        );
      }

      if (execaError.exitCode === 127) {
        return new CopilotError(
          "GitHub CLI (gh) is not installed",
          error,
          false,
          true
        );
      }

      return new CopilotError(
        `Copilot CLI error: ${error.message}`,
        error
      );
    }

    return new CopilotError(`Unknown error: ${String(error)}`);
  }

  private isNonRetryableError(error: Error): boolean {
    if (error instanceof CopilotError) {
      return error.isNotInstalled;
    }
    return false;
  }

  private wrapError(error: Error): CopilotError {
    if (error instanceof CopilotError) {
      return error;
    }
    return new CopilotError(error.message, error);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // Private: Response Parsing
  // ==========================================================================

  private parseTestExpectation(response: string): TestExpectationAnalysis {
    // Parse Copilot's natural language response into structured data
    // This is a best-effort extraction
    return {
      description: response,
      expectedInputs: this.extractListItems(response, /inputs?:?\s*([^\n]+)/gi),
      expectedOutputs: this.extractListItems(response, /outputs?:?\s*([^\n]+)/gi),
      expectedExceptions: this.extractListItems(
        response,
        /exceptions?|throws?:?\s*([^\n]+)/gi
      ),
    };
  }

  private parseCodeBehavior(response: string): CodeBehaviorAnalysis {
    return {
      description: response,
      sideEffects: this.extractListItems(response, /side effects?:?\s*([^\n]+)/gi),
      returnBehavior: this.extractFirstMatch(response, /returns?:?\s*([^\n]+)/i) ?? "",
      errorConditions: this.extractListItems(
        response,
        /errors?|exceptions?:?\s*([^\n]+)/gi
      ),
    };
  }

  private parseMissingTests(response: string, filePath: string): MissingTest[] {
    const tests: MissingTest[] = [];

    // Extract test suggestions from the response
    // Look for patterns like "Test for null input", "Test boundary conditions", etc.
    const patterns: Array<{
      regex: RegExp;
      pattern: MissingTest["pattern"];
      priority: MissingTest["priority"];
    }> = [
      { regex: /null|nullable/i, pattern: "NULL_CHECK", priority: "CRITICAL" },
      { regex: /empty|collection/i, pattern: "EMPTY_COLLECTION", priority: "HIGH" },
      { regex: /boundary|edge|limit/i, pattern: "BOUNDARY", priority: "HIGH" },
      { regex: /exception|error|throw/i, pattern: "EXCEPTION", priority: "CRITICAL" },
      { regex: /negative|invalid/i, pattern: "NEGATIVE_INPUT", priority: "MEDIUM" },
      { regex: /concurrent|thread|race/i, pattern: "CONCURRENT_ACCESS", priority: "HIGH" },
    ];

    // Split response into lines and look for test suggestions
    const lines = response.split("\n");
    let lineNumber = 1;

    for (const line of lines) {
      for (const { regex, pattern, priority } of patterns) {
        if (regex.test(line)) {
          tests.push({
            methodName: this.extractMethodName(line) ?? "unknownMethod",
            filePath,
            lineNumber,
            pattern,
            priority,
            suggestedTest: line.trim(),
            rationale: `Copilot suggested: ${line.trim()}`,
          });
          lineNumber++;
          break;
        }
      }
    }

    return tests;
  }

  private extractListItems(text: string, pattern: RegExp): string[] {
    const items: string[] = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        items.push(match[1].trim());
      }
    }

    return items;
  }

  private extractFirstMatch(text: string, pattern: RegExp): string | null {
    const match = pattern.exec(text);
    return match?.[1]?.trim() ?? null;
  }

  private extractMethodName(text: string): string | null {
    // Try to extract a method name from text like "test for calculateTotal()"
    const match = /(\w+)\s*\(/.exec(text);
    return match?.[1] ?? null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let defaultBridge: CopilotBridge | null = null;

export function getCopilotBridge(): CopilotBridge {
  if (!defaultBridge) {
    defaultBridge = new CopilotBridge();
  }
  return defaultBridge;
}
