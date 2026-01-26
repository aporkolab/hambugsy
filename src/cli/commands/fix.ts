import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { resolve } from "path";
import { readFile, writeFile } from "fs/promises";
import { createInterface } from "readline";
import { JavaParser } from "../../parser/java/parser.js";
import { TypeScriptParser } from "../../parser/typescript/parser.js";
import { PythonParser } from "../../parser/python/parser.js";
import { CopilotBridge, getCopilotBridge } from "../../services/copilot.js";
import { GitService, getGitService } from "../../services/git.js";
import { createVerdictEngine } from "../../verdict/engine.js";
import type { DiagnosticResult, AnalysisResult, TestSourcePair } from "../../core/types.js";

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

async function analyzeFiles(
  basePath: string,
  options: FixOptions,
  copilot: CopilotBridge,
  spinner: ReturnType<typeof ora>
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

  const git = getGitService(resolvedPath);
  const verdictEngine = createVerdictEngine(copilot, git);
  const results: DiagnosticResult[] = [];

  for (const file of files) {
    try {
      const pairs = await parseAndCorrelate(file);

      for (const pair of pairs) {
        const analysis = await createAnalysis(pair, git);
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
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return results;
}

async function parseAndCorrelate(filePath: string): Promise<TestSourcePair[]> {
  const ext = filePath.split(".").pop()?.toLowerCase();
  let tests: Array<{ name: string; filePath: string; lineNumber: number; endLine: number; framework: string; assertions: Array<{ type: string; expected: string | null; actual: string | null; lineNumber: number; raw: string }>; body: string }> = [];
  let methods: Array<{ name: string; filePath: string; lineNumber: number; endLine: number; parameters: Array<{ name: string; type: string; defaultValue?: string }>; returnType: string; body: string; className?: string }> = [];

  if (ext === "java") {
    const parser = new JavaParser(filePath);
    const result = await parser.parseFile();
    tests = result.tests;
    methods = result.methods;
  } else if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
    const parser = new TypeScriptParser(filePath);
    const result = await parser.parseFile();
    tests = result.tests;
    methods = result.methods;
  } else if (ext === "py") {
    const parser = new PythonParser(filePath);
    const result = await parser.parseFile();
    tests = result.tests;
    methods = result.methods;
  }

  // Simple correlation by name
  const pairs: TestSourcePair[] = [];

  for (const test of tests) {
    const testNameLower = test.name.toLowerCase();

    for (const method of methods) {
      const methodNameLower = method.name.toLowerCase();

      if (
        testNameLower.includes(methodNameLower) ||
        test.body.includes(`${method.name}(`)
      ) {
        pairs.push({
          test: test as TestSourcePair["test"],
          source: method as TestSourcePair["source"],
          confidence: 0.8,
          correlationType: "NAMING_CONVENTION",
        });
      }
    }
  }

  return pairs;
}

async function createAnalysis(
  pair: TestSourcePair,
  git: GitService
): Promise<AnalysisResult> {
  const [testHistory, sourceHistory] = await Promise.all([
    git.getHistory(pair.test.filePath, 1).catch(() => []),
    git.getHistory(pair.source.filePath, 1).catch(() => []),
  ]);

  return {
    pair,
    testExpectation: {
      description: "Test expectation",
      expectedBehavior: "",
      inputValues: [],
      expectedOutput: null,
      expectedExceptions: [],
    },
    codeBehavior: {
      description: "Code behavior",
      actualBehavior: "",
      codePathTaken: [],
      returnValue: null,
      thrownExceptions: [],
    },
    divergence: null,
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
    if (!result.verdict.recommendation.suggestedFix) continue;

    const fix = result.verdict.recommendation.suggestedFix;

    // Parse the fix to extract line changes
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
      const targetFile =
        result.verdict.type === "OUTDATED_TEST"
          ? result.testFile
          : result.verdict.recommendation.affectedFiles[0] ?? result.testFile;

      suggestions.push({
        file: targetFile,
        lineNumber: 0, // Will be found when applying
        originalLine,
        suggestedLine,
        reason: result.verdict.reason,
        verdictType: result.verdict.type,
      });
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
