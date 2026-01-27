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

export interface RustParseResult {
  tests: TestCase[];
  methods: SourceMethod[];
}

interface RawFunction {
  name: string;
  lineNumber: number;
  endLine: number;
  body: string;
  isTest: boolean;
  isAsync: boolean;
  visibility: string;
  parameters: string;
  returnType: string;
  attributes: string[];
}

// ============================================================================
// RustParser - Regex-based parsing for Rust source files
// ============================================================================

export class RustParser {
  private readonly filePath: string;
  private content: string = "";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a Rust file and extract tests and source functions
   */
  async parseFile(): Promise<RustParseResult> {
    this.content = await readFile(this.filePath, "utf-8");

    const moduleName = this.extractModuleName();
    const rawFunctions = this.extractAllFunctions();

    const tests: TestCase[] = [];
    const methods: SourceMethod[] = [];

    for (const raw of rawFunctions) {
      if (raw.isTest) {
        tests.push(this.convertToTestCase(raw));
      } else {
        methods.push(this.convertToSourceMethod(raw, moduleName));
      }
    }

    return { tests, methods };
  }

  // ==========================================================================
  // Module Extraction
  // ==========================================================================

  private extractModuleName(): string | undefined {
    // Extract from file path or mod declaration
    const modMatch = /^mod\s+(\w+)\s*;/m.exec(this.content);
    if (modMatch) return modMatch[1];

    // Extract from file name
    const pathParts = this.filePath.split("/");
    const fileName = pathParts[pathParts.length - 1];
    return fileName.replace(".rs", "");
  }

  // ==========================================================================
  // Function Extraction
  // ==========================================================================

  private extractAllFunctions(): RawFunction[] {
    const functions: RawFunction[] = [];

    // First, find all attributes and their associated functions
    // Pattern: #[attr] (multiple possible) followed by fn
    const lines = this.content.split("\n");
    let currentAttributes: string[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Collect attributes
      if (trimmed.startsWith("#[")) {
        const attrMatch = /#\[([^\]]+)\]/.exec(trimmed);
        if (attrMatch) {
          currentAttributes.push(attrMatch[1]);
        }
        i++;
        continue;
      }

      // Check for function declaration
      const fnMatch = /^(pub(?:\s*\([^)]*\))?\s+)?(async\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)\s*(?:->\s*([^{]+))?\s*\{?/.exec(trimmed);
      if (fnMatch) {
        const visibility = fnMatch[1]?.trim() || "private";
        const isAsync = !!fnMatch[2];
        const name = fnMatch[3];
        const parameters = fnMatch[4] ?? "";
        const returnType = fnMatch[5]?.trim() || "()";

        const isTest = currentAttributes.some(a =>
          a === "test" || a.startsWith("test") || a === "tokio::test" || a === "async_std::test"
        );

        const lineNumber = i + 1;
        const startIndex = this.getIndexFromLine(lineNumber);

        // Find the function body
        const bodyStartIndex = this.content.indexOf("{", startIndex);
        const { body, endIndex } = this.extractFunctionBody(bodyStartIndex);
        const endLine = this.getLineNumber(endIndex);

        functions.push({
          name,
          lineNumber,
          endLine,
          body,
          isTest,
          isAsync,
          visibility,
          parameters,
          returnType,
          attributes: [...currentAttributes],
        });

        currentAttributes = [];
      } else if (!trimmed.startsWith("//") && !trimmed.startsWith("/*") && trimmed !== "") {
        // Not an attribute or function, clear attributes
        currentAttributes = [];
      }

      i++;
    }

    return functions;
  }

  private getIndexFromLine(lineNumber: number): number {
    const lines = this.content.split("\n");
    let index = 0;
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      index += lines[i].length + 1; // +1 for newline
    }
    return index;
  }

  private extractFunctionBody(startIndex: number): { body: string; endIndex: number } {
    if (startIndex < 0) {
      return { body: "", endIndex: startIndex };
    }

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
      framework: raw.isAsync ? "tokio-test" : "rust-test",
      assertions,
      body: raw.body,
    };
  }

  // ==========================================================================
  // Assertion Extraction
  // ==========================================================================

  private extractAssertions(body: string, baseLineNumber: number): Assertion[] {
    const assertions: Assertion[] = [];

    // assert!(condition)
    const assertPattern = /assert!\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertPattern, "truthy", assertions, (match) => ({
      expected: "true",
      actual: match[1]?.trim() ?? null,
    }));

    // assert_eq!(left, right)
    const assertEqPattern = /assert_eq!\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertEqPattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    // assert_ne!(left, right)
    const assertNePattern = /assert_ne!\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertNePattern, "equals", assertions, (match) => ({
      expected: `NOT ${match[2]?.trim()}`,
      actual: match[1]?.trim() ?? null,
    }));

    // debug_assert!, debug_assert_eq!, debug_assert_ne!
    const debugAssertPattern = /debug_assert!\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, debugAssertPattern, "truthy", assertions, (match) => ({
      expected: "true",
      actual: match[1]?.trim() ?? null,
    }));

    const debugAssertEqPattern = /debug_assert_eq!\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, debugAssertEqPattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    // #[should_panic] tests
    const panicPattern = /panic!\s*\(\s*([^)]*)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, panicPattern, "throws", assertions, (match) => ({
      expected: match[1]?.trim() || "panic",
      actual: null,
    }));

    // Result assertions: .unwrap(), .expect(), ?
    const unwrapPattern = /\.unwrap\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, unwrapPattern, "truthy", assertions, () => ({
      expected: "Ok/Some",
      actual: "Result/Option",
    }));

    const expectPattern = /\.expect\s*\(\s*"([^"]*)"\s*\)/g;
    this.extractAssertionMatches(body, baseLineNumber, expectPattern, "truthy", assertions, (match) => ({
      expected: "Ok/Some",
      actual: match[1] ?? null,
    }));

    // is_ok(), is_err(), is_some(), is_none()
    const isOkPattern = /\.is_ok\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, isOkPattern, "truthy", assertions, () => ({
      expected: "Ok",
      actual: "Result",
    }));

    const isErrPattern = /\.is_err\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, isErrPattern, "truthy", assertions, () => ({
      expected: "Err",
      actual: "Result",
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

  private convertToSourceMethod(raw: RawFunction, moduleName?: string): SourceMethod {
    const parameters = this.parseParameters(raw.parameters);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      parameters,
      returnType: raw.returnType,
      body: raw.body,
      className: moduleName,
    };
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: Parameter[] = [];
    // Rust params: name: Type, name: Type OR &self, &mut self
    const parts = this.splitParameters(paramString);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle self parameter
      if (trimmed === "self" || trimmed === "&self" || trimmed === "&mut self") {
        params.push({
          name: "self",
          type: trimmed,
        });
        continue;
      }

      const match = /(\w+)\s*:\s*(.+)/.exec(trimmed);
      if (match) {
        params.push({
          name: match[1],
          type: match[2],
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
      if (char === "<" || char === "(") depth++;
      else if (char === ">" || char === ")") depth--;
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
// Convenience function
// ============================================================================

export async function parseRustFile(filePath: string): Promise<RustParseResult> {
  const parser = new RustParser(filePath);
  return parser.parseFile();
}
