export type Verdict = "test" | "code" | "unknown";

export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace?: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface AnalysisResult {
  failure: TestFailure;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  suggestions: string[];
}

export interface HambugsyConfig {
  language: "java" | "typescript" | "python";
  testFramework?: string;
  sourceDir: string;
  testDir: string;
  excludePatterns?: string[];
}

export interface ParsedTestReport {
  failures: TestFailure[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
}
