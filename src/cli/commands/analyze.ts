import { Command } from "commander";
import ora, { Ora } from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { resolve, relative } from "path";
import { createInterface } from "readline";
import chokidar from "chokidar";
import { ConsoleReporter } from "../output/console.js";
import { JsonOutput } from "../output/json.js";
import { MarkdownReporter } from "../output/markdown.js";
import { JavaParser } from "../../parser/java/parser.js";
import { TypeScriptParser } from "../../parser/typescript/parser.js";
import { PythonParser } from "../../parser/python/parser.js";
import { CopilotBridge, getCopilotBridge, CopilotError } from "../../services/copilot.js";
import { GitService, getGitService } from "../../services/git.js";
import { VerdictEngine, createVerdictEngine } from "../../verdict/engine.js";
import { TestRunner, getTestRunner, type TestRunResult } from "../../services/test-runner.js";
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
  format?: "console" | "json" | "github" | "markdown";
  verbose?: boolean;
  confidence?: string;
  test?: string;
  interactive?: boolean;
  watch?: boolean;
  runTests?: boolean;
  requireCopilot?: boolean;
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
    "Output format: console, json, github, or markdown",
    "console"
  )
  .option("-v, --verbose", "Show detailed analysis")
  .option(
    "-c, --confidence <threshold>",
    "Minimum confidence threshold (0-1)",
    "0.5"
  )
  .option("-t, --test <name>", "Filter by specific test name")
  .option("-i, --interactive", "Interactive mode - confirm each step")
  .option("-w, --watch", "Watch for file changes and re-run analysis")
  .option("--run-tests", "Actually run tests to detect real failures")
  .option("--require-copilot", "Require GitHub Copilot CLI (fail if not available)")
  .action(async (path: string, options: AnalyzeOptions) => {
    if (options.watch) {
      await runWatchMode(path, options);
    } else {
      const exitCode = await runAnalysis(path, options);
      process.exit(exitCode);
    }
  });

// ============================================================================
// Main Analysis Flow
// ============================================================================

async function runAnalysis(path: string, options: AnalyzeOptions): Promise<number> {
  const spinner = ora();
  let copilot: CopilotBridge;
  let git: GitService;
  let verdictEngine: VerdictEngine;
  let testRunner: TestRunner | null = null;
  let testResults: TestRunResult | null = null;

  try {
    // 1. Check GitHub Copilot CLI
    spinner.start("Checking GitHub Copilot CLI...");
    copilot = getCopilotBridge();
    const copilotAvailable = await copilot.checkAvailability();

    if (!copilotAvailable) {
      if (options.requireCopilot) {
        spinner.fail("GitHub Copilot CLI not found");
        console.error(
          chalk.red("\n--require-copilot flag is set but Copilot CLI is not available.")
        );
        console.error(
          chalk.yellow("Install it with: gh extension install github/gh-copilot")
        );
        return 1;
      }
      spinner.warn("GitHub Copilot CLI not found - analysis will be limited");
      console.log(
        chalk.yellow(
          "\nTo enable AI-powered analysis, install GitHub Copilot CLI:\n" +
            "  gh extension install github/gh-copilot\n"
        )
      );
    } else {
      spinner.succeed("GitHub Copilot CLI available - AI-powered analysis enabled");
    }

    // 1b. Run actual tests if requested
    if (options.runTests) {
      spinner.start("Running tests to detect real failures...");
      testRunner = getTestRunner(resolve(path));

      try {
        testResults = await testRunner.runTests();
        const statusColor = testResults.failed > 0 ? chalk.red : chalk.green;
        spinner.succeed(
          `Tests complete: ${statusColor(`${testResults.passed} passed, ${testResults.failed} failed`)}`
        );

        if (testResults.failed > 0) {
          console.log(chalk.yellow(`\n  Found ${testResults.failed} failing test(s) to analyze\n`));
        }
      } catch (error) {
        spinner.warn(`Could not run tests: ${error instanceof Error ? error.message : error}`);
        console.log(chalk.gray("  Falling back to static analysis\n"));
      }
    }

    // 2. Initialize services
    git = getGitService(resolve(path));
    verdictEngine = createVerdictEngine(copilot, git);

    // 3. Discover files
    spinner.start("Discovering files...");
    const files = await discoverFiles(path, options.recursive ?? true);

    if (files.length === 0) {
      spinner.warn("No source files found (Java, TypeScript, JavaScript, Python)");
      console.log(chalk.gray(`Searched in: ${resolve(path)}`));
      return 0;
    }

    spinner.succeed(`Found ${files.length} source file(s)`);

    // 4. Interactive mode confirmation
    if (options.interactive) {
      const proceed = await confirm("Proceed with analysis? [Y/n] ");
      if (!proceed) {
        console.log(chalk.yellow("Analysis cancelled."));
        return 0;
      }
    }

    // 4. Analyze files
    const results = await analyzeFiles(
      files,
      copilot,
      git,
      verdictEngine,
      spinner,
      options.verbose ?? false,
      options.test,
      testResults
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
    if (spinner.isSpinning) spinner.fail("Analysis failed");

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
// Watch Mode
// ============================================================================

async function runWatchMode(path: string, options: AnalyzeOptions): Promise<void> {
  const resolvedPath = resolve(path);
  let isAnalyzing = false;
  let pendingAnalysis = false;

  console.log(chalk.cyan.bold("\n  WATCH MODE"));
  console.log(chalk.gray("  Watching for file changes...\n"));
  console.log(chalk.gray(`  Path: ${resolvedPath}`));
  console.log(chalk.gray("  Press Ctrl+C to stop\n"));

  // Run initial analysis
  await runAnalysis(path, options);
  console.log(chalk.gray(`\n[${getTimestamp()}] Watching for changes...`));

  // Set up file watcher
  const watcher = chokidar.watch(
    ["**/*.java", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.py"],
    {
      cwd: resolvedPath,
      ignored: [
        "**/node_modules/**",
        "**/build/**",
        "**/target/**",
        "**/out/**",
        "**/dist/**",
        "**/.git/**",
        "**/__pycache__/**",
        "**/*.d.ts",
      ],
      ignoreInitial: true,
      persistent: true,
    }
  );

  const runDebouncedAnalysis = async () => {
    if (isAnalyzing) {
      pendingAnalysis = true;
      return;
    }

    isAnalyzing = true;
    console.clear();
    console.log(chalk.cyan.bold("\n  WATCH MODE"));
    console.log(chalk.gray(`  [${getTimestamp()}] File change detected, re-analyzing...\n`));

    await runAnalysis(path, options);
    console.log(chalk.gray(`\n[${getTimestamp()}] Watching for changes...`));

    isAnalyzing = false;

    if (pendingAnalysis) {
      pendingAnalysis = false;
      setTimeout(runDebouncedAnalysis, 100);
    }
  };

  watcher.on("change", (filePath) => {
    console.log(chalk.yellow(`\n  File changed: ${filePath}`));
    runDebouncedAnalysis();
  });

  watcher.on("add", (filePath) => {
    console.log(chalk.green(`\n  File added: ${filePath}`));
    runDebouncedAnalysis();
  });

  watcher.on("unlink", (filePath) => {
    console.log(chalk.red(`\n  File removed: ${filePath}`));
    runDebouncedAnalysis();
  });

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log(chalk.gray("\n\nStopping watch mode..."));
    watcher.close();
    process.exit(0);
  });

  // Keep the process alive
  await new Promise(() => {});
}

function getTimestamp(): string {
  return new Date().toLocaleTimeString();
}

// ============================================================================
// File Discovery
// ============================================================================

async function discoverFiles(
  basePath: string,
  recursive: boolean
): Promise<string[]> {
  const resolvedPath = resolve(basePath);
  // Support Java, TypeScript/JavaScript, and Python
  const pattern = recursive
    ? "**/*.{java,ts,tsx,js,jsx,py}"
    : "*.{java,ts,tsx,js,jsx,py}";

  const files = await glob(pattern, {
    cwd: resolvedPath,
    absolute: true,
    ignore: [
      "**/node_modules/**",
      "**/build/**",
      "**/target/**",
      "**/out/**",
      "**/dist/**",
      "**/.git/**",
      "**/__pycache__/**",
      "**/*.d.ts",
    ],
  });

  return files;
}

// ============================================================================
// File Analysis
// ============================================================================

interface ParseResult {
  tests: TestCase[];
  methods: SourceMethod[];
}

async function parseFile(filePath: string): Promise<ParseResult> {
  const ext = filePath.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "java":
      const javaParser = new JavaParser(filePath);
      return javaParser.parseFile();

    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      const tsParser = new TypeScriptParser(filePath);
      return tsParser.parseFile();

    case "py":
      const pyParser = new PythonParser(filePath);
      return pyParser.parseFile();

    default:
      return { tests: [], methods: [] };
  }
}

async function analyzeFiles(
  files: string[],
  copilot: CopilotBridge,
  git: GitService,
  verdictEngine: VerdictEngine,
  spinner: Ora,
  verbose: boolean,
  testNameFilter?: string,
  testResults?: TestRunResult | null
): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];
  const testFiles: Map<string, ParseResult> = new Map();
  const sourceFiles: Map<string, ParseResult> = new Map();

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
      const parseResult = await parseFile(file);

      // Categorize as test or source file
      if (parseResult.tests.length > 0) {
        // Apply test name filter if provided
        if (testNameFilter) {
          parseResult.tests = parseResult.tests.filter((t) =>
            t.name.toLowerCase().includes(testNameFilter.toLowerCase())
          );
        }
        if (parseResult.tests.length > 0) {
          testFiles.set(file, parseResult);
        }
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
      // Check if this test actually failed (from real test run)
      const realFailure = testResults?.results.find(
        (r) => r.status === "failed" &&
               (r.name.includes(pair.test.name) || pair.test.name.includes(r.name.split(".").pop() ?? ""))
      );

      // Build analysis result
      const analysis = await buildAnalysisResult(pair, copilot, git, realFailure?.errorMessage);

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
  testFiles: Map<string, ParseResult>,
  sourceFiles: Map<string, ParseResult>
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
  git: GitService,
  realErrorMessage?: string
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

  // Detect divergence (use real error message if available)
  const divergence = detectDivergence(pair, testExpectation, codeBehavior, realErrorMessage);

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
  behavior: Behavior,
  realErrorMessage?: string
): AnalysisResult["divergence"] {
  // If we have a real error from test execution, use it!
  if (realErrorMessage) {
    // Parse the error to determine divergence type
    const errorLower = realErrorMessage.toLowerCase();

    if (errorLower.includes("expected") && errorLower.includes("but")) {
      // Extract expected vs actual from error message
      const expectedMatch = realErrorMessage.match(/expected[:\s]+([^\n,]+)/i);
      const actualMatch = realErrorMessage.match(/(?:but was|actual|got)[:\s]+([^\n,]+)/i);

      return {
        type: "RETURN_VALUE_MISMATCH",
        description: `Test assertion failed: ${realErrorMessage.split("\n")[0]}`,
        testLine: pair.test.lineNumber,
        codeLine: pair.source.lineNumber,
        expected: expectedMatch?.[1]?.trim() ?? "expected value",
        actual: actualMatch?.[1]?.trim() ?? "actual value",
      };
    }

    if (errorLower.includes("exception") || errorLower.includes("error") || errorLower.includes("throw")) {
      return {
        type: "EXCEPTION_MISMATCH",
        description: `Exception mismatch: ${realErrorMessage.split("\n")[0]}`,
        testLine: pair.test.lineNumber,
        codeLine: pair.source.lineNumber,
        expected: expectation.expectedExceptions.join(", ") || "no exception",
        actual: realErrorMessage.split("\n")[0],
      };
    }

    // Generic failure
    return {
      type: "RETURN_VALUE_MISMATCH",
      description: realErrorMessage.split("\n")[0],
      testLine: pair.test.lineNumber,
      codeLine: pair.source.lineNumber,
      expected: "test to pass",
      actual: "test failed",
    };
  }

  // Fallback: Static analysis for exception mismatches
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

  // No divergence detected without actually running tests
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

    case "markdown":
      const mdReporter = new MarkdownReporter();
      mdReporter.print(results);
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

// ============================================================================
// Helpers
// ============================================================================

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      const normalized = answer.toLowerCase().trim();
      resolve(normalized === "" || normalized === "y" || normalized === "yes");
    });
  });
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
