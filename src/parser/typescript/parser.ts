import { readFile } from "fs/promises";
import type {
  TestCase,
  SourceMethod,
  Assertion,
  AssertionType,
  Parameter,
  TestFramework,
} from "../../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface TypeScriptParseResult {
  tests: TestCase[];
  methods: SourceMethod[];
}

interface RawMethod {
  name: string;
  lineNumber: number;
  endLine: number;
  body: string;
  isTest: boolean;
  isAsync: boolean;
  returnType: string;
  parameters: string;
  className?: string;
}

// ============================================================================
// TypeScriptParser - Regex-based parsing for Jest/Vitest/Mocha
// ============================================================================

export class TypeScriptParser {
  private readonly filePath: string;
  private content: string = "";
  private detectedFramework: TestFramework = "jest";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a TypeScript/JavaScript file and extract tests and source methods
   */
  async parseFile(): Promise<TypeScriptParseResult> {
    this.content = await readFile(this.filePath, "utf-8");

    this.detectFramework();
    const rawMethods = this.extractAllMethods();
    const rawTests = this.extractTests();

    const tests: TestCase[] = rawTests.map((t) => this.convertToTestCase(t));
    const methods: SourceMethod[] = rawMethods.map((m) => this.convertToSourceMethod(m));

    return { tests, methods };
  }

  // ==========================================================================
  // Framework Detection
  // ==========================================================================

  private detectFramework(): void {
    if (this.content.includes("from 'vitest'") || this.content.includes('from "vitest"')) {
      this.detectedFramework = "vitest";
    } else if (
      this.content.includes("from 'mocha'") ||
      this.content.includes('from "mocha"') ||
      this.content.includes("require('mocha')") ||
      this.content.includes('require("mocha")') ||
      (this.content.includes("from 'chai'") || this.content.includes('from "chai"'))
    ) {
      this.detectedFramework = "mocha";
    } else {
      // Default to jest for files with describe/it/test/expect patterns
      this.detectedFramework = "jest";
    }
  }

  // ==========================================================================
  // Test Extraction
  // ==========================================================================

  private extractTests(): RawMethod[] {
    const tests: RawMethod[] = [];

    // Pattern for it(), test(), it.each(), test.each()
    // Matches: it('name', () => { ... }) or it('name', async () => { ... })
    const testPatterns = [
      // it('name', () => {}) or it('name', async () => {})
      /(?:it|test)(?:\.each\([^)]*\))?\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*(async\s*)?\([^)]*\)\s*=>\s*\{/g,
      // it('name', function() {}) or it('name', async function() {})
      /(?:it|test)\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*(async\s*)?function\s*\([^)]*\)\s*\{/g,
      // describe.each patterns
      /(?:it|test)(?:\.skip|\.only)?\s*\(\s*(['"`])([^'"`]+)\1\s*,\s*(async\s*)?\([^)]*\)\s*=>\s*\{/g,
    ];

    for (const pattern of testPatterns) {
      let match;
      while ((match = pattern.exec(this.content)) !== null) {
        const name = match[2];
        const isAsync = !!match[3];
        const startIndex = match.index;
        const lineNumber = this.getLineNumber(startIndex);

        // Find the test body by matching braces
        const bodyStartIndex = this.content.indexOf("{", startIndex);
        const { body, endIndex } = this.extractMethodBody(bodyStartIndex);
        const endLine = this.getLineNumber(endIndex);

        tests.push({
          name,
          lineNumber,
          endLine,
          body,
          isTest: true,
          isAsync,
          returnType: "void",
          parameters: "",
        });
      }
    }

    return tests;
  }

  // ==========================================================================
  // Method Extraction
  // ==========================================================================

  private extractAllMethods(): RawMethod[] {
    const methods: RawMethod[] = [];

    // Pattern for function declarations and arrow functions
    const patterns = [
      // export function name() {} or export async function name() {}
      /export\s+(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\s{]+))?\s*\{/g,
      // export const name = () => {} or export const name = async () => {}
      /export\s+const\s+(\w+)\s*=\s*(async\s*)?\([^)]*\)\s*(?::\s*([^\s=]+))?\s*=>\s*\{/g,
      // class method: name() {} or async name() {}
      /^\s+(async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\s{]+))?\s*\{/gm,
      // public/private method
      /(?:public|private|protected)\s+(async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^\s{]+))?\s*\{/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(this.content)) !== null) {
        // Skip test functions
        const fullMatch = match[0];
        if (
          fullMatch.includes("it(") ||
          fullMatch.includes("test(") ||
          fullMatch.includes("describe(") ||
          fullMatch.includes("beforeEach") ||
          fullMatch.includes("afterEach") ||
          fullMatch.includes("beforeAll") ||
          fullMatch.includes("afterAll")
        ) {
          continue;
        }

        const isAsync = !!match[1];
        const name = match[2];
        const parameters = match[3] ?? "";
        const returnType = match[4] ?? "void";

        const startIndex = match.index;
        const lineNumber = this.getLineNumber(startIndex);

        const bodyStartIndex = this.content.indexOf("{", startIndex);
        const { body, endIndex } = this.extractMethodBody(bodyStartIndex);
        const endLine = this.getLineNumber(endIndex);

        methods.push({
          name,
          lineNumber,
          endLine,
          body,
          isTest: false,
          isAsync,
          returnType,
          parameters,
        });
      }
    }

    return methods;
  }

  private extractMethodBody(startIndex: number): { body: string; endIndex: number } {
    let braceCount = 0;
    let i = startIndex;
    let started = false;

    while (i < this.content.length) {
      const char = this.content[i];

      // Skip strings
      if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        i++;
        while (i < this.content.length && this.content[i] !== quote) {
          if (this.content[i] === "\\") i++; // Skip escaped chars
          i++;
        }
      } else if (char === "{") {
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
      framework: this.detectedFramework,
      assertions,
      body: raw.body,
    };
  }

  // ==========================================================================
  // Assertion Extraction
  // ==========================================================================

  private extractAssertions(body: string, baseLineNumber: number): Assertion[] {
    const assertions: Assertion[] = [];

    // Helper to match balanced parentheses content (handles one level of nesting)
    // Using atomic-like pattern to prevent catastrophic backtracking
    // Matches: content with nested parens like "calculator.add(2, 3)" or simple "5"
    const balancedParen = "[^()]*(?:\\([^()]*\\)[^()]*)*";

    // Jest/Vitest expect patterns
    const patterns: Array<{
      regex: RegExp;
      type: AssertionType;
      extractor: (match: RegExpExecArray) => { expected: string | null; actual: string | null };
    }> = [
      // expect(actual).toBe(expected)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBe\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect(actual).toEqual(expected)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toEqual\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect(actual).toStrictEqual(expected)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toStrictEqual\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect(condition).toBeTruthy()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeTruthy\\s*\\(\\s*\\)`, "g"),
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "truthy" }),
      },
      // expect(condition).toBeFalsy()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeFalsy\\s*\\(\\s*\\)`, "g"),
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "falsy" }),
      },
      // expect(value).toBeNull()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeNull\\s*\\(\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "null" }),
      },
      // expect(value).toBeUndefined()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeUndefined\\s*\\(\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "undefined" }),
      },
      // expect(value).toBeDefined()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeDefined\\s*\\(\\s*\\)`, "g"),
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "defined" }),
      },
      // expect(fn).toThrow() or expect(fn).toThrow(Error)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toThrow\\s*\\(\\s*([^)]*)?\\s*\\)`, "g"),
        type: "throws",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() || "Error" }),
      },
      // expect(array).toContain(item)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toContain\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "contains",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect(string).toMatch(pattern)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toMatch\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "contains",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect(value).toBeGreaterThan(number)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeGreaterThan\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "other",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: `> ${m[2]?.trim()}` }),
      },
      // expect(value).toBeLessThan(number)
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeLessThan\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "other",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: `< ${m[2]?.trim()}` }),
      },
      // expect(fn).rejects.toThrow() - async throws
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.rejects\\s*\\.toThrow\\s*\\(\\s*([^)]*)?\\s*\\)`, "g"),
        type: "throws",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() || "Error" }),
      },
      // expect(fn).resolves.toBe() - async resolves
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.resolves\\s*\\.toBe\\s*\\(\\s*(${balancedParen})\\s*\\)`, "g"),
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // expect().toBeInstanceOf()
      {
        regex: new RegExp(`expect\\s*\\(\\s*(${balancedParen})\\s*\\)\\s*\\.toBeInstanceOf\\s*\\(\\s*(\\w+)\\s*\\)`, "g"),
        type: "other",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
    ];

    for (const { regex, type, extractor } of patterns) {
      let match;
      while ((match = regex.exec(body)) !== null) {
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

    return assertions;
  }

  // ==========================================================================
  // SourceMethod Conversion
  // ==========================================================================

  private convertToSourceMethod(raw: RawMethod): SourceMethod {
    const parameters = this.parseParameters(raw.parameters);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      parameters,
      returnType: raw.returnType,
      body: raw.body,
      className: raw.className,
    };
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: Parameter[] = [];
    // Split by comma, but be careful with generics and destructuring
    const paramParts = this.splitParameters(paramString);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Match: name: Type = default or name = default or name: Type
      const paramMatch = /^(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/.exec(trimmed);
      if (paramMatch) {
        params.push({
          name: paramMatch[1],
          type: paramMatch[2]?.trim() ?? "any",
          defaultValue: paramMatch[3]?.trim(),
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
      if (char === "<" || char === "{" || char === "[" || char === "(") depth++;
      else if (char === ">" || char === "}" || char === "]" || char === ")") depth--;
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

export async function parseTypeScriptFile(filePath: string): Promise<TypeScriptParseResult> {
  const parser = new TypeScriptParser(filePath);
  return parser.parseFile();
}
