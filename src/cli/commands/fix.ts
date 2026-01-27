import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { readFileSync } from "fs";
import { createInterface } from "readline";
import { JavaParser } from "../../parser/java/parser.js";
import { TypeScriptParser } from "../../parser/typescript/parser.js";
import { PythonParser } from "../../parser/python/parser.js";
import { CopilotBridge, getCopilotBridge } from "../../services/copilot.js";
import { GitService, getGitService } from "../../services/git.js";
import { createVerdictEngine } from "../../verdict/engine.js";
import { detectDivergenceAdvanced } from "../../analysis/divergence-detector.js";
import type { DiagnosticResult, AnalysisResult, TestSourcePair, TestCase, SourceMethod, Expectation, Behavior } from "../../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface FixOptions {
  recursive?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  filter?: "bugs" | "tests" | "all";
}

interface FixSuggestion {
  file: string;
  lineNumber: number;
  originalLine: string;
  suggestedLine: string;
  reason: string;
  verdictType: string;
}

// ============================================================================
// Fix Command
// ============================================================================

export const fixCommand = new Command("fix")
  .description("Automatically fix detected issues (tests or code)")
  .argument("[path]", "Path to project directory", ".")
  .option("-r, --recursive", "Recursively search for files", true)
  .option("--dry-run", "Show what would be changed without making changes")
  .option("-y, --yes", "Skip confirmation prompts")
  .option("--filter <type>", "Fix only: bugs, tests, or all", "all")
  .action(async (path: string, options: FixOptions) => {
    const exitCode = await runFix(path, options);
    process.exit(exitCode);
  });

// ============================================================================
// Main Fix Flow
// ============================================================================

async function runFix(path: string, options: FixOptions): Promise<number> {
  const spinner = ora();

  try {
    // 1. Check Copilot
    spinner.start("Checking GitHub Copilot CLI...");
    const copilot = getCopilotBridge();
    const copilotAvailable = await copilot.checkAvailability();

    if (!copilotAvailable) {
      spinner.warn("GitHub Copilot CLI not found - fix suggestions will be limited");
    } else {
      spinner.succeed("GitHub Copilot CLI available");
    }

    // 2. Discover and analyze files
    spinner.start("Analyzing files...");
    const results = await analyzeFiles(path, options, copilot, spinner);

    if (results.length === 0) {
      spinner.succeed("No issues found - nothing to fix!");
      return 0;
    }

    // 3. Generate fix suggestions
    spinner.start("Generating fix suggestions...");
    const suggestions = await generateFixSuggestions(results, copilot, copilotAvailable);
    spinner.succeed(`Found ${suggestions.length} fixable issue(s)`);

    if (suggestions.length === 0) {
      console.log(chalk.yellow("\nNo automatic fixes available for the detected issues."));
      return 0;
    }

    // 4. Show suggestions
    console.log();
    console.log(chalk.bold("=== Proposed Fixes ==="));
    console.log();

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      console.log(
        chalk.cyan(`[${i + 1}] ${suggestion.file}:${suggestion.lineNumber}`)
      );
      console.log(chalk.gray(`    Reason: ${suggestion.reason}`));
      console.log(chalk.red(`    - ${suggestion.originalLine.trim()}`));
      console.log(chalk.green(`    + ${suggestion.suggestedLine.trim()}`));
      console.log();
    }

    // 5. Dry run check
    if (options.dryRun) {
      console.log(chalk.yellow("Dry run mode - no changes made."));
      return 0;
    }

    // 6. Confirm
    if (!options.yes) {
      const confirmed = await confirm(
        `Apply ${suggestions.length} fix(es)? [y/N] `
      );
      if (!confirmed) {
        console.log(chalk.yellow("Aborted."));
        return 0;
      }
    }

    // 7. Apply fixes
    spinner.start("Applying fixes...");
    const appliedCount = await applyFixes(suggestions);
    spinner.succeed(`Applied ${appliedCount} fix(es)`);

    console.log();
    console.log(chalk.green("✅ Fixes applied successfully!"));
    console.log(chalk.gray("Please review the changes and run your tests."));

    return 0;
  } catch (error) {
    spinner.fail("Fix failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    return 1;
  }
}

// ============================================================================
// Analysis
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
  basePath: string,
  options: FixOptions,
  copilot: CopilotBridge,
  _spinner: ReturnType<typeof ora>
): Promise<DiagnosticResult[]> {
  const resolvedPath = resolve(basePath);
  const pattern = options.recursive ? "**/*.{java,ts,tsx,js,jsx,py}" : "*.{java,ts,tsx,js,jsx,py}";

  const files = await glob(pattern, {
    cwd: resolvedPath,
    absolute: true,
    ignore: ["**/node_modules/**", "**/build/**", "**/target/**", "**/dist/**", "**/.git/**"],
  });

  if (files.length === 0) {
    return [];
  }

  // Parse all files first and categorize as test or source files
  const testFiles: Map<string, ParseResult> = new Map();
  const sourceFiles: Map<string, ParseResult> = new Map();

  for (const file of files) {
    try {
      const parseResult = await parseFile(file);

      // Categorize as test or source file
      if (parseResult.tests.length > 0) {
        testFiles.set(file, parseResult);
      }
      if (parseResult.methods.length > 0) {
        sourceFiles.set(file, parseResult);
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  // Correlate tests to methods ACROSS files (not just within the same file)
  const pairs = correlateTestsToMethods(testFiles, sourceFiles);

  if (pairs.length === 0) {
    return [];
  }

  const git = getGitService(resolvedPath);
  const verdictEngine = createVerdictEngine(copilot, git);
  const results: DiagnosticResult[] = [];

  for (const pair of pairs) {
    try {
      const analysis = await createAnalysis(pair, git, copilot);
      const verdict = await verdictEngine.determine(analysis);

      // Filter based on options
      if (options.filter === "bugs" && verdict.type !== "CODE_BUG") continue;
      if (options.filter === "tests" && verdict.type !== "OUTDATED_TEST") continue;

      if (verdict.type === "CODE_BUG" || verdict.type === "OUTDATED_TEST") {
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
      }
    } catch {
      // Skip pairs that can't be analyzed
    }
  }

  return results;
}

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
  return name.toLowerCase();
}

async function createAnalysis(
  pair: TestSourcePair,
  git: GitService,
  copilot: CopilotBridge
): Promise<AnalysisResult> {
  const [testHistory, sourceHistory] = await Promise.all([
    git.getHistory(pair.test.filePath, 1).catch(() => []),
    git.getHistory(pair.source.filePath, 1).catch(() => []),
  ]);

  // Build expectations and behavior
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
    testExpectation = buildExpectationFromAssertions(pair.test as TestCase);
    codeBehavior = buildBehaviorFromMethod(pair.source as SourceMethod);
  }

  // Use advanced divergence detection (same as analyze command)
  const advancedResult = await detectDivergenceAdvanced(pair, copilot);
  let divergence = advancedResult.divergence;

  // Fallback to local detection if advanced finds nothing
  if (!divergence) {
    divergence = detectDivergence(pair, testExpectation, codeBehavior);
  }

  return {
    pair,
    testExpectation,
    codeBehavior,
    divergence,
    gitContext: {
      lastTestChange: testHistory[0]
        ? { ...testHistory[0], filesChanged: [] }
        : null,
      lastCodeChange: sourceHistory[0]
        ? { ...sourceHistory[0], filesChanged: [] }
        : null,
      recentCommits: [],
      blame: null,
    },
  };
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
  // Priority 1: Exception mismatch detection
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

  // Priority 2: Compare expected output vs return value (from AI analysis)
  if (expectation.expectedOutput && behavior.returnValue) {
    const expectedNorm = normalizeValue(expectation.expectedOutput);
    const actualNorm = normalizeValue(behavior.returnValue);

    if (expectedNorm !== actualNorm && expectedNorm !== "unknown" && actualNorm !== "unknown") {
      return {
        type: "RETURN_VALUE_MISMATCH",
        description: `Expected output doesn't match code behavior`,
        testLine: pair.test.lineNumber,
        codeLine: pair.source.lineNumber,
        expected: expectation.expectedOutput,
        actual: behavior.returnValue,
      };
    }
  }

  // Priority 3: Semantic comparison of descriptions
  const semanticDivergence = detectSemanticDivergence(
    expectation.expectedBehavior,
    behavior.actualBehavior,
    pair
  );
  if (semanticDivergence) {
    return semanticDivergence;
  }

  // Priority 4: Parse assertions from test body for numeric comparisons
  const assertionDivergence = detectAssertionDivergence(pair);
  if (assertionDivergence) {
    return assertionDivergence;
  }

  // No divergence detected
  return null;
}

function normalizeValue(value: string): string {
  if (!value) return "unknown";

  // Remove common wrappers
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/^["']|["']$/g, "");

  // Try to extract numeric value
  const numMatch = normalized.match(/(-?\d+\.?\d*)/);
  if (numMatch) {
    return numMatch[1];
  }

  // Return cleaned string
  return normalized;
}

function detectSemanticDivergence(
  expectedBehavior: string,
  actualBehavior: string,
  pair: TestSourcePair
): AnalysisResult["divergence"] | null {
  if (!expectedBehavior || !actualBehavior) return null;

  const expected = expectedBehavior.toLowerCase();
  const actual = actualBehavior.toLowerCase();

  // Look for percentage/discount mismatches
  const expectedPercent = expected.match(/(\d+)\s*%/);
  const actualPercent = actual.match(/(\d+)\s*%/);
  if (expectedPercent && actualPercent && expectedPercent[1] !== actualPercent[1]) {
    return {
      type: "RETURN_VALUE_MISMATCH",
      description: `Percentage mismatch: test expects ${expectedPercent[1]}%, code applies ${actualPercent[1]}%`,
      testLine: pair.test.lineNumber,
      codeLine: pair.source.lineNumber,
      expected: `${expectedPercent[1]}%`,
      actual: `${actualPercent[1]}%`,
    };
  }

  // Look for multiplier/factor mismatches (e.g., 0.90 vs 0.85)
  const expectedFactor = expected.match(/(\d+\.\d+)/);
  const actualFactor = actual.match(/(\d+\.\d+)/);
  if (expectedFactor && actualFactor && expectedFactor[1] !== actualFactor[1]) {
    return {
      type: "RETURN_VALUE_MISMATCH",
      description: `Value mismatch: test expects ${expectedFactor[1]}, code uses ${actualFactor[1]}`,
      testLine: pair.test.lineNumber,
      codeLine: pair.source.lineNumber,
      expected: expectedFactor[1],
      actual: actualFactor[1],
    };
  }

  return null;
}

function detectAssertionDivergence(
  pair: TestSourcePair
): AnalysisResult["divergence"] | null {
  const testBody = pair.test.body;

  // Read full source file to get class-level constants (not just method body)
  let sourceBody = pair.source.body;
  try {
    sourceBody = readFileSync(pair.source.filePath, "utf8");
  } catch {
    // Fall back to method body if file read fails
  }

  // Extract numeric assertions from test (expected values)
  const assertionPatterns = [
    /assertEquals\s*\(\s*(-?\d+\.?\d*)/g,
    /expect\s*\([^)]+\)\s*\.toBe\s*\(\s*(-?\d+\.?\d*)/g,
    /assert\.equal\s*\([^,]+,\s*(-?\d+\.?\d*)/g,
    /assertEqual\s*\([^,]+,\s*(-?\d+\.?\d*)/g,
    /toEqual\s*\(\s*(-?\d+\.?\d*)/g,
  ];

  const expectedValues: number[] = [];
  for (const pattern of assertionPatterns) {
    let match;
    while ((match = pattern.exec(testBody)) !== null) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) expectedValues.push(val);
    }
  }

  // Extract percentage/rate constants from source code
  const constantPatterns = [
    /(?:DISCOUNT|RATE|PERCENT)[A-Z_]*\s*=\s*(-?\d+\.?\d*)/gi,
    /(?:discount|rate|percent)\s*=\s*(-?\d+\.?\d*)/gi,
    /=\s*(-?\d+\.?\d*)\s*;\s*\/\/.*(?:discount|rate|percent)/gi,
  ];

  const sourceConstants: number[] = [];
  for (const pattern of constantPatterns) {
    let match;
    while ((match = pattern.exec(sourceBody)) !== null) {
      const val = parseFloat(match[1]);
      if (!isNaN(val)) sourceConstants.push(val);
    }
  }

  // Check for discount percentage mismatches
  for (const expectedVal of expectedValues) {
    if (expectedVal >= 80 && expectedVal <= 99) {
      const impliedDiscountPercent = 100 - expectedVal;

      for (const constant of sourceConstants) {
        if (constant > 0 && constant < 1) {
          const actualDiscountPercent = Math.round(constant * 100);

          if (actualDiscountPercent !== impliedDiscountPercent && Math.abs(actualDiscountPercent - impliedDiscountPercent) <= 20) {
            return {
              type: "RETURN_VALUE_MISMATCH",
              description: `Discount mismatch: test expects ${impliedDiscountPercent}% discount (result=${expectedVal}), but code applies ${actualDiscountPercent}% discount (${constant})`,
              testLine: pair.test.lineNumber,
              codeLine: pair.source.lineNumber,
              expected: `${expectedVal} (${impliedDiscountPercent}% discount)`,
              actual: `${100 - actualDiscountPercent} (${actualDiscountPercent}% discount)`,
            };
          }
        } else if (constant >= 1 && constant <= 50) {
          const actualDiscountPercent = constant;

          if (actualDiscountPercent !== impliedDiscountPercent && Math.abs(actualDiscountPercent - impliedDiscountPercent) <= 20) {
            return {
              type: "RETURN_VALUE_MISMATCH",
              description: `Discount mismatch: test expects ${impliedDiscountPercent}% discount (result=${expectedVal}), but code applies ${actualDiscountPercent}% discount`,
              testLine: pair.test.lineNumber,
              codeLine: pair.source.lineNumber,
              expected: `${expectedVal} (${impliedDiscountPercent}% discount)`,
              actual: `${100 - actualDiscountPercent} (${actualDiscountPercent}% discount)`,
            };
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// Fix Generation
// ============================================================================

async function generateFixSuggestions(
  results: DiagnosticResult[],
  _copilot: CopilotBridge,
  _copilotAvailable: boolean
): Promise<FixSuggestion[]> {
  const suggestions: FixSuggestion[] = [];

  for (const result of results) {
    // Only handle OUTDATED_TEST verdicts for now
    if (result.verdict.type !== "OUTDATED_TEST") continue;

    // Try to use pre-generated suggestedFix first
    if (result.verdict.recommendation.suggestedFix) {
      const fix = result.verdict.recommendation.suggestedFix;
      const lines = fix.split("\n");
      let originalLine = "";
      let suggestedLine = "";

      for (const line of lines) {
        if (line.startsWith("-") && !line.startsWith("---")) {
          originalLine = line.substring(1).trim();
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          suggestedLine = line.substring(1).trim();
        }
      }

      if (originalLine && suggestedLine) {
        suggestions.push({
          file: result.testFile,
          lineNumber: 0,
          originalLine,
          suggestedLine,
          reason: result.verdict.reason,
          verdictType: result.verdict.type,
        });
        continue;
      }
    }

    // Generate fix from the explanation (which contains the detailed divergence info)
    const explanation = result.verdict.explanation;

    // Pattern 1: "Value mismatch: test expects X but code uses Y"
    const valueMismatchMatch = explanation.match(/Value mismatch: test expects (\d+(?:\.\d+)?) but code uses (\d+(?:\.\d+)?)/i);
    if (valueMismatchMatch) {
      const expectedValue = valueMismatchMatch[1];
      const actualValue = valueMismatchMatch[2];

      try {
        const testContent = readFileSync(result.testFile, "utf8");
        const lines = testContent.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

          // Find assertion containing the expected value
          if (
            (line.includes("assertEquals") || line.includes("expect(") || line.includes(".toBe(") || line.includes(".toEqual(")) &&
            (line.includes(expectedValue) || line.includes(`${expectedValue}.0`))
          ) {
            const originalLine = line.trim();
            // Replace expected with actual (since code is correct and test is outdated)
            const suggestedLine = originalLine
              .replace(new RegExp(`${expectedValue}\\.0`, "g"), `${actualValue}.0`)
              .replace(new RegExp(`\\b${expectedValue}\\b`, "g"), actualValue);

            if (originalLine !== suggestedLine) {
              suggestions.push({
                file: result.testFile,
                lineNumber: i + 1,
                originalLine,
                suggestedLine,
                reason: `Update assertion: ${expectedValue} → ${actualValue}`,
                verdictType: result.verdict.type,
              });
              break;
            }
          }
        }
      } catch {
        // Can't read file
      }
      continue;
    }

    // Pattern 2: "Expected: X, Got: Y" from standard divergence info
    const expectedGotMatch = explanation.match(/Expected:\s*(\d+(?:\.\d+)?),\s*Got:\s*(\d+(?:\.\d+)?)/i);
    if (expectedGotMatch) {
      const expectedValue = expectedGotMatch[1];
      const actualValue = expectedGotMatch[2];

      try {
        const testContent = readFileSync(result.testFile, "utf8");
        const lines = testContent.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

          if (
            (line.includes("assertEquals") || line.includes("expect(") || line.includes(".toBe(") || line.includes(".toEqual(")) &&
            (line.includes(expectedValue) || line.includes(`${expectedValue}.0`))
          ) {
            const originalLine = line.trim();
            const suggestedLine = originalLine
              .replace(new RegExp(`${expectedValue}\\.0`, "g"), `${actualValue}.0`)
              .replace(new RegExp(`\\b${expectedValue}\\b`, "g"), actualValue);

            if (originalLine !== suggestedLine) {
              suggestions.push({
                file: result.testFile,
                lineNumber: i + 1,
                originalLine,
                suggestedLine,
                reason: `Update assertion: ${expectedValue} → ${actualValue}`,
                verdictType: result.verdict.type,
              });
              break;
            }
          }
        }
      } catch {
        // Can't read file
      }
      continue;
    }

    // Pattern 3: Legacy - "test expects X% discount (result=Y), but code applies Z% discount"
    const discountMatch = explanation.match(/test expects (\d+)% discount \(result=(\d+(?:\.\d+)?)\).*code applies (\d+)% discount/i);
    if (discountMatch) {
      const oldValue = discountMatch[2];
      const newDiscountPercent = parseInt(discountMatch[3], 10);
      const newValue = String(100 - newDiscountPercent);

      try {
        const testContent = readFileSync(result.testFile, "utf8");
        const lines = testContent.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;

          if (
            (line.includes("assertEquals") || line.includes("assertThat") || line.includes("expect(") || line.includes(".toBe(")) &&
            (line.includes(oldValue) || line.includes(`${oldValue}.0`))
          ) {
            const originalLine = line.trim();
            const suggestedLine = originalLine
              .replace(new RegExp(`${oldValue}\\.0`, "g"), `${newValue}.0`)
              .replace(new RegExp(`\\b${oldValue}\\b`, "g"), newValue);

            if (originalLine !== suggestedLine) {
              suggestions.push({
                file: result.testFile,
                lineNumber: i + 1,
                originalLine,
                suggestedLine,
                reason: `Update assertion: ${oldValue} → ${newValue} (${newDiscountPercent}% discount)`,
                verdictType: result.verdict.type,
              });
              break;
            }
          }
        }
      } catch {
        // Can't read file
      }
    }
  }

  return suggestions;
}

// ============================================================================
// Fix Application
// ============================================================================

async function applyFixes(suggestions: FixSuggestion[]): Promise<number> {
  let appliedCount = 0;

  // Group by file
  const byFile = new Map<string, FixSuggestion[]>();
  for (const suggestion of suggestions) {
    const existing = byFile.get(suggestion.file) ?? [];
    existing.push(suggestion);
    byFile.set(suggestion.file, existing);
  }

  for (const [filePath, fileSuggestions] of byFile) {
    try {
      let content = await readFile(filePath, "utf-8");
      let modified = false;

      for (const suggestion of fileSuggestions) {
        if (content.includes(suggestion.originalLine)) {
          content = content.replace(suggestion.originalLine, suggestion.suggestedLine);
          modified = true;
          appliedCount++;
        }
      }

      if (modified) {
        await writeFile(filePath, content, "utf-8");
      }
    } catch {
      // Skip files that can't be modified
    }
  }

  return appliedCount;
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
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
