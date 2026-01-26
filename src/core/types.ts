// ============================================================================
// Test Framework Types
// ============================================================================

export type TestFramework =
  | "junit5"
  | "junit4"
  | "testng"
  | "jest"
  | "vitest"
  | "mocha"
  | "pytest"
  | "unittest";

export type AssertionType =
  | "equals"
  | "throws"
  | "truthy"
  | "contains"
  | "other";

export interface Assertion {
  type: AssertionType;
  expected: string | null;
  actual: string | null;
  lineNumber: number;
  raw: string;
}

export interface TestCase {
  name: string;
  filePath: string;
  lineNumber: number;
  endLine: number;
  framework: TestFramework;
  assertions: Assertion[];
  body: string;
}

// ============================================================================
// Source Code Types
// ============================================================================

export interface Parameter {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface SourceMethod {
  name: string;
  filePath: string;
  lineNumber: number;
  endLine: number;
  parameters: Parameter[];
  returnType: string;
  body: string;
  className?: string;
}

// ============================================================================
// Correlation Types
// ============================================================================

export type CorrelationType =
  | "NAMING_CONVENTION"
  | "IMPORT_ANALYSIS"
  | "CALL_GRAPH"
  | "ANNOTATION"
  | "DIRECTORY_STRUCTURE"
  | "EXPLICIT_REFERENCE";

export interface TestSourcePair {
  test: TestCase;
  source: SourceMethod;
  confidence: number;
  correlationType: CorrelationType;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface Expectation {
  description: string;
  expectedBehavior: string;
  inputValues: string[];
  expectedOutput: string | null;
  expectedExceptions: string[];
}

export interface Behavior {
  description: string;
  actualBehavior: string;
  codePathTaken: string[];
  returnValue: string | null;
  thrownExceptions: string[];
}

export type DivergenceType =
  | "RETURN_VALUE_MISMATCH"
  | "EXCEPTION_MISMATCH"
  | "STATE_MUTATION"
  | "MISSING_ASSERTION"
  | "INCORRECT_ASSERTION"
  | "TIMING_ISSUE";

export interface Divergence {
  type: DivergenceType;
  description: string;
  testLine: number;
  codeLine: number;
  expected: string;
  actual: string;
}

export interface GitContext {
  lastTestChange: GitCommit | null;
  lastCodeChange: GitCommit | null;
  recentCommits: GitCommit[];
  blame: GitBlame | null;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  filesChanged: string[];
}

export interface GitBlame {
  lineNumber: number;
  commitHash: string;
  author: string;
  date: Date;
}

export interface AnalysisResult {
  pair: TestSourcePair;
  testExpectation: Expectation;
  codeBehavior: Behavior;
  divergence: Divergence | null;
  gitContext: GitContext;
}

// ============================================================================
// Verdict Types
// ============================================================================

export type VerdictType =
  | "CODE_BUG"
  | "OUTDATED_TEST"
  | "FLAKY_TEST"
  | "ENVIRONMENT_ISSUE"
  | "PASSED";

export type RecommendationAction =
  | "FIX_CODE"
  | "UPDATE_TEST"
  | "ADD_RETRY"
  | "CHECK_ENVIRONMENT"
  | "INVESTIGATE"
  | "NO_ACTION";

export interface Recommendation {
  action: RecommendationAction;
  description: string;
  suggestedFix?: string;
  affectedFiles: string[];
  priority: Priority;
}

export interface Verdict {
  type: VerdictType;
  confidence: number;
  reason: string;
  explanation: string;
  recommendation: Recommendation;
}

// ============================================================================
// Missing Test Suggestion Types
// ============================================================================

export type MissingTestPattern =
  | "NULL_CHECK"
  | "EMPTY_COLLECTION"
  | "BOUNDARY"
  | "EXCEPTION"
  | "EDGE_CASE"
  | "NEGATIVE_INPUT"
  | "CONCURRENT_ACCESS"
  | "STATE_TRANSITION";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface MissingTest {
  methodName: string;
  filePath: string;
  lineNumber: number;
  pattern: MissingTestPattern;
  priority: Priority;
  suggestedTest: string;
  rationale: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export type SupportedLanguage = "java" | "typescript" | "python";

export interface HambugsyConfig {
  language: SupportedLanguage;
  testFramework?: TestFramework;
  sourceDir: string;
  testDir: string;
  excludePatterns: string[];
  outputFormat: OutputFormat;
  copilotEnabled: boolean;
}

export type OutputFormat = "console" | "json" | "junit-xml" | "github-actions";

// ============================================================================
// Test Report Parsing Types
// ============================================================================

export interface TestFailure {
  testName: string;
  testFile: string;
  errorMessage: string;
  stackTrace?: string;
  sourceFile?: string;
  sourceLine?: number;
}

export interface ParsedTestReport {
  failures: TestFailure[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

// ============================================================================
// CLI Output Types (simplified for display)
// ============================================================================

export interface DiagnosticResult {
  testName: string;
  testFile: string;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  suggestions: string[];
}

// ============================================================================
// CLI Types
// ============================================================================

export interface CliOptions {
  verbose: boolean;
  json: boolean;
  config?: string;
  language?: SupportedLanguage;
}

export interface AnalyzeOptions extends CliOptions {
  path: string;
  testReport?: string;
  limit?: number;
}

export interface SuggestOptions extends CliOptions {
  testName: string;
  maxSuggestions: number;
}

export interface InitOptions {
  language: SupportedLanguage;
  force: boolean;
}
