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

export interface PythonParseResult {
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
  decorators: string[];
}

// ============================================================================
// PythonParser - Regex-based parsing for pytest/unittest
// ============================================================================

export class PythonParser {
  private readonly filePath: string;
  private content: string = "";
  private lines: string[] = [];
  private detectedFramework: TestFramework = "pytest";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a Python file and extract tests and source methods
   */
  async parseFile(): Promise<PythonParseResult> {
    this.content = await readFile(this.filePath, "utf-8");
    this.lines = this.content.split("\n");

    this.detectFramework();
    const rawMethods = this.extractAllMethods();

    const tests: TestCase[] = [];
    const methods: SourceMethod[] = [];

    for (const raw of rawMethods) {
      if (raw.isTest) {
        tests.push(this.convertToTestCase(raw));
      } else {
        methods.push(this.convertToSourceMethod(raw));
      }
    }

    return { tests, methods };
  }

  // ==========================================================================
  // Framework Detection
  // ==========================================================================

  private detectFramework(): void {
    if (this.content.includes("import unittest") || this.content.includes("from unittest")) {
      this.detectedFramework = "unittest";
    } else {
      this.detectedFramework = "pytest";
    }
  }

  // ==========================================================================
  // Method Extraction
  // ==========================================================================

  private extractAllMethods(): RawMethod[] {
    const methods: RawMethod[] = [];

    // Pattern for Python function/method definitions
    // Matches: def name(params): or async def name(params):
    const defPattern = /^(\s*)((?:@\w+(?:\([^)]*\))?\s*\n\s*)*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^\s:]+))?\s*:/gm;

    let match;
    while ((match = defPattern.exec(this.content)) !== null) {
      const indent = match[1];
      const decoratorsBlock = match[2] ?? "";
      const isAsync = !!match[3];
      const name = match[4];
      const parameters = match[5] ?? "";
      const returnType = match[6] ?? "None";

      const startIndex = match.index;
      const lineNumber = this.getLineNumber(startIndex);

      // Extract decorators
      const decorators = this.extractDecorators(decoratorsBlock);

      // Determine if it's a test
      const isTest = this.isTestMethod(name, decorators);

      // Find the method body by tracking indentation
      const { body, endLine } = this.extractMethodBody(lineNumber, indent.length);

      methods.push({
        name,
        lineNumber,
        endLine,
        body,
        isTest,
        isAsync,
        returnType,
        parameters,
        decorators,
      });
    }

    return methods;
  }

  private extractDecorators(decoratorsBlock: string): string[] {
    const decorators: string[] = [];
    const decoratorPattern = /@(\w+)(?:\([^)]*\))?/g;

    let match;
    while ((match = decoratorPattern.exec(decoratorsBlock)) !== null) {
      decorators.push(match[1]);
    }

    return decorators;
  }

  private isTestMethod(name: string, decorators: string[]): boolean {
    // pytest convention: test_ prefix
    if (name.startsWith("test_") || name.startsWith("test")) {
      return true;
    }

    // unittest convention: test prefix in TestCase class
    if (decorators.includes("pytest") || decorators.includes("mark")) {
      return true;
    }

    return false;
  }

  private extractMethodBody(startLine: number, baseIndent: number): { body: string; endLine: number } {
    const bodyLines: string[] = [];
    let endLine = startLine;
    let inMethod = false;

    for (let i = startLine - 1; i < this.lines.length; i++) {
      const line = this.lines[i];
      const trimmedLine = line.trim();

      if (i === startLine - 1) {
        // First line (def statement)
        bodyLines.push(line);
        inMethod = true;
        continue;
      }

      if (!inMethod) continue;

      // Empty lines or comments are ok
      if (trimmedLine === "" || trimmedLine.startsWith("#")) {
        bodyLines.push(line);
        endLine = i + 1;
        continue;
      }

      // Calculate current line indent
      const currentIndent = line.length - line.trimStart().length;

      // If we're back to base indent or less (and not empty), method ended
      if (currentIndent <= baseIndent && trimmedLine !== "") {
        break;
      }

      bodyLines.push(line);
      endLine = i + 1;
    }

    return { body: bodyLines.join("\n"), endLine };
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

    // Python assertion patterns
    const patterns: Array<{
      regex: RegExp;
      type: AssertionType;
      extractor: (match: RegExpExecArray) => { expected: string | null; actual: string | null };
    }> = [
      // assert expression == expected
      {
        regex: /assert\s+([^=!<>]+)\s*==\s*([^\n#]+)/g,
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: m[2]?.trim() ?? null }),
      },
      // assert expression != expected
      {
        regex: /assert\s+([^=!<>]+)\s*!=\s*([^\n#]+)/g,
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: `NOT ${m[2]?.trim()}` }),
      },
      // assert expression (truthy)
      {
        regex: /assert\s+([^=!<>\n#]+)(?:\s*#|$|\n)/g,
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "truthy" }),
      },
      // assert not expression
      {
        regex: /assert\s+not\s+([^\n#]+)/g,
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "falsy" }),
      },
      // assertEqual(expected, actual) - unittest
      {
        regex: /self\.assertEqual\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
        type: "equals",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: m[2]?.trim() ?? null }),
      },
      // assertEquals (alias)
      {
        regex: /self\.assertEquals\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
        type: "equals",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: m[2]?.trim() ?? null }),
      },
      // assertTrue
      {
        regex: /self\.assertTrue\s*\(\s*([^)]+)\)/g,
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "True" }),
      },
      // assertFalse
      {
        regex: /self\.assertFalse\s*\(\s*([^)]+)\)/g,
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "False" }),
      },
      // assertIsNone
      {
        regex: /self\.assertIsNone\s*\(\s*([^)]+)\)/g,
        type: "equals",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "None" }),
      },
      // assertIsNotNone
      {
        regex: /self\.assertIsNotNone\s*\(\s*([^)]+)\)/g,
        type: "truthy",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: "not None" }),
      },
      // assertRaises - unittest
      {
        regex: /self\.assertRaises\s*\(\s*(\w+)/g,
        type: "throws",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: null }),
      },
      // pytest.raises
      {
        regex: /pytest\.raises\s*\(\s*(\w+)/g,
        type: "throws",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: null }),
      },
      // with pytest.raises
      {
        regex: /with\s+pytest\.raises\s*\(\s*(\w+)/g,
        type: "throws",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: null }),
      },
      // assertIn
      {
        regex: /self\.assertIn\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
        type: "contains",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: m[2]?.trim() ?? null }),
      },
      // assert x in y
      {
        regex: /assert\s+([^\s]+)\s+in\s+([^\n#]+)/g,
        type: "contains",
        extractor: (m) => ({ expected: m[1]?.trim() ?? null, actual: m[2]?.trim() ?? null }),
      },
      // assertGreater
      {
        regex: /self\.assertGreater\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
        type: "other",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: `> ${m[2]?.trim()}` }),
      },
      // assertLess
      {
        regex: /self\.assertLess\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g,
        type: "other",
        extractor: (m) => ({ actual: m[1]?.trim() ?? null, expected: `< ${m[2]?.trim()}` }),
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
    const paramParts = this.splitParameters(paramString);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === "self" || trimmed === "cls") continue;

      // Match: name: Type = default or name = default or name: Type or just name
      // Also handle *args and **kwargs
      if (trimmed.startsWith("*")) {
        params.push({
          name: trimmed,
          type: "any",
        });
        continue;
      }

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
      if (char === "[" || char === "{" || char === "(") depth++;
      else if (char === "]" || char === "}" || char === ")") depth--;
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

export async function parsePythonFile(filePath: string): Promise<PythonParseResult> {
  const parser = new PythonParser(filePath);
  return parser.parseFile();
}
