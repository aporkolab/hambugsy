import { Command } from "commander";
import ora, { Ora } from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { resolve, relative } from "path";
import { ConsoleReporter } from "../output/console.js";
import { JsonOutput } from "../output/json.js";
import { JavaParser, JavaParseResult } from "../../parser/java/parser.js";
import { CopilotBridge, getCopilotBridge, CopilotError } from "../../services/copilot.js";
import { GitService, getGitService } from "../../services/git.js";
import { VerdictEngine, createVerdictEngine } from "../../verdict/engine.js";
import type {
  DiagnosticResult,
  AnalysisResult,
  TestSourcePair,
  TestCase,
  SourceMethod,
  GitContext,
  GitCommit,
  Expectation,
  Behavior,
} from "../../core/types.js";
import type { Commit } from "../../services/git.js";

// ============================================================================
// Types
// ============================================================================

interface AnalyzeOptions {
  recursive?: boolean;
  filter?: "bugs" | "tests" | "all";
  format?: "console" | "json" | "github";
  verbose?: boolean;
  confidence?: string;
}

interface ProgressInfo {
  current: number;
  total: number;
  file: string;
}

// ============================================================================
// Analyze Command
// ============================================================================

export const analyzeCommand = new Command("analyze")
  .description("Analyze test failures and determine if the test or code is buggy")
  .argument("[path]", "Path to project directory", ".")
  .option("-r, --recursive", "Recursively search for files", true)
  .option(
    "-f, --filter <type>",
    "Filter results: bugs, tests, or all",
    "all"
  )
  .option(
    "--format <format>",
    "Output format: console, json, or github",
    "console"
  )
  .option("-v, --verbose", "Show detailed analysis")
  .option(
    "-c, --confidence <threshold>",
    "Minimum confidence threshold (0-1)",
    "0.5"
  )
  .action(async (path: string, options: AnalyzeOptions) => {
    const exitCode = await runAnalysis(path, options);
    process.exit(exitCode);
  });

// ============================================================================
// Main Analysis Flow
// ============================================================================

async function runAnalysis(path: string, options: AnalyzeOptions): Promise<number> {
  const spinner = ora();
  let copilot: CopilotBridge;
  let git: GitService;
  let verdictEngine: VerdictEngine;

  try {
    // 1. Check GitHub Copilot CLI
    spinner.start("Checking GitHub Copilot CLI...");
    copilot = getCopilotBridge();
    const copilotAvailable = await copilot.checkAvailability();

    if (!copilotAvailable) {
      spinner.warn("GitHub Copilot CLI not found - analysis will be limited");
      console.log(
        chalk.yellow(
          "\nTo enable AI-powered analysis, install GitHub Copilot CLI:\n" +
            "  gh extension install github/gh-copilot\n"
        )
      );
    } else {
      spinner.succeed("GitHub Copilot CLI available");
    }

    // 2. Initialize services
    git = getGitService(resolve(path));
    verdictEngine = createVerdictEngine(copilot, git);

    // 3. Discover files
    spinner.start("Discovering files...");
    const files = await discoverFiles(path, options.recursive ?? true);

    if (files.length === 0) {
      spinner.warn("No Java files found");
      console.log(chalk.gray(`Searched in: ${resolve(path)}`));
      return 0;
    }

    spinner.succeed(`Found ${files.length} Java file(s)`);

    // 4. Analyze files
    const results = await analyzeFiles(
      files,
      copilot,
      git,
      verdictEngine,
      spinner,
      options.verbose ?? false
    );

    // 5. Filter results
    const filteredResults = filterResults(
      results,
      options.filter ?? "all",
      parseFloat(options.confidence ?? "0.5")
    );

    // 6. Output results
    outputResults(filteredResults, options);

    // 7. Determine exit code
    const hasBugs = filteredResults.some(
      (r) => r.verdict.type === "CODE_BUG"
    );

    return hasBugs ? 1 : 0;
  } catch (error) {
    spinner.fail("Analysis failed");

    if (error instanceof CopilotError && error.isNotInstalled) {
      console.error(
        chalk.red("\nGitHub Copilot CLI is required for full analysis.")
      );
      console.error(
        chalk.yellow("Install it with: gh extension install github/gh-copilot")
      );
    } else {
      console.error(
        chalk.red(error instanceof Error ? error.message : "Unknown error")
      );
    }

    if (options.verbose && error instanceof Error) {
      console.error(chalk.gray(error.stack));
    }

    return 1;
  }
}

// ============================================================================
// File Discovery
// ============================================================================

async function discoverFiles(
  basePath: string,
  recursive: boolean
): Promise<string[]> {
  const resolvedPath = resolve(basePath);
  const pattern = recursive ? "**/*.java" : "*.java";

  const files = await glob(pattern, {
    cwd: resolvedPath,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/build/**",
      "**/target/**",
      "**/out/**",
      "**/.git/**",
    ],
  });

  return files;
}

// ============================================================================
// File Analysis
// ============================================================================

async function analyzeFiles(
  files: string[],
  copilot: CopilotBridge,
  git: GitService,
  verdictEngine: VerdictEngine,
  spinner: Ora,
  verbose: boolean
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const testFiles: Map<string, JavaParseResult> = new Map();
  const sourceFiles: Map<string, JavaParseResult> = new Map();

  // Phase 1: Parse all files
  spinner.start(`Parsing ${files.length} files...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress: ProgressInfo = {
      current: i + 1,
      total: files.length,
      file: relative(process.cwd(), file),
    };

    spinner.text = `Parsing [${progress.current}/${progress.total}] ${progress.file}`;

    try {
      const parser = new JavaParser(file);
      const parseResult = await parser.parseFile();

      // Categorize as test or source file
      if (parseResult.tests.length > 0) {
        testFiles.set(file, parseResult);
      }
      if (parseResult.methods.length > 0) {
        sourceFiles.set(file, parseResult);
      }
    } catch (error) {
      if (verbose) {
        console.warn(
          chalk.yellow(`\nWarning: Could not parse ${progress.file}: ${error}`)
        );
      }
      // Continue with other files
    }
  }

  spinner.succeed(`Parsed ${testFiles.size} test file(s) and ${sourceFiles.size} source file(s)`);

  // Phase 2: Correlate tests to methods
  spinner.start("Correlating tests to source methods...");
  const pairs = correlateTestsToMethods(testFiles, sourceFiles);
  spinner.succeed(`Found ${pairs.length} test-source pair(s)`);

  if (pairs.length === 0) {
    return [];
  }

  // Phase 3: Analyze each pair
  spinner.start(`Analyzing ${pairs.length} test-source pairs...`);

  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const progress: ProgressInfo = {
      current: i + 1,
      total: pairs.length,
      file: `${pair.test.name} -> ${pair.source.name}`,
    };

    spinner.text = `Analyzing [${progress.current}/${progress.total}] ${progress.file}`;

    try {
      // Build analysis result
      const analysis = await buildAnalysisResult(pair, copilot, git);

      // Determine verdict
      const verdict = await verdictEngine.determine(analysis);

      // Convert to diagnostic result
      results.push({
        testName: pair.test.name,
        testFile: pair.test.filePath,
        verdict,
        confidence: verdict.confidence,
        reasoning: verdict.explanation,
        suggestions: verdict.recommendation.suggestedFix
          ? [verdict.recommendation.suggestedFix]
          : [],
      });
    } catch (error) {
      if (verbose) {
        console.warn(
          chalk.yellow(`\nWarning: Could not analyze ${pair.test.name}: ${error}`)
        );
      }
      // Continue with other pairs
    }
  }

  spinner.succeed(`Analysis complete: ${results.length} result(s)`);
  return results;
}

// ============================================================================
// Test-Source Correlation
// ============================================================================

function correlateTestsToMethods(
  testFiles: Map<string, JavaParseResult>,
  sourceFiles: Map<string, JavaParseResult>
): TestSourcePair[] {
  const pairs: TestSourcePair[] = [];

  // Collect all source methods
  const allMethods: SourceMethod[] = [];
  for (const parseResult of sourceFiles.values()) {
    allMethods.push(...parseResult.methods);
  }

  // For each test, try to find a matching source method
  for (const parseResult of testFiles.values()) {
    for (const test of parseResult.tests) {
      const match = findMatchingMethod(test, allMethods);
      if (match) {
        pairs.push(match);
      }
    }
  }

  return pairs;
}

function findMatchingMethod(
  test: TestCase,
  methods: SourceMethod[]
): TestSourcePair | null {
  const testName = test.name.toLowerCase();

  // Strategy 1: Naming convention (testMethodName -> methodName)
  const methodNameFromTest = extractMethodNameFromTest(testName);

  for (const method of methods) {
    const methodName = method.name.toLowerCase();

    // Direct match
    if (methodName === methodNameFromTest) {
      return {
        test,
        source: method,
        confidence: 0.9,
        correlationType: "NAMING_CONVENTION",
      };
    }

    // Contains match
    if (testName.includes(methodName) || methodNameFromTest.includes(methodName)) {
      return {
        test,
        source: method,
        confidence: 0.7,
        correlationType: "NAMING_CONVENTION",
      };
    }
  }

  // Strategy 2: Look for method calls in test body
  for (const method of methods) {
    if (test.body.includes(`${method.name}(`)) {
      return {
        test,
        source: method,
        confidence: 0.8,
        correlationType: "CALL_GRAPH",
      };
    }
  }

  return null;
}

function extractMethodNameFromTest(testName: string): string {
  // Remove common test prefixes
  let name = testName
    .replace(/^test_?/i, "")
    .replace(/^should_?/i, "")
    .replace(/_?test$/i, "");

  // Convert camelCase "testMethodName" -> "methodname"
  // or "test_method_name" -> "method_name"
  return name.toLowerCase();
}

// ============================================================================
// Analysis Building
// ============================================================================

async function buildAnalysisResult(
  pair: TestSourcePair,
  copilot: CopilotBridge,
  git: GitService
): Promise<AnalysisResult> {
  // Get git context
  const gitContext = await buildGitContext(pair, git);

  // Get expectations and behavior (from Copilot if available)
  let testExpectation: Expectation;
  let codeBehavior: Behavior;

  try {
    const [expectationAnalysis, behaviorAnalysis] = await Promise.all([
      copilot.analyzeTestExpectation(pair.test.body),
      copilot.analyzeCodeBehavior(pair.source.body),
    ]);

    testExpectation = {
      description: expectationAnalysis.description,
      expectedBehavior: expectationAnalysis.description,
      inputValues: expectationAnalysis.expectedInputs,
      expectedOutput: expectationAnalysis.expectedOutputs[0] ?? null,
      expectedExceptions: expectationAnalysis.expectedExceptions,
    };

    codeBehavior = {
      description: behaviorAnalysis.description,
      actualBehavior: behaviorAnalysis.description,
      codePathTaken: [],
      returnValue: behaviorAnalysis.returnBehavior || null,
      thrownExceptions: behaviorAnalysis.errorConditions,
    };
  } catch {
    // Fallback if Copilot is not available
    testExpectation = buildExpectationFromAssertions(pair.test);
    codeBehavior = buildBehaviorFromMethod(pair.source);
  }

  // Detect divergence
  const divergence = detectDivergence(pair, testExpectation, codeBehavior);

  return {
    pair,
    testExpectation,
    codeBehavior,
    divergence,
    gitContext,
  };
}

async function buildGitContext(
  pair: TestSourcePair,
  git: GitService
): Promise<GitContext> {
  try {
    const [testHistory, sourceHistory] = await Promise.all([
      git.getHistory(pair.test.filePath, 5),
      git.getHistory(pair.source.filePath, 5),
    ]);

    // Convert Commit to GitCommit
    const toGitCommit = (commit: Commit): GitCommit => ({
      ...commit,
      filesChanged: [],
    });

    return {
      lastTestChange: testHistory[0] ? toGitCommit(testHistory[0]) : null,
      lastCodeChange: sourceHistory[0] ? toGitCommit(sourceHistory[0]) : null,
      recentCommits: [...testHistory, ...sourceHistory]
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 10)
        .map(toGitCommit),
      blame: null, // Could add blame for specific lines if needed
    };
  } catch {
    // Git not available or error
    return {
      lastTestChange: null,
      lastCodeChange: null,
      recentCommits: [],
      blame: null,
    };
  }
}

function buildExpectationFromAssertions(test: TestCase): Expectation {
  const assertions = test.assertions;

  return {
    description: `Test ${test.name} with ${assertions.length} assertion(s)`,
    expectedBehavior: assertions.map((a) => a.raw).join("; "),
    inputValues: [],
    expectedOutput: assertions.find((a) => a.type === "equals")?.expected ?? null,
    expectedExceptions: assertions
      .filter((a) => a.type === "throws")
      .map((a) => a.expected ?? "Exception"),
  };
}

function buildBehaviorFromMethod(method: SourceMethod): Behavior {
  return {
    description: `Method ${method.name} returns ${method.returnType}`,
    actualBehavior: `${method.name}(${method.parameters.map((p) => p.type).join(", ")}) -> ${method.returnType}`,
    codePathTaken: [],
    returnValue: method.returnType !== "void" ? method.returnType : null,
    thrownExceptions: [],
  };
}

function detectDivergence(
  pair: TestSourcePair,
  expectation: Expectation,
  behavior: Behavior
): AnalysisResult["divergence"] {
  // Simple divergence detection based on assertions
  // In a real implementation, this would be more sophisticated

  // Check for exception mismatches
  if (
    expectation.expectedExceptions.length > 0 &&
    behavior.thrownExceptions.length === 0
  ) {
    return {
      type: "EXCEPTION_MISMATCH",
      description: `Test expects exception but code may not throw`,
      testLine: pair.test.lineNumber,
      codeLine: pair.source.lineNumber,
      expected: expectation.expectedExceptions.join(", "),
      actual: "no exception",
    };
  }

  // For now, return null (no divergence detected without actually running tests)
  // Real implementation would need test execution results
  return null;
}

// ============================================================================
// Result Filtering
// ============================================================================

function filterResults(
  results: DiagnosticResult[],
  filter: "bugs" | "tests" | "all",
  minConfidence: number
): DiagnosticResult[] {
  return results.filter((r) => {
    // Filter by confidence
    if (r.confidence < minConfidence) {
      return false;
    }

    // Filter by type
    switch (filter) {
      case "bugs":
        return r.verdict.type === "CODE_BUG";
      case "tests":
        return r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST";
      case "all":
      default:
        return true;
    }
  });
}

// ============================================================================
// Output
// ============================================================================

function outputResults(results: DiagnosticResult[], options: AnalyzeOptions): void {
  const format = options.format ?? "console";

  switch (format) {
    case "json":
      const jsonOutput = new JsonOutput();
      jsonOutput.print(results);
      break;

    case "github":
      outputGitHubActions(results);
      break;

    case "console":
    default:
      if (results.length === 0) {
        console.log(chalk.green("\nNo issues found!"));
        return;
      }

      const reporter = new ConsoleReporter();
      reporter.print(results);
      break;
  }
}

function outputGitHubActions(results: DiagnosticResult[]): void {
  // GitHub Actions workflow commands
  for (const result of results) {
    const level = result.verdict.type === "CODE_BUG" ? "error" : "warning";
    const file = result.testFile;

    // ::error file={name},line={line}::{message}
    console.log(
      `::${level} file=${file}::${result.verdict.type}: ${result.reasoning}`
    );
  }

  // Summary
  const bugs = results.filter((r) => r.verdict.type === "CODE_BUG").length;
  const testIssues = results.filter(
    (r) => r.verdict.type === "OUTDATED_TEST" || r.verdict.type === "FLAKY_TEST"
  ).length;

  console.log(`::notice::Hambugsy found ${bugs} code bug(s) and ${testIssues} test issue(s)`);
}
