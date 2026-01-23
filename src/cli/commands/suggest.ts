import { Command } from "commander";
import ora, { Ora } from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { resolve, relative, join, dirname, basename } from "path";
import { mkdir, writeFile } from "fs/promises";
import { JavaParser, JavaParseResult } from "../../parser/java/parser.js";
import { CopilotBridge, getCopilotBridge } from "../../services/copilot.js";
import type {
  SourceMethod,
  TestCase,
  MissingTest,
  MissingTestPattern,
  Priority,
} from "../../core/types.js";

// ============================================================================
// Types
// ============================================================================

interface SuggestOptions {
  recursive?: boolean;
  format?: "console" | "json";
  generate?: boolean;
  priority?: "critical" | "high" | "medium" | "all";
  output?: string;
}

interface MethodCoverage {
  method: SourceMethod;
  testedPatterns: TestedPattern[];
  missingPatterns: MissingPattern[];
  suggestions: MissingTest[];
}

interface TestedPattern {
  pattern: string;
  testName: string;
  description: string;
}

interface MissingPattern {
  pattern: MissingTestPattern;
  priority: Priority;
  description: string;
  reason: string;
}

interface SuggestResult {
  totalMethods: number;
  coveredMethods: number;
  partiallyCovered: number;
  uncoveredMethods: number;
  coverageByMethod: MethodCoverage[];
  generatedFiles: string[];
}

// ============================================================================
// Suggest Command
// ============================================================================

export const suggestCommand = new Command("suggest")
  .description("Find missing tests and generate test suggestions")
  .argument("[path]", "Path to project directory", ".")
  .option("-r, --recursive", "Recursively search for files", true)
  .option("--format <format>", "Output format: console or json", "console")
  .option("-g, --generate", "Generate test files for missing tests")
  .option(
    "-p, --priority <level>",
    "Minimum priority: critical, high, medium, or all",
    "all"
  )
  .option("-o, --output <dir>", "Output directory for generated tests")
  .action(async (path: string, options: SuggestOptions) => {
    const exitCode = await runSuggest(path, options);
    process.exit(exitCode);
  });

// ============================================================================
// Main Suggest Flow
// ============================================================================

async function runSuggest(path: string, options: SuggestOptions): Promise<number> {
  const spinner = ora();

  try {
    // 1. Check Copilot
    spinner.start("Checking GitHub Copilot CLI...");
    const copilot = getCopilotBridge();
    const copilotAvailable = await copilot.checkAvailability();

    if (copilotAvailable) {
      spinner.succeed("GitHub Copilot CLI available");
    } else {
      spinner.warn("GitHub Copilot CLI not found - using pattern-based detection only");
    }

    // 2. Discover files
    spinner.start("Discovering files...");
    const files = await discoverFiles(path, options.recursive ?? true);

    if (files.length === 0) {
      spinner.warn("No Java files found");
      return 0;
    }

    spinner.succeed(`Found ${files.length} Java file(s)`);

    // 3. Parse files
    const { sourceFiles, testFiles } = await parseFiles(files, spinner);

    // 4. Analyze coverage
    spinner.start("Analyzing test coverage...");
    const coverage = await analyzeCoverage(
      sourceFiles,
      testFiles,
      copilot,
      copilotAvailable,
      spinner
    );

    // 5. Filter by priority
    const filteredCoverage = filterByPriority(coverage, options.priority ?? "all");

    // 6. Output results
    const result = buildResult(filteredCoverage);

    if (options.format === "json") {
      outputJson(result);
    } else {
      outputConsole(result, spinner);
    }

    // 7. Generate test files if requested
    if (options.generate) {
      await generateTestFiles(result, options.output ?? path, spinner);
    }

    // Return 1 if there are critical missing tests
    const hasCritical = result.coverageByMethod.some((c) =>
      c.missingPatterns.some((p) => p.priority === "CRITICAL")
    );

    return hasCritical ? 1 : 0;
  } catch (error) {
    spinner.fail("Suggest failed");
    console.error(chalk.red(error instanceof Error ? error.message : "Unknown error"));
    return 1;
  }
}

// ============================================================================
// File Discovery & Parsing
// ============================================================================

async function discoverFiles(basePath: string, recursive: boolean): Promise<string[]> {
  const resolvedPath = resolve(basePath);
  const pattern = recursive ? "**/*.java" : "*.java";

  return glob(pattern, {
    cwd: resolvedPath,
    absolute: true,
    ignore: ["**/node_modules/**", "**/build/**", "**/target/**", "**/.git/**"],
  });
}

async function parseFiles(
  files: string[],
  spinner: Ora
): Promise<{ sourceFiles: Map<string, JavaParseResult>; testFiles: Map<string, JavaParseResult> }> {
  const sourceFiles = new Map<string, JavaParseResult>();
  const testFiles = new Map<string, JavaParseResult>();

  spinner.start(`Parsing ${files.length} files...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    spinner.text = `Parsing [${i + 1}/${files.length}] ${relative(process.cwd(), file)}`;

    try {
      const parser = new JavaParser(file);
      const result = await parser.parseFile();

      if (result.tests.length > 0) {
        testFiles.set(file, result);
      }
      if (result.methods.length > 0) {
        sourceFiles.set(file, result);
      }
    } catch {
      // Skip unparseable files
    }
  }

  spinner.succeed(`Parsed ${sourceFiles.size} source file(s) and ${testFiles.size} test file(s)`);
  return { sourceFiles, testFiles };
}

// ============================================================================
// Coverage Analysis
// ============================================================================

async function analyzeCoverage(
  sourceFiles: Map<string, JavaParseResult>,
  testFiles: Map<string, JavaParseResult>,
  copilot: CopilotBridge,
  copilotAvailable: boolean,
  spinner: Ora
): Promise<MethodCoverage[]> {
  const coverage: MethodCoverage[] = [];

  // Collect all tests
  const allTests: TestCase[] = [];
  for (const result of testFiles.values()) {
    allTests.push(...result.tests);
  }

  // Collect all source methods
  const allMethods: SourceMethod[] = [];
  for (const result of sourceFiles.values()) {
    allMethods.push(...result.methods);
  }

  spinner.start(`Analyzing ${allMethods.length} methods...`);

  for (let i = 0; i < allMethods.length; i++) {
    const method = allMethods[i];
    spinner.text = `Analyzing [${i + 1}/${allMethods.length}] ${method.name}`;

    // Find tests for this method
    const relatedTests = findRelatedTests(method, allTests);

    // Analyze what's tested
    const testedPatterns = analyzeTestedPatterns(method, relatedTests);

    // Detect missing patterns
    const missingPatterns = detectMissingPatterns(method, testedPatterns);

    // Get AI suggestions if available
    let suggestions: MissingTest[] = [];
    if (copilotAvailable && missingPatterns.length > 0) {
      try {
        suggestions = await copilot.suggestMissingTests(method.body, method.filePath);
      } catch {
        // Continue without AI suggestions
      }
    }

    // If no AI suggestions, create basic ones from patterns
    if (suggestions.length === 0 && missingPatterns.length > 0) {
      suggestions = createBasicSuggestions(method, missingPatterns);
    }

    coverage.push({
      method,
      testedPatterns,
      missingPatterns,
      suggestions,
    });
  }

  spinner.succeed(`Analyzed ${allMethods.length} method(s)`);
  return coverage;
}

function findRelatedTests(method: SourceMethod, tests: TestCase[]): TestCase[] {
  const methodName = method.name.toLowerCase();

  return tests.filter((test) => {
    const testName = test.name.toLowerCase();

    // Check naming convention
    if (
      testName.includes(methodName) ||
      testName.replace(/^test_?/i, "").includes(methodName)
    ) {
      return true;
    }

    // Check if test body calls this method
    if (test.body.includes(`${method.name}(`)) {
      return true;
    }

    return false;
  });
}

function analyzeTestedPatterns(_method: SourceMethod, tests: TestCase[]): TestedPattern[] {
  const patterns: TestedPattern[] = [];

  for (const test of tests) {
    const testBody = test.body.toLowerCase();

    // Check for happy path
    if (test.assertions.some((a) => a.type === "equals")) {
      patterns.push({
        pattern: "HAPPY_PATH",
        testName: test.name,
        description: "Basic functionality test",
      });
    }

    // Check for null tests
    if (testBody.includes("null")) {
      patterns.push({
        pattern: "NULL_CHECK",
        testName: test.name,
        description: "Null input handling",
      });
    }

    // Check for exception tests
    if (test.assertions.some((a) => a.type === "throws")) {
      patterns.push({
        pattern: "EXCEPTION",
        testName: test.name,
        description: "Exception handling",
      });
    }

    // Check for empty collection tests
    if (
      testBody.includes("empty") ||
      testBody.includes("collections.emptylist") ||
      testBody.includes("list.of()")
    ) {
      patterns.push({
        pattern: "EMPTY_COLLECTION",
        testName: test.name,
        description: "Empty collection handling",
      });
    }

    // Check for boundary tests
    if (
      testBody.includes("0") ||
      testBody.includes("-1") ||
      testBody.includes("max") ||
      testBody.includes("min")
    ) {
      patterns.push({
        pattern: "BOUNDARY",
        testName: test.name,
        description: "Boundary value testing",
      });
    }
  }

  return patterns;
}

function detectMissingPatterns(
  method: SourceMethod,
  testedPatterns: TestedPattern[]
): MissingPattern[] {
  const missing: MissingPattern[] = [];
  const testedTypes = new Set(testedPatterns.map((p) => p.pattern));

  // Check for null parameter handling
  if (hasNullableParameters(method) && !testedTypes.has("NULL_CHECK")) {
    missing.push({
      pattern: "NULL_CHECK",
      priority: "CRITICAL",
      description: "No test for null input",
      reason: `Method ${method.name} has parameters that could be null`,
    });
  }

  // Check for collection parameter handling
  if (hasCollectionParameters(method) && !testedTypes.has("EMPTY_COLLECTION")) {
    missing.push({
      pattern: "EMPTY_COLLECTION",
      priority: "HIGH",
      description: "No test for empty collection",
      reason: `Method ${method.name} takes collection parameters`,
    });
  }

  // Check for numeric boundary handling
  if (hasNumericParameters(method) && !testedTypes.has("BOUNDARY")) {
    missing.push({
      pattern: "BOUNDARY",
      priority: "MEDIUM",
      description: "No test for boundary values (0, -1, MAX_VALUE)",
      reason: `Method ${method.name} has numeric parameters`,
    });
  }

  // Check for exception handling
  if (canThrowExceptions(method) && !testedTypes.has("EXCEPTION")) {
    missing.push({
      pattern: "EXCEPTION",
      priority: "CRITICAL",
      description: "No test for exception scenarios",
      reason: `Method ${method.name} can throw exceptions`,
    });
  }

  // Check for async error handling
  if (isAsyncMethod(method) && !testedTypes.has("ASYNC_ERROR")) {
    missing.push({
      pattern: "EDGE_CASE",
      priority: "HIGH",
      description: "No test for async rejection/error",
      reason: `Method ${method.name} is async but no error test found`,
    });
  }

  return missing;
}

// ============================================================================
// Parameter Analysis Helpers
// ============================================================================

function hasNullableParameters(method: SourceMethod): boolean {
  return method.parameters.some(
    (p) => !isPrimitive(p.type) && !p.type.includes("@NonNull")
  );
}

function hasCollectionParameters(method: SourceMethod): boolean {
  const collectionTypes = ["list", "set", "map", "collection", "array", "[]"];
  return method.parameters.some((p) =>
    collectionTypes.some((t) => p.type.toLowerCase().includes(t))
  );
}

function hasNumericParameters(method: SourceMethod): boolean {
  const numericTypes = ["int", "long", "double", "float", "short", "byte", "integer"];
  return method.parameters.some((p) =>
    numericTypes.some((t) => p.type.toLowerCase().includes(t))
  );
}

function canThrowExceptions(method: SourceMethod): boolean {
  return (
    method.body.includes("throw ") ||
    method.body.includes("throws") ||
    method.body.includes(".get(") ||
    method.body.includes("parseInt") ||
    method.body.includes("parseDouble")
  );
}

function isAsyncMethod(method: SourceMethod): boolean {
  return (
    method.returnType.includes("CompletableFuture") ||
    method.returnType.includes("Future") ||
    method.returnType.includes("Mono") ||
    method.returnType.includes("Flux") ||
    method.body.includes("async") ||
    method.body.includes("await")
  );
}

function isPrimitive(type: string): boolean {
  const primitives = ["int", "long", "double", "float", "boolean", "char", "short", "byte"];
  return primitives.includes(type.toLowerCase());
}

// ============================================================================
// Suggestion Generation
// ============================================================================

function createBasicSuggestions(
  method: SourceMethod,
  missingPatterns: MissingPattern[]
): MissingTest[] {
  return missingPatterns.map((pattern) => ({
    methodName: method.name,
    filePath: method.filePath,
    lineNumber: method.lineNumber,
    pattern: pattern.pattern,
    priority: pattern.priority,
    suggestedTest: generateTestCode(method, pattern),
    rationale: pattern.reason,
  }));
}

function generateTestCode(method: SourceMethod, pattern: MissingPattern): string {
  const className = method.className ?? "Unknown";
  const testMethodName = `test${capitalize(method.name)}_${pattern.pattern.toLowerCase()}`;

  switch (pattern.pattern) {
    case "NULL_CHECK":
      return generateNullCheckTest(method, className, testMethodName);
    case "EMPTY_COLLECTION":
      return generateEmptyCollectionTest(method, className, testMethodName);
    case "BOUNDARY":
      return generateBoundaryTest(method, className, testMethodName);
    case "EXCEPTION":
      return generateExceptionTest(method, className, testMethodName);
    default:
      return generateGenericTest(method, className, testMethodName, pattern.description);
  }
}

function generateNullCheckTest(
  method: SourceMethod,
  className: string,
  testMethodName: string
): string {
  return `@Test
void ${testMethodName}() {
    ${className} instance = new ${className}();

    assertThrows(NullPointerException.class, () -> {
        instance.${method.name}(null${method.parameters.length > 1 ? ", ..." : ""});
    });
}`;
}

function generateEmptyCollectionTest(
  method: SourceMethod,
  className: string,
  testMethodName: string
): string {
  return `@Test
void ${testMethodName}() {
    ${className} instance = new ${className}();

    var result = instance.${method.name}(Collections.emptyList()${method.parameters.length > 1 ? ", ..." : ""});

    // TODO: Assert expected behavior for empty collection
    assertNotNull(result);
}`;
}

function generateBoundaryTest(
  method: SourceMethod,
  className: string,
  testMethodName: string
): string {
  return `@Test
void ${testMethodName}() {
    ${className} instance = new ${className}();

    // Test with zero
    var resultZero = instance.${method.name}(0${method.parameters.length > 1 ? ", ..." : ""});
    // TODO: Assert expected behavior

    // Test with negative
    var resultNegative = instance.${method.name}(-1${method.parameters.length > 1 ? ", ..." : ""});
    // TODO: Assert expected behavior

    // Test with max value
    var resultMax = instance.${method.name}(Integer.MAX_VALUE${method.parameters.length > 1 ? ", ..." : ""});
    // TODO: Assert expected behavior
}`;
}

function generateExceptionTest(
  method: SourceMethod,
  className: string,
  testMethodName: string
): string {
  return `@Test
void ${testMethodName}() {
    ${className} instance = new ${className}();

    assertThrows(Exception.class, () -> {
        // TODO: Provide input that triggers exception
        instance.${method.name}(/* invalid input */);
    });
}`;
}

function generateGenericTest(
  method: SourceMethod,
  className: string,
  testMethodName: string,
  description: string
): string {
  return `@Test
void ${testMethodName}() {
    // TODO: ${description}
    ${className} instance = new ${className}();

    var result = instance.${method.name}(/* TODO: add parameters */);

    // TODO: Add assertions
    assertNotNull(result);
}`;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// Filtering
// ============================================================================

function filterByPriority(
  coverage: MethodCoverage[],
  priority: string
): MethodCoverage[] {
  if (priority === "all") {
    return coverage;
  }

  const priorityOrder: Record<string, number> = {
    CRITICAL: 3,
    HIGH: 2,
    MEDIUM: 1,
    LOW: 0,
  };

  const minPriority = priorityOrder[priority.toUpperCase()] ?? 0;

  return coverage
    .map((c) => ({
      ...c,
      missingPatterns: c.missingPatterns.filter(
        (p) => priorityOrder[p.priority] >= minPriority
      ),
      suggestions: c.suggestions.filter(
        (s) => priorityOrder[s.priority] >= minPriority
      ),
    }))
    .filter((c) => c.missingPatterns.length > 0 || c.testedPatterns.length > 0);
}

// ============================================================================
// Result Building
// ============================================================================

function buildResult(coverage: MethodCoverage[]): SuggestResult {
  const coveredMethods = coverage.filter(
    (c) => c.testedPatterns.length > 0 && c.missingPatterns.length === 0
  ).length;

  const partiallyCovered = coverage.filter(
    (c) => c.testedPatterns.length > 0 && c.missingPatterns.length > 0
  ).length;

  const uncoveredMethods = coverage.filter(
    (c) => c.testedPatterns.length === 0 && c.missingPatterns.length > 0
  ).length;

  return {
    totalMethods: coverage.length,
    coveredMethods,
    partiallyCovered,
    uncoveredMethods,
    coverageByMethod: coverage.filter((c) => c.missingPatterns.length > 0),
    generatedFiles: [],
  };
}

// ============================================================================
// Output
// ============================================================================

function outputConsole(result: SuggestResult, _spinner: Ora): void {
  console.log();
  console.log(chalk.bold("=== Test Coverage Analysis ==="));
  console.log();
  console.log(`Total methods:     ${result.totalMethods}`);
  console.log(chalk.green(`Fully covered:     ${result.coveredMethods}`));
  console.log(chalk.yellow(`Partially covered: ${result.partiallyCovered}`));
  console.log(chalk.red(`Uncovered:         ${result.uncoveredMethods}`));
  console.log();

  if (result.coverageByMethod.length === 0) {
    console.log(chalk.green("All methods have adequate test coverage!"));
    return;
  }

  console.log(chalk.bold("=== Missing Tests ==="));
  console.log();

  for (const coverage of result.coverageByMethod) {
    const { method, testedPatterns, missingPatterns, suggestions } = coverage;

    // Method header
    console.log(
      chalk.cyan(`📍 ${method.name}()`) +
        chalk.gray(` @ ${relative(process.cwd(), method.filePath)}:${method.lineNumber}`)
    );

    // Tested patterns
    for (const tested of testedPatterns) {
      console.log(chalk.green(`├── ✅ TESTED: ${tested.description}`));
    }

    // Missing patterns
    for (let i = 0; i < missingPatterns.length; i++) {
      const missing = missingPatterns[i];
      const isLast = i === missingPatterns.length - 1 && suggestions.length === 0;
      const prefix = isLast ? "└──" : "├──";

      const priorityColor =
        missing.priority === "CRITICAL"
          ? chalk.red
          : missing.priority === "HIGH"
            ? chalk.yellow
            : chalk.gray;

      console.log(
        chalk.red(`${prefix} ❌ MISSING: ${missing.description}`) +
          priorityColor(` (${missing.priority})`)
      );
    }

    // Show first suggestion
    if (suggestions.length > 0) {
      const suggestion = suggestions[0];
      console.log();
      console.log(chalk.magenta("└── 💡 SUGGESTED TEST:"));
      console.log(chalk.gray("    " + suggestion.suggestedTest.split("\n").join("\n    ")));
    }

    console.log();
  }

  // Summary
  const criticalCount = result.coverageByMethod.reduce(
    (sum, c) => sum + c.missingPatterns.filter((p) => p.priority === "CRITICAL").length,
    0
  );

  if (criticalCount > 0) {
    console.log(chalk.red.bold(`⚠️  ${criticalCount} CRITICAL missing test(s) found!`));
  }
}

function outputJson(result: SuggestResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// ============================================================================
// Test File Generation
// ============================================================================

async function generateTestFiles(
  result: SuggestResult,
  outputDir: string,
  spinner: Ora
): Promise<void> {
  if (result.coverageByMethod.length === 0) {
    return;
  }

  spinner.start("Generating test files...");

  const generatedFiles: string[] = [];

  // Group suggestions by source file
  const byFile = new Map<string, MissingTest[]>();

  for (const coverage of result.coverageByMethod) {
    for (const suggestion of coverage.suggestions) {
      const existing = byFile.get(suggestion.filePath) ?? [];
      existing.push(suggestion);
      byFile.set(suggestion.filePath, existing);
    }
  }

  // Generate test file for each source file
  for (const [sourceFile, suggestions] of byFile) {
    const testFileName = generateTestFileName(sourceFile);
    const testFilePath = join(resolve(outputDir), "generated-tests", testFileName);

    const testFileContent = generateTestFileContent(sourceFile, suggestions);

    // Create directory if needed
    await mkdir(dirname(testFilePath), { recursive: true });

    // Write file
    await writeFile(testFilePath, testFileContent, "utf-8");
    generatedFiles.push(testFilePath);
  }

  result.generatedFiles = generatedFiles;

  spinner.succeed(`Generated ${generatedFiles.length} test file(s)`);

  for (const file of generatedFiles) {
    console.log(chalk.green(`  📝 ${relative(process.cwd(), file)}`));
  }
}

function generateTestFileName(sourceFile: string): string {
  const baseName = basename(sourceFile, ".java");
  return `${baseName}GeneratedTest.java`;
}

function generateTestFileContent(sourceFile: string, suggestions: MissingTest[]): string {
  const className = basename(sourceFile, ".java");

  const tests = suggestions.map((s) => s.suggestedTest).join("\n\n    ");

  return `// Generated by Hambugsy - Missing Test Suggestions
// Source: ${sourceFile}
// Generated: ${new Date().toISOString()}

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.Collections;

class ${className}GeneratedTest {

    ${tests}
}
`;
}
