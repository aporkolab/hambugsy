import { execa } from "execa";
import path from "path";
import fs from "fs";

// ============================================================================
// Types
// ============================================================================

export interface TestResult {
  name: string;
  status: "passed" | "failed" | "skipped" | "error";
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
  file?: string;
  line?: number;
}

export interface TestRunResult {
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: TestResult[];
  rawOutput: string;
}

export type TestFramework = "jest" | "vitest" | "mocha" | "junit" | "pytest" | "unittest" | "go" | "cargo" | "dotnet";

// ============================================================================
// TestRunner
// ============================================================================

export class TestRunner {
  private readonly cwd: string;
  private readonly timeout: number;

  constructor(options?: { cwd?: string; timeout?: number }) {
    // Find project root (where package.json, pom.xml, etc. exists)
    this.cwd = this.findProjectRoot(options?.cwd ?? process.cwd());
    this.timeout = options?.timeout ?? 120000; // 2 minutes default
  }

  /**
   * Find the project root by looking for package.json, pom.xml, etc.
   * Walks up the directory tree from the given path.
   */
  private findProjectRoot(startPath: string): string {
    let current = startPath;
    const rootIndicators = [
      "package.json",
      "pom.xml",
      "build.gradle",
      "build.gradle.kts",
      "pyproject.toml",
      "setup.py",
      "pytest.ini",
    ];

    while (current !== path.dirname(current)) {
      for (const indicator of rootIndicators) {
        if (fs.existsSync(path.join(current, indicator))) {
          return current;
        }
      }
      current = path.dirname(current);
    }

    // Fallback to original path if no project root found
    return startPath;
  }

  // ==========================================================================
  // Framework Detection
  // ==========================================================================

  /**
   * Detect which test framework is used in the project
   */
  async detectFramework(): Promise<TestFramework | null> {
    // Check package.json for JS/TS projects
    const packageJsonPath = path.join(this.cwd, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      if (allDeps.vitest) return "vitest";
      if (allDeps.jest) return "jest";
      if (allDeps.mocha) return "mocha";
    }

    // Check for Maven/Gradle (Java)
    if (fs.existsSync(path.join(this.cwd, "pom.xml"))) return "junit";
    if (fs.existsSync(path.join(this.cwd, "build.gradle"))) return "junit";
    if (fs.existsSync(path.join(this.cwd, "build.gradle.kts"))) return "junit";

    // Check for Python
    if (fs.existsSync(path.join(this.cwd, "pytest.ini"))) return "pytest";
    if (fs.existsSync(path.join(this.cwd, "setup.py"))) return "pytest";
    if (fs.existsSync(path.join(this.cwd, "pyproject.toml"))) return "pytest";

    // Check for Go
    if (fs.existsSync(path.join(this.cwd, "go.mod"))) return "go";

    // Check for Rust
    if (fs.existsSync(path.join(this.cwd, "Cargo.toml"))) return "cargo";

    // Check for .NET/C#
    const csprojFiles = fs.readdirSync(this.cwd).filter(f => f.endsWith(".csproj"));
    if (csprojFiles.length > 0) return "dotnet";
    if (fs.existsSync(path.join(this.cwd, "*.sln"))) return "dotnet";

    return null;
  }

  // ==========================================================================
  // Test Execution
  // ==========================================================================

  /**
   * Run all tests and return results
   */
  async runTests(framework?: TestFramework): Promise<TestRunResult> {
    const detectedFramework = framework ?? (await this.detectFramework());

    if (!detectedFramework) {
      throw new Error(
        "Could not detect test framework. Supported: jest, vitest, mocha, junit (maven), pytest"
      );
    }

    switch (detectedFramework) {
      case "jest":
        return this.runJest();
      case "vitest":
        return this.runVitest();
      case "mocha":
        return this.runMocha();
      case "junit":
        return this.runJUnit();
      case "pytest":
        return this.runPytest();
      case "unittest":
        return this.runUnittest();
      case "go":
        return this.runGoTest();
      case "cargo":
        return this.runCargoTest();
      case "dotnet":
        return this.runDotnetTest();
      default:
        throw new Error(`Unsupported test framework: ${detectedFramework}`);
    }
  }

  /**
   * Run a specific test file
   */
  async runTestFile(filePath: string, framework?: TestFramework): Promise<TestRunResult> {
    const detectedFramework = framework ?? (await this.detectFramework());

    if (!detectedFramework) {
      throw new Error("Could not detect test framework");
    }

    switch (detectedFramework) {
      case "jest":
        return this.runJest(filePath);
      case "vitest":
        return this.runVitest(filePath);
      case "mocha":
        return this.runMocha(filePath);
      case "junit":
        return this.runJUnit(filePath);
      case "pytest":
        return this.runPytest(filePath);
      case "go":
        return this.runGoTest(filePath);
      case "cargo":
        return this.runCargoTest(filePath);
      case "dotnet":
        return this.runDotnetTest(filePath);
      default:
        throw new Error(`Unsupported test framework: ${detectedFramework}`);
    }
  }

  // ==========================================================================
  // Framework-Specific Runners
  // ==========================================================================

  private async runJest(testFile?: string): Promise<TestRunResult> {
    const args = ["--json", "--testLocationInResults"];
    if (testFile) {
      args.push(testFile);
    }

    try {
      const { stdout, stderr } = await execa("npx", ["jest", ...args], {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseJestOutput(stdout || stderr);
    } catch (error) {
      return this.createErrorResult("jest", error);
    }
  }

  private async runVitest(testFile?: string): Promise<TestRunResult> {
    const args = ["run", "--reporter=json"];
    if (testFile) {
      args.push(testFile);
    }

    try {
      const { stdout, stderr } = await execa("npx", ["vitest", ...args], {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseVitestOutput(stdout || stderr);
    } catch (error) {
      return this.createErrorResult("vitest", error);
    }
  }

  private async runMocha(testFile?: string): Promise<TestRunResult> {
    const args = ["--reporter=json"];
    if (testFile) {
      args.push(testFile);
    }

    try {
      const { stdout, stderr } = await execa("npx", ["mocha", ...args], {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseMochaOutput(stdout || stderr);
    } catch (error) {
      return this.createErrorResult("mocha", error);
    }
  }

  private async runJUnit(testFile?: string): Promise<TestRunResult> {
    // Try Maven first, then Gradle
    const hasMaven = fs.existsSync(path.join(this.cwd, "pom.xml"));

    if (hasMaven) {
      return this.runMavenTest(testFile);
    } else {
      return this.runGradleTest(testFile);
    }
  }

  private async runMavenTest(testFile?: string): Promise<TestRunResult> {
    const args = ["test", "-q"];
    if (testFile) {
      const className = path.basename(testFile, ".java");
      args.push(`-Dtest=${className}`);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("mvn", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseMavenOutput(stdout + stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("junit", error);
    }
  }

  private async runGradleTest(testFile?: string): Promise<TestRunResult> {
    const args = ["test", "--quiet"];
    if (testFile) {
      const className = path.basename(testFile, ".java");
      args.push(`--tests`, className);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("./gradlew", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseGradleOutput(stdout + stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("junit", error);
    }
  }

  private async runPytest(testFile?: string): Promise<TestRunResult> {
    const args = ["--tb=short", "-v", "--json-report", "--json-report-file=-"];
    if (testFile) {
      args.push(testFile);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("pytest", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parsePytestOutput(stdout || stderr, exitCode);
    } catch (error) {
      // Fallback to basic pytest
      return this.runPytestBasic(testFile);
    }
  }

  private async runPytestBasic(testFile?: string): Promise<TestRunResult> {
    const args = ["-v"];
    if (testFile) {
      args.push(testFile);
    }

    try {
      const { stdout, stderr } = await execa("pytest", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parsePytestBasicOutput(stdout + stderr);
    } catch (error) {
      return this.createErrorResult("pytest", error);
    }
  }

  private async runUnittest(testFile?: string): Promise<TestRunResult> {
    const args = ["-m", "unittest"];
    if (testFile) {
      args.push(testFile);
    } else {
      args.push("discover");
    }

    try {
      const { stdout, stderr, exitCode } = await execa("python", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseUnittestOutput(stdout + stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("unittest", error);
    }
  }

  private async runGoTest(testFile?: string): Promise<TestRunResult> {
    const args = ["test", "-v", "-json"];
    if (testFile) {
      // Go test requires package path, not file path
      const dir = path.dirname(testFile);
      args.push(dir === "." ? "./..." : `./${dir}/...`);
    } else {
      args.push("./...");
    }

    try {
      const { stdout, stderr, exitCode } = await execa("go", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseGoTestOutput(stdout || stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("go", error);
    }
  }

  private async runCargoTest(testFile?: string): Promise<TestRunResult> {
    const args = ["test", "--", "--format=json", "-Z", "unstable-options"];
    if (testFile) {
      // Extract test name from file path
      const testName = path.basename(testFile, ".rs");
      args.splice(1, 0, testName);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("cargo", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
        env: { ...process.env, CARGO_TERM_COLOR: "never" },
      });

      return this.parseCargoTestOutput(stdout + stderr, exitCode);
    } catch (error) {
      // Fallback to basic cargo test
      return this.runCargoTestBasic(testFile);
    }
  }

  private async runCargoTestBasic(testFile?: string): Promise<TestRunResult> {
    const args = ["test"];
    if (testFile) {
      const testName = path.basename(testFile, ".rs");
      args.push(testName);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("cargo", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
        env: { ...process.env, CARGO_TERM_COLOR: "never" },
      });

      return this.parseCargoTestBasicOutput(stdout + stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("cargo", error);
    }
  }

  private async runDotnetTest(testFile?: string): Promise<TestRunResult> {
    const args = ["test", "--logger", "trx;LogFileName=test-results.trx", "--no-build"];
    if (testFile) {
      // Filter by class or namespace
      const className = path.basename(testFile, ".cs");
      args.push("--filter", `FullyQualifiedName~${className}`);
    }

    try {
      const { stdout, stderr, exitCode } = await execa("dotnet", args, {
        cwd: this.cwd,
        timeout: this.timeout,
        reject: false,
      });

      return this.parseDotnetTestOutput(stdout + stderr, exitCode);
    } catch (error) {
      return this.createErrorResult("dotnet", error);
    }
  }

  // ==========================================================================
  // Output Parsers
  // ==========================================================================

  private parseJestOutput(output: string): TestRunResult {
    try {
      const json = JSON.parse(output);
      const results: TestResult[] = [];

      for (const testFile of json.testResults || []) {
        for (const test of testFile.assertionResults || []) {
          results.push({
            name: test.fullName || test.title,
            status: test.status === "passed" ? "passed" : test.status === "pending" ? "skipped" : "failed",
            duration: test.duration || 0,
            errorMessage: test.failureMessages?.join("\n"),
            file: testFile.name,
          });
        }
      }

      return {
        framework: "jest",
        totalTests: json.numTotalTests || results.length,
        passed: json.numPassedTests || results.filter(r => r.status === "passed").length,
        failed: json.numFailedTests || results.filter(r => r.status === "failed").length,
        skipped: json.numPendingTests || results.filter(r => r.status === "skipped").length,
        duration: json.testResults?.reduce((acc: number, t: { perfStats?: { runtime?: number } }) =>
          acc + (t.perfStats?.runtime || 0), 0) || 0,
        results,
        rawOutput: output,
      };
    } catch {
      return this.createParseErrorResult("jest", output);
    }
  }

  private parseVitestOutput(output: string): TestRunResult {
    try {
      // Try to find JSON in output
      const jsonMatch = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createParseErrorResult("vitest", output);
      }

      const json = JSON.parse(jsonMatch[0]);
      const results: TestResult[] = [];

      for (const file of json.testResults || []) {
        for (const test of file.assertionResults || []) {
          results.push({
            name: test.fullName || test.title,
            status: test.status === "passed" ? "passed" : "failed",
            duration: test.duration || 0,
            errorMessage: test.failureMessages?.join("\n"),
            file: file.name,
          });
        }
      }

      return {
        framework: "vitest",
        totalTests: results.length,
        passed: results.filter(r => r.status === "passed").length,
        failed: results.filter(r => r.status === "failed").length,
        skipped: results.filter(r => r.status === "skipped").length,
        duration: json.duration || 0,
        results,
        rawOutput: output,
      };
    } catch {
      return this.createParseErrorResult("vitest", output);
    }
  }

  private parseMochaOutput(output: string): TestRunResult {
    try {
      const json = JSON.parse(output);
      const results: TestResult[] = [];

      const processTests = (tests: Array<{ fullTitle: string; duration: number; err?: { message: string } }>) => {
        for (const test of tests) {
          results.push({
            name: test.fullTitle,
            status: test.err ? "failed" : "passed",
            duration: test.duration || 0,
            errorMessage: test.err?.message,
          });
        }
      };

      if (json.tests) processTests(json.tests);
      if (json.passes) processTests(json.passes);
      if (json.failures) processTests(json.failures);

      return {
        framework: "mocha",
        totalTests: (json.stats?.tests) || results.length,
        passed: (json.stats?.passes) || results.filter(r => r.status === "passed").length,
        failed: (json.stats?.failures) || results.filter(r => r.status === "failed").length,
        skipped: (json.stats?.pending) || 0,
        duration: (json.stats?.duration) || 0,
        results,
        rawOutput: output,
      };
    } catch {
      return this.createParseErrorResult("mocha", output);
    }
  }

  private parseMavenOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse test results from Maven output
    const testPattern = /Tests run: (\d+), Failures: (\d+), Errors: (\d+), Skipped: (\d+)/;
    const match = testPattern.exec(output);

    let total = 0, passed = 0, failed = 0, skipped = 0;

    if (match) {
      total = parseInt(match[1], 10);
      failed = parseInt(match[2], 10) + parseInt(match[3], 10);
      skipped = parseInt(match[4], 10);
      passed = total - failed - skipped;
    }

    // Extract individual test failures
    const failurePattern = /(\w+)\((\w+)\).*?(?:FAILURE|ERROR)/g;
    let failMatch;
    while ((failMatch = failurePattern.exec(output)) !== null) {
      results.push({
        name: `${failMatch[2]}.${failMatch[1]}`,
        status: "failed",
        duration: 0,
        errorMessage: "Test failed - see build output for details",
      });
    }

    return {
      framework: "junit",
      totalTests: total,
      passed,
      failed,
      skipped,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  private parseGradleOutput(output: string, exitCode: number | undefined): TestRunResult {
    // Similar to Maven parsing
    return this.parseMavenOutput(output, exitCode);
  }

  private parsePytestOutput(output: string, _exitCode: number | undefined): TestRunResult {
    try {
      const json = JSON.parse(output);
      const results: TestResult[] = [];

      for (const test of json.tests || []) {
        results.push({
          name: test.nodeid,
          status: test.outcome === "passed" ? "passed" : test.outcome === "skipped" ? "skipped" : "failed",
          duration: test.duration || 0,
          errorMessage: test.call?.longrepr,
        });
      }

      return {
        framework: "pytest",
        totalTests: json.summary?.total || results.length,
        passed: json.summary?.passed || results.filter(r => r.status === "passed").length,
        failed: json.summary?.failed || results.filter(r => r.status === "failed").length,
        skipped: json.summary?.skipped || results.filter(r => r.status === "skipped").length,
        duration: json.duration || 0,
        results,
        rawOutput: output,
      };
    } catch {
      return this.parsePytestBasicOutput(output);
    }
  }

  private parsePytestBasicOutput(output: string): TestRunResult {
    const results: TestResult[] = [];

    // Parse pytest verbose output
    const testPattern = /(\S+::\S+)\s+(PASSED|FAILED|SKIPPED|ERROR)/g;
    let match;
    while ((match = testPattern.exec(output)) !== null) {
      results.push({
        name: match[1],
        status: match[2].toLowerCase() as TestResult["status"],
        duration: 0,
      });
    }

    // Parse summary line
    const summaryPattern = /(\d+) passed|(\d+) failed|(\d+) skipped|(\d+) error/g;
    let passed = 0, failed = 0, skipped = 0;
    let summaryMatch;
    while ((summaryMatch = summaryPattern.exec(output)) !== null) {
      if (summaryMatch[1]) passed = parseInt(summaryMatch[1], 10);
      if (summaryMatch[2]) failed = parseInt(summaryMatch[2], 10);
      if (summaryMatch[3]) skipped = parseInt(summaryMatch[3], 10);
      if (summaryMatch[4]) failed += parseInt(summaryMatch[4], 10);
    }

    return {
      framework: "pytest",
      totalTests: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  private parseUnittestOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse unittest output
    const testPattern = /(\w+)\s+\((\S+)\)\s+\.\.\.\s+(ok|FAIL|ERROR|skipped)/g;
    let match;
    while ((match = testPattern.exec(output)) !== null) {
      results.push({
        name: `${match[2]}.${match[1]}`,
        status: match[3] === "ok" ? "passed" : match[3] === "skipped" ? "skipped" : "failed",
        duration: 0,
      });
    }

    // Parse summary
    const summaryPattern = /Ran (\d+) tests?.*?(\d+) failures?.*?(\d+) errors?/s;
    const summaryMatch = summaryPattern.exec(output);

    let total = results.length;
    let failed = results.filter(r => r.status === "failed").length;

    if (summaryMatch) {
      total = parseInt(summaryMatch[1], 10);
      failed = parseInt(summaryMatch[2], 10) + parseInt(summaryMatch[3], 10);
    }

    return {
      framework: "unittest",
      totalTests: total,
      passed: total - failed,
      failed,
      skipped: results.filter(r => r.status === "skipped").length,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  private parseGoTestOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse JSON lines from go test -json
    const lines = output.split("\n").filter(l => l.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.Action === "pass" || event.Action === "fail" || event.Action === "skip") {
          if (event.Test) {
            results.push({
              name: `${event.Package}/${event.Test}`,
              status: event.Action === "pass" ? "passed" : event.Action === "skip" ? "skipped" : "failed",
              duration: (event.Elapsed || 0) * 1000,
              errorMessage: event.Output,
            });
          }
        }
      } catch {
        // Not a JSON line, ignore
      }
    }

    // Deduplicate (go test outputs multiple events per test)
    const uniqueResults = new Map<string, TestResult>();
    for (const r of results) {
      uniqueResults.set(r.name, r);
    }

    const finalResults = Array.from(uniqueResults.values());

    return {
      framework: "go",
      totalTests: finalResults.length,
      passed: finalResults.filter(r => r.status === "passed").length,
      failed: finalResults.filter(r => r.status === "failed").length,
      skipped: finalResults.filter(r => r.status === "skipped").length,
      duration: 0,
      results: finalResults,
      rawOutput: output,
    };
  }

  private parseCargoTestOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse JSON lines from cargo test --format=json
    const lines = output.split("\n").filter(l => l.trim());

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === "test" && event.event) {
          results.push({
            name: event.name,
            status: event.event === "ok" ? "passed" : event.event === "ignored" ? "skipped" : "failed",
            duration: 0,
            errorMessage: event.stdout,
          });
        }
      } catch {
        // Not a JSON line, ignore
      }
    }

    if (results.length === 0) {
      return this.parseCargoTestBasicOutput(output, _exitCode);
    }

    return {
      framework: "cargo",
      totalTests: results.length,
      passed: results.filter(r => r.status === "passed").length,
      failed: results.filter(r => r.status === "failed").length,
      skipped: results.filter(r => r.status === "skipped").length,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  private parseCargoTestBasicOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse standard cargo test output
    // test module::test_name ... ok
    // test module::test_name ... FAILED
    // test module::test_name ... ignored
    const testPattern = /test\s+([\w:]+)\s+\.\.\.\s+(ok|FAILED|ignored)/g;
    let match;
    while ((match = testPattern.exec(output)) !== null) {
      results.push({
        name: match[1],
        status: match[2] === "ok" ? "passed" : match[2] === "ignored" ? "skipped" : "failed",
        duration: 0,
      });
    }

    // Parse summary: test result: ok. X passed; Y failed; Z ignored
    const summaryMatch = /test result:.*?(\d+) passed.*?(\d+) failed.*?(\d+) ignored/i.exec(output);
    let passed = results.filter(r => r.status === "passed").length;
    let failed = results.filter(r => r.status === "failed").length;
    let skipped = results.filter(r => r.status === "skipped").length;

    if (summaryMatch) {
      passed = parseInt(summaryMatch[1], 10);
      failed = parseInt(summaryMatch[2], 10);
      skipped = parseInt(summaryMatch[3], 10);
    }

    return {
      framework: "cargo",
      totalTests: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  private parseDotnetTestOutput(output: string, _exitCode: number | undefined): TestRunResult {
    const results: TestResult[] = [];

    // Parse dotnet test console output
    // Passed TestName [< 1 ms]
    // Failed TestName [< 1 ms]
    // Skipped TestName
    const passedPattern = /Passed\s+([\w.]+)/g;
    const failedPattern = /Failed\s+([\w.]+)/g;
    const skippedPattern = /Skipped\s+([\w.]+)/g;

    let match;
    while ((match = passedPattern.exec(output)) !== null) {
      results.push({
        name: match[1],
        status: "passed",
        duration: 0,
      });
    }

    while ((match = failedPattern.exec(output)) !== null) {
      // Try to extract error message
      const errorMatch = new RegExp(`${match[1]}[\\s\\S]*?Message:\\s*([^\\n]+)`, "m").exec(output);
      results.push({
        name: match[1],
        status: "failed",
        duration: 0,
        errorMessage: errorMatch?.[1],
      });
    }

    while ((match = skippedPattern.exec(output)) !== null) {
      results.push({
        name: match[1],
        status: "skipped",
        duration: 0,
      });
    }

    // Parse summary: Passed: X, Failed: Y, Skipped: Z
    const summaryMatch = /Passed:\s*(\d+).*?Failed:\s*(\d+).*?Skipped:\s*(\d+)/i.exec(output);
    let passed = results.filter(r => r.status === "passed").length;
    let failed = results.filter(r => r.status === "failed").length;
    let skipped = results.filter(r => r.status === "skipped").length;

    if (summaryMatch) {
      passed = parseInt(summaryMatch[1], 10);
      failed = parseInt(summaryMatch[2], 10);
      skipped = parseInt(summaryMatch[3], 10);
    }

    return {
      framework: "dotnet",
      totalTests: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      results,
      rawOutput: output,
    };
  }

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  private createErrorResult(framework: string, error: unknown): TestRunResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      framework,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [{
        name: "Test execution error",
        status: "error",
        duration: 0,
        errorMessage: message,
      }],
      rawOutput: message,
    };
  }

  private createParseErrorResult(framework: string, output: string): TestRunResult {
    return {
      framework,
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      results: [{
        name: "Parse error",
        status: "error",
        duration: 0,
        errorMessage: "Could not parse test output",
      }],
      rawOutput: output,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let defaultRunner: TestRunner | null = null;

export function getTestRunner(cwd?: string): TestRunner {
  if (!defaultRunner || cwd) {
    defaultRunner = new TestRunner({ cwd });
  }
  return defaultRunner;
}
