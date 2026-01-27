import { readFile } from "fs/promises";
import type {
  TestCase,
  SourceMethod,
  Assertion,
  Parameter,
} from "../../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface GoParseResult {
  tests: TestCase[];
  methods: SourceMethod[];
}

interface RawFunction {
  name: string;
  lineNumber: number;
  endLine: number;
  body: string;
  isTest: boolean;
  isBenchmark: boolean;
  receiver?: string;
  parameters: string;
  returnType: string;
}

// ============================================================================
// GoParser - Regex-based parsing for Go source files
// ============================================================================

export class GoParser {
  private readonly filePath: string;
  private content: string = "";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a Go file and extract tests and source functions
   */
  async parseFile(): Promise<GoParseResult> {
    this.content = await readFile(this.filePath, "utf-8");

    const packageName = this.extractPackageName();
    const rawFunctions = this.extractAllFunctions();

    const tests: TestCase[] = [];
    const methods: SourceMethod[] = [];

    for (const raw of rawFunctions) {
      if (raw.isTest || raw.isBenchmark) {
        tests.push(this.convertToTestCase(raw));
      } else {
        methods.push(this.convertToSourceMethod(raw, packageName));
      }
    }

    return { tests, methods };
  }

  // ==========================================================================
  // Package Extraction
  // ==========================================================================

  private extractPackageName(): string | undefined {
    const packageMatch = /^package\s+(\w+)/m.exec(this.content);
    return packageMatch?.[1];
  }

  // ==========================================================================
  // Function Extraction
  // ==========================================================================

  private extractAllFunctions(): RawFunction[] {
    const functions: RawFunction[] = [];

    // Pattern for Go functions:
    // func (receiver) FunctionName(params) (returnType) {
    const funcPattern =
      /func\s+(?:\((\w+)\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)\s*(?:\(([^)]+)\)|(\w+(?:\s*,\s*\w+)*)?)?\s*\{/g;

    let match;
    while ((match = funcPattern.exec(this.content)) !== null) {
      const receiverVar = match[1];
      const receiverType = match[2];
      const name = match[3];
      const parameters = match[4] ?? "";
      const returnType = match[5] || match[6] || "void";

      const isTest = name.startsWith("Test") && /^Test[A-Z]/.test(name);
      const isBenchmark = name.startsWith("Benchmark") && /^Benchmark[A-Z]/.test(name);

      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);

      // Find the function body by matching braces
      const bodyStartIndex = this.content.indexOf("{", startIndex);
      const { body, endIndex } = this.extractFunctionBody(bodyStartIndex);
      const endLine = this.getLineNumber(endIndex);

      functions.push({
        name,
        lineNumber,
        endLine,
        body,
        isTest,
        isBenchmark,
        receiver: receiverType ? `${receiverVar} *${receiverType}` : undefined,
        parameters,
        returnType,
      });
    }

    return functions;
  }

  private extractFunctionBody(startIndex: number): { body: string; endIndex: number } {
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

  private convertToTestCase(raw: RawFunction): TestCase {
    const assertions = this.extractAssertions(raw.body, raw.lineNumber);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      framework: raw.isBenchmark ? "go-benchmark" : "go-test",
      assertions,
      body: raw.body,
    };
  }

  // ==========================================================================
  // Assertion Extraction
  // ==========================================================================

  private extractAssertions(body: string, baseLineNumber: number): Assertion[] {
    const assertions: Assertion[] = [];

    // t.Error / t.Errorf
    const errorPattern = /t\.(?:Error|Errorf)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, errorPattern, "truthy", assertions, (match) => ({
      expected: "no error",
      actual: match[1]?.trim() ?? null,
    }));

    // t.Fatal / t.Fatalf
    const fatalPattern = /t\.(?:Fatal|Fatalf)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fatalPattern, "truthy", assertions, (match) => ({
      expected: "no fatal",
      actual: match[1]?.trim() ?? null,
    }));

    // if ... != ... { t.Error }
    const ifNotEqualPattern = /if\s+([^{]+)\s*!=\s*([^{]+)\s*\{[^}]*t\.(?:Error|Fatal)/g;
    this.extractAssertionMatches(body, baseLineNumber, ifNotEqualPattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    // if ... == ... { t.Error } (negative assertion)
    const ifEqualPattern = /if\s+([^{]+)\s*==\s*([^{]+)\s*\{[^}]*t\.(?:Error|Fatal)/g;
    this.extractAssertionMatches(body, baseLineNumber, ifEqualPattern, "equals", assertions, (match) => ({
      expected: `NOT ${match[2]?.trim()}`,
      actual: match[1]?.trim() ?? null,
    }));

    // testify: assert.Equal(t, expected, actual)
    const testifyEqualPattern = /assert\.Equal\s*\(\s*\w+\s*,\s*([^,]+)\s*,\s*([^,)]+)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyEqualPattern, "equals", assertions, (match) => ({
      expected: match[1]?.trim() ?? null,
      actual: match[2]?.trim() ?? null,
    }));

    // testify: assert.NotEqual(t, expected, actual)
    const testifyNotEqualPattern = /assert\.NotEqual\s*\(\s*\w+\s*,\s*([^,]+)\s*,\s*([^,)]+)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyNotEqualPattern, "equals", assertions, (match) => ({
      expected: `NOT ${match[1]?.trim()}`,
      actual: match[2]?.trim() ?? null,
    }));

    // testify: assert.True / assert.False
    const testifyTruePattern = /assert\.True\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyTruePattern, "truthy", assertions, (match) => ({
      expected: "true",
      actual: match[1]?.trim() ?? null,
    }));

    const testifyFalsePattern = /assert\.False\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyFalsePattern, "truthy", assertions, (match) => ({
      expected: "false",
      actual: match[1]?.trim() ?? null,
    }));

    // testify: assert.Nil / assert.NotNil
    const testifyNilPattern = /assert\.Nil\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyNilPattern, "equals", assertions, (match) => ({
      expected: "nil",
      actual: match[1]?.trim() ?? null,
    }));

    const testifyNotNilPattern = /assert\.NotNil\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyNotNilPattern, "truthy", assertions, (match) => ({
      expected: "NOT nil",
      actual: match[1]?.trim() ?? null,
    }));

    // testify: assert.NoError / assert.Error
    const testifyNoErrorPattern = /assert\.NoError\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyNoErrorPattern, "throws", assertions, (match) => ({
      expected: "no error",
      actual: match[1]?.trim() ?? null,
    }));

    const testifyErrorPattern = /assert\.Error\s*\(\s*\w+\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, testifyErrorPattern, "throws", assertions, (match) => ({
      expected: "error",
      actual: match[1]?.trim() ?? null,
    }));

    // testify: require.* (same as assert but fatal)
    const requireEqualPattern = /require\.Equal\s*\(\s*\w+\s*,\s*([^,]+)\s*,\s*([^,)]+)/g;
    this.extractAssertionMatches(body, baseLineNumber, requireEqualPattern, "equals", assertions, (match) => ({
      expected: match[1]?.trim() ?? null,
      actual: match[2]?.trim() ?? null,
    }));

    return assertions;
  }

  private extractAssertionMatches(
    body: string,
    baseLineNumber: number,
    pattern: RegExp,
    type: Assertion["type"],
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

  private convertToSourceMethod(raw: RawFunction, packageName?: string): SourceMethod {
    const parameters = this.parseParameters(raw.parameters);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      parameters,
      returnType: raw.returnType,
      body: raw.body,
      className: packageName,
    };
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: Parameter[] = [];
    // Go params: name type, name type OR name, name type
    const parts = paramString.split(",");

    let lastType = "";
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const match = /(\w+)\s+(.+)/.exec(trimmed);
      if (match) {
        lastType = match[2];
        params.push({
          name: match[1],
          type: match[2],
        });
      } else {
        // Name only, type comes later or use last type
        params.push({
          name: trimmed,
          type: lastType || "unknown",
        });
      }
    }

    return params;
  }
}

// ============================================================================
// Convenience function
// ============================================================================

export async function parseGoFile(filePath: string): Promise<GoParseResult> {
  const parser = new GoParser(filePath);
  return parser.parseFile();
}
