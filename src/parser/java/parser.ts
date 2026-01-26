import { readFile } from "fs/promises";
import type {
  TestCase,
  SourceMethod,
  Assertion,
  AssertionType,
  Parameter,
  ParsedTestReport,
  TestFailure,
} from "../../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface JavaParseResult {
  tests: TestCase[];
  methods: SourceMethod[];
}

interface RawMethod {
  name: string;
  lineNumber: number;
  endLine: number;
  body: string;
  isTest: boolean;
  visibility: string;
  returnType: string;
  parameters: string;
}

// ============================================================================
// JavaParser - Regex-based parsing for MVP
// ============================================================================

export class JavaParser {
  private readonly filePath: string;
  private content: string = "";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a Java file and extract tests and source methods
   */
  async parseFile(): Promise<JavaParseResult> {
    this.content = await readFile(this.filePath, "utf-8");

    const className = this.extractClassName();
    const rawMethods = this.extractAllMethods();

    const tests: TestCase[] = [];
    const methods: SourceMethod[] = [];

    for (const raw of rawMethods) {
      if (raw.isTest) {
        tests.push(this.convertToTestCase(raw));
      } else {
        methods.push(this.convertToSourceMethod(raw, className));
      }
    }

    return { tests, methods };
  }

  // ==========================================================================
  // Class Extraction
  // ==========================================================================

  private extractClassName(): string | undefined {
    const classMatch = /(?:public\s+)?class\s+(\w+)/.exec(this.content);
    return classMatch?.[1];
  }

  // ==========================================================================
  // Method Extraction
  // ==========================================================================

  private extractAllMethods(): RawMethod[] {
    const methods: RawMethod[] = [];

    // Pattern to find method declarations
    // Matches: @Test (optional), visibility, return type, method name, parameters
    const methodPattern =
      /(@Test(?:\s*\([^)]*\))?\s+)?(public|protected|private)?\s*(static\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g;

    let match;
    while ((match = methodPattern.exec(this.content)) !== null) {
      const isTest = !!match[1];
      const visibility = match[2] ?? "package";
      const returnType = match[4] ?? "void";
      const name = match[5];
      const parameters = match[6] ?? "";

      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);

      // Find the method body by matching braces
      const bodyStartIndex = this.content.indexOf("{", startIndex);
      const { body, endIndex } = this.extractMethodBody(bodyStartIndex);
      const endLine = this.getLineNumber(endIndex);

      methods.push({
        name,
        lineNumber,
        endLine,
        body,
        isTest,
        visibility,
        returnType,
        parameters,
      });
    }

    return methods;
  }

  private extractMethodBody(startIndex: number): { body: string; endIndex: number } {
    let braceCount = 0;
    let i = startIndex;
    let started = false;

    while (i < this.content.length) {
      const char = this.content[i];

      if (char === "{") {
        braceCount++;
        started = true;
      } else if (char === "}") {
        braceCount--;
        if (started && braceCount === 0) {
          return {
            body: this.content.substring(startIndex, i + 1),
            endIndex: i,
          };
        }
      }
      i++;
    }

    return { body: this.content.substring(startIndex), endIndex: this.content.length };
  }

  private getLineNumber(index: number): number {
    const textBefore = this.content.substring(0, index);
    return textBefore.split("\n").length;
  }

  // ==========================================================================
  // TestCase Conversion
  // ==========================================================================

  private convertToTestCase(raw: RawMethod): TestCase {
    const assertions = this.extractAssertions(raw.body, raw.lineNumber);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      framework: "junit5", // Default to JUnit 5, could be detected
      assertions,
      body: raw.body,
    };
  }

  // ==========================================================================
  // Assertion Extraction
  // ==========================================================================

  private extractAssertions(body: string, baseLineNumber: number): Assertion[] {
    const assertions: Assertion[] = [];

    // assertEquals(expected, actual) or assertEquals(message, expected, actual)
    const assertEqualsPattern = /assertEquals\s*\(\s*(?:"[^"]*"\s*,\s*)?([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertEqualsPattern,
      "equals",
      assertions,
      (match) => ({ expected: match[1]?.trim() ?? null, actual: match[2]?.trim() ?? null })
    );

    // assertNotEquals(expected, actual)
    const assertNotEqualsPattern = /assertNotEquals\s*\(\s*(?:"[^"]*"\s*,\s*)?([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertNotEqualsPattern,
      "equals",
      assertions,
      (match) => ({ expected: `NOT ${match[1]?.trim()}`, actual: match[2]?.trim() ?? null })
    );

    // assertTrue(condition)
    const assertTruePattern = /assertTrue\s*\(\s*(?:"[^"]*"\s*,\s*)?([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertTruePattern,
      "truthy",
      assertions,
      (match) => ({ expected: "true", actual: match[1]?.trim() ?? null })
    );

    // assertFalse(condition)
    const assertFalsePattern = /assertFalse\s*\(\s*(?:"[^"]*"\s*,\s*)?([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertFalsePattern,
      "truthy",
      assertions,
      (match) => ({ expected: "false", actual: match[1]?.trim() ?? null })
    );

    // assertNull(value)
    const assertNullPattern = /assertNull\s*\(\s*(?:"[^"]*"\s*,\s*)?([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertNullPattern,
      "equals",
      assertions,
      (match) => ({ expected: "null", actual: match[1]?.trim() ?? null })
    );

    // assertNotNull(value)
    const assertNotNullPattern = /assertNotNull\s*\(\s*(?:"[^"]*"\s*,\s*)?([^)]+)\)/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertNotNullPattern,
      "truthy",
      assertions,
      (match) => ({ expected: "NOT null", actual: match[1]?.trim() ?? null })
    );

    // assertThrows(Exception.class, () -> ...)
    const assertThrowsPattern = /assertThrows\s*\(\s*(\w+(?:\.\w+)*)\.class\s*,/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertThrowsPattern,
      "throws",
      assertions,
      (match) => ({ expected: match[1]?.trim() ?? null, actual: null })
    );

    // assertDoesNotThrow(() -> ...)
    const assertDoesNotThrowPattern = /assertDoesNotThrow\s*\(/g;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertDoesNotThrowPattern,
      "throws",
      assertions,
      () => ({ expected: "no exception", actual: null })
    );

    // assertContains / contains (common in various frameworks)
    const assertContainsPattern = /(?:assertThat|assert).*contains?\s*\(\s*([^)]+)\)/gi;
    this.extractAssertionMatches(
      body,
      baseLineNumber,
      assertContainsPattern,
      "contains",
      assertions,
      (match) => ({ expected: match[1]?.trim() ?? null, actual: null })
    );

    return assertions;
  }

  private extractAssertionMatches(
    body: string,
    baseLineNumber: number,
    pattern: RegExp,
    type: AssertionType,
    assertions: Assertion[],
    extractor: (match: RegExpExecArray) => { expected: string | null; actual: string | null }
  ): void {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const lineOffset = body.substring(0, match.index).split("\n").length - 1;
      const { expected, actual } = extractor(match);

      assertions.push({
        type,
        expected,
        actual,
        lineNumber: baseLineNumber + lineOffset,
        raw: match[0],
      });
    }
  }

  // ==========================================================================
  // SourceMethod Conversion
  // ==========================================================================

  private convertToSourceMethod(raw: RawMethod, className?: string): SourceMethod {
    const parameters = this.parseParameters(raw.parameters);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      parameters,
      returnType: raw.returnType,
      body: raw.body,
      className,
    };
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: Parameter[] = [];
    // Split by comma, but be careful with generics like Map<String, Integer>
    const paramParts = this.splitParameters(paramString);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match: [final] Type name [= default]
      const paramMatch = /(?:final\s+)?(\S+(?:<[^>]+>)?)\s+(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (paramMatch) {
        params.push({
          type: paramMatch[1],
          name: paramMatch[2],
          defaultValue: paramMatch[3],
        });
      }
    }

    return params;
  }

  private splitParameters(paramString: string): string[] {
    const parts: string[] = [];
    let current = "";
    let depth = 0;

    for (const char of paramString) {
      if (char === "<") depth++;
      else if (char === ">") depth--;
      else if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
      current += char;
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }
}

// ============================================================================
// JavaTestParser - JUnit XML and build output parsing (kept for compatibility)
// ============================================================================

export class JavaTestParser {
  async parseJUnitXml(xmlPath: string): Promise<ParsedTestReport> {
    const content = await readFile(xmlPath, "utf-8");
    return this.parseJUnitXmlContent(content);
  }

  parseJUnitXmlContent(xml: string): ParsedTestReport {
    const failures: TestFailure[] = [];

    // Extract test suite stats
    const testsMatch = /tests="(\d+)"/.exec(xml);
    const failuresMatch = /failures="(\d+)"/.exec(xml);
    const errorsMatch = /errors="(\d+)"/.exec(xml);
    const skippedMatch = /skipped="(\d+)"/.exec(xml);
    const timeMatch = /time="([\d.]+)"/.exec(xml);

    const totalTests = parseInt(testsMatch?.[1] ?? "0", 10);
    const failedTests =
      parseInt(failuresMatch?.[1] ?? "0", 10) + parseInt(errorsMatch?.[1] ?? "0", 10);
    const skippedTests = parseInt(skippedMatch?.[1] ?? "0", 10);
    const duration = parseFloat(timeMatch?.[1] ?? "0") * 1000; // Convert to ms

    // Extract individual test failures
    const testCasePattern =
      /<testcase\s+[^>]*name="([^"]+)"[^>]*classname="([^"]+)"[^>]*>[\s\S]*?<(failure|error)[^>]*(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/\3>[\s\S]*?<\/testcase>/g;

    let match;
    while ((match = testCasePattern.exec(xml)) !== null) {
      const testName = match[1];
      const className = match[2];
      const errorMessage = match[4] ?? "Unknown error";
      const stackTrace = match[5]?.trim();

      // Try to extract source file and line from stack trace
      const { sourceFile, sourceLine } = this.extractSourceLocation(stackTrace, className);

      failures.push({
        testName: `${className}.${testName}`,
        testFile: className.replace(/\./g, "/") + ".java",
        errorMessage: this.decodeXmlEntities(errorMessage),
        stackTrace,
        sourceFile,
        sourceLine,
      });
    }

    return {
      failures,
      totalTests,
      passedTests: totalTests - failedTests - skippedTests,
      failedTests,
      skippedTests,
      duration,
    };
  }

  private extractSourceLocation(
    stackTrace: string | undefined,
    className: string
  ): { sourceFile?: string; sourceLine?: number } {
    if (!stackTrace) return {};

    // Look for the first line in the stack trace that matches the test class
    const simpleClassName = className.split(".").pop();
    const pattern = new RegExp(`at\\s+[\\w.]+\\(${simpleClassName}\\.java:(\\d+)\\)`);
    const match = pattern.exec(stackTrace);

    if (match) {
      return {
        sourceFile: className.replace(/\./g, "/") + ".java",
        sourceLine: parseInt(match[1], 10),
      };
    }

    return {};
  }

  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }

  async parseMavenOutput(output: string): Promise<TestFailure[]> {
    const failures: TestFailure[] = [];

    // Maven Surefire output pattern:
    // [ERROR] testMethodName(com.example.TestClass) Time elapsed: 0.001 s <<< FAILURE!
    const failurePattern =
      /\[ERROR\]\s+(\w+)\(([^)]+)\).*?<<<\s*(FAILURE|ERROR)!\s*\n([\s\S]*?)(?=\[ERROR\]|\[INFO\]|$)/g;

    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      const testName = match[1];
      const className = match[2];
      const errorDetails = match[4]?.trim() ?? "";

      // Extract error message (first line of details)
      const errorMessage = errorDetails.split("\n")[0] ?? "Test failed";

      failures.push({
        testName: `${className}.${testName}`,
        testFile: className.replace(/\./g, "/") + ".java",
        errorMessage,
        stackTrace: errorDetails,
      });
    }

    return failures;
  }

  async parseGradleOutput(output: string): Promise<TestFailure[]> {
    const failures: TestFailure[] = [];

    // Gradle test output pattern:
    // com.example.TestClass > testMethodName FAILED
    const failurePattern =
      /([a-zA-Z_][\w.]*)\s+>\s+(\w+)\s+FAILED\s*\n([\s\S]*?)(?=\n[a-zA-Z_][\w.]*\s+>|\n\d+\s+tests?\s+completed|$)/g;

    let match;
    while ((match = failurePattern.exec(output)) !== null) {
      const className = match[1];
      const testName = match[2];
      const errorDetails = match[3]?.trim() ?? "";

      // Extract error message
      const messageMatch = /(?:expected|but was|Assertion|Exception).*/.exec(errorDetails);
      const errorMessage = messageMatch?.[0] ?? "Test failed";

      failures.push({
        testName: `${className}.${testName}`,
        testFile: className.replace(/\./g, "/") + ".java",
        errorMessage,
        stackTrace: errorDetails,
      });
    }

    return failures;
  }
}

// ============================================================================
// Convenience function
// ============================================================================

export async function parseJavaFile(filePath: string): Promise<JavaParseResult> {
  const parser = new JavaParser(filePath);
  return parser.parseFile();
}
