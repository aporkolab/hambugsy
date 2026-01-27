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

export interface CSharpParseResult {
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
  visibility: string;
  returnType: string;
  parameters: string;
  attributes: string[];
  className?: string;
}

// ============================================================================
// CSharpParser - Regex-based parsing for C# source files
// ============================================================================

export class CSharpParser {
  private readonly filePath: string;
  private content: string = "";

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Parse a C# file and extract tests and source methods
   */
  async parseFile(): Promise<CSharpParseResult> {
    this.content = await readFile(this.filePath, "utf-8");

    const namespaceName = this.extractNamespace();
    const className = this.extractClassName();
    const rawMethods = this.extractAllMethods();

    const tests: TestCase[] = [];
    const methods: SourceMethod[] = [];

    for (const raw of rawMethods) {
      if (raw.isTest) {
        tests.push(this.convertToTestCase(raw));
      } else {
        methods.push(this.convertToSourceMethod(raw, namespaceName, className));
      }
    }

    return { tests, methods };
  }

  // ==========================================================================
  // Namespace/Class Extraction
  // ==========================================================================

  private extractNamespace(): string | undefined {
    const nsMatch = /namespace\s+([\w.]+)/.exec(this.content);
    return nsMatch?.[1];
  }

  private extractClassName(): string | undefined {
    const classMatch = /(?:public|internal|private|protected)?\s*(?:partial\s+)?(?:static\s+)?class\s+(\w+)/.exec(this.content);
    return classMatch?.[1];
  }

  // ==========================================================================
  // Method Extraction
  // ==========================================================================

  private extractAllMethods(): RawMethod[] {
    const methods: RawMethod[] = [];
    const lines = this.content.split("\n");
    let currentAttributes: string[] = [];
    let currentClassName: string | undefined;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track current class
      const classMatch = /(?:public|internal|private|protected)?\s*(?:partial\s+)?(?:static\s+)?class\s+(\w+)/.exec(trimmed);
      if (classMatch) {
        currentClassName = classMatch[1];
      }

      // Collect attributes
      if (trimmed.startsWith("[")) {
        const attrMatch = /\[([^\]]+)\]/.exec(trimmed);
        if (attrMatch) {
          currentAttributes.push(attrMatch[1]);
        }
        i++;
        continue;
      }

      // Check for method declaration
      const methodMatch = /^(public|private|protected|internal)?\s*(static\s+)?(async\s+)?(virtual\s+)?(override\s+)?([\w<>[\],\s?]+)\s+(\w+)\s*\(([^)]*)\)\s*\{?/.exec(trimmed);
      if (methodMatch) {
        const visibility = methodMatch[1] || "private";
        const isAsync = !!methodMatch[3];
        const returnType = methodMatch[6]?.trim() || "void";
        const name = methodMatch[7];
        const parameters = methodMatch[8] ?? "";

        // Check for test attributes
        const testAttributes = [
          "Test", "TestMethod", "Fact", "Theory",
          "TestCase", "NUnit.Framework.Test", "Xunit.Fact",
          "Microsoft.VisualStudio.TestTools.UnitTesting.TestMethod"
        ];
        const isTest = currentAttributes.some(a =>
          testAttributes.some(ta => a.includes(ta))
        );

        const lineNumber = i + 1;
        const startIndex = this.getIndexFromLine(lineNumber);

        // Find the method body
        const bodyStartIndex = this.content.indexOf("{", startIndex);
        const { body, endIndex } = this.extractMethodBody(bodyStartIndex);
        const endLine = this.getLineNumber(endIndex);

        methods.push({
          name,
          lineNumber,
          endLine,
          body,
          isTest,
          isAsync,
          visibility,
          returnType,
          parameters,
          attributes: [...currentAttributes],
          className: currentClassName,
        });

        currentAttributes = [];
      } else if (!trimmed.startsWith("//") && !trimmed.startsWith("/*") && trimmed !== "" && !trimmed.startsWith("[")) {
        // Not an attribute or method, clear attributes (but keep for next line)
        if (!trimmed.startsWith("{") && !trimmed.startsWith("}")) {
          // Only clear if it's not a brace-only line
          // currentAttributes = [];
        }
      }

      i++;
    }

    return methods;
  }

  private getIndexFromLine(lineNumber: number): number {
    const lines = this.content.split("\n");
    let index = 0;
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      index += lines[i].length + 1;
    }
    return index;
  }

  private extractMethodBody(startIndex: number): { body: string; endIndex: number } {
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

  private convertToTestCase(raw: RawMethod): TestCase {
    const assertions = this.extractAssertions(raw.body, raw.lineNumber);

    // Determine framework from attributes
    let framework = "nunit";
    if (raw.attributes.some(a => a.includes("Fact") || a.includes("Theory"))) {
      framework = "xunit";
    } else if (raw.attributes.some(a => a.includes("TestMethod"))) {
      framework = "mstest";
    }

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      framework: framework as TestCase["framework"],
      assertions,
      body: raw.body,
    };
  }

  // ==========================================================================
  // Assertion Extraction
  // ==========================================================================

  private extractAssertions(body: string, baseLineNumber: number): Assertion[] {
    const assertions: Assertion[] = [];

    // NUnit: Assert.AreEqual(expected, actual)
    const assertAreEqualPattern = /Assert\.AreEqual\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertAreEqualPattern, "equals", assertions, (match) => ({
      expected: match[1]?.trim() ?? null,
      actual: match[2]?.trim() ?? null,
    }));

    // NUnit: Assert.AreNotEqual(expected, actual)
    const assertAreNotEqualPattern = /Assert\.AreNotEqual\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertAreNotEqualPattern, "equals", assertions, (match) => ({
      expected: `NOT ${match[1]?.trim()}`,
      actual: match[2]?.trim() ?? null,
    }));

    // NUnit: Assert.That(actual, Is.EqualTo(expected))
    const assertThatEqualPattern = /Assert\.That\s*\(\s*([^,]+)\s*,\s*Is\.EqualTo\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertThatEqualPattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    // NUnit: Assert.IsTrue / Assert.True
    const assertIsTruePattern = /Assert\.(?:IsTrue|True)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertIsTruePattern, "truthy", assertions, (match) => ({
      expected: "true",
      actual: match[1]?.trim() ?? null,
    }));

    // NUnit: Assert.IsFalse / Assert.False
    const assertIsFalsePattern = /Assert\.(?:IsFalse|False)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertIsFalsePattern, "truthy", assertions, (match) => ({
      expected: "false",
      actual: match[1]?.trim() ?? null,
    }));

    // NUnit: Assert.IsNull / Assert.Null
    const assertIsNullPattern = /Assert\.(?:IsNull|Null)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertIsNullPattern, "equals", assertions, (match) => ({
      expected: "null",
      actual: match[1]?.trim() ?? null,
    }));

    // NUnit: Assert.IsNotNull / Assert.NotNull
    const assertIsNotNullPattern = /Assert\.(?:IsNotNull|NotNull)\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, assertIsNotNullPattern, "truthy", assertions, (match) => ({
      expected: "NOT null",
      actual: match[1]?.trim() ?? null,
    }));

    // NUnit: Assert.Throws<Exception>
    const assertThrowsPattern = /Assert\.Throws\s*<(\w+)>\s*\(/g;
    this.extractAssertionMatches(body, baseLineNumber, assertThrowsPattern, "throws", assertions, (match) => ({
      expected: match[1] ?? null,
      actual: null,
    }));

    // xUnit: Assert.Equal(expected, actual)
    const xunitEqualPattern = /Assert\.Equal\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, xunitEqualPattern, "equals", assertions, (match) => ({
      expected: match[1]?.trim() ?? null,
      actual: match[2]?.trim() ?? null,
    }));

    // xUnit: Assert.NotEqual
    const xunitNotEqualPattern = /Assert\.NotEqual\s*\(\s*([^,]+)\s*,\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, xunitNotEqualPattern, "equals", assertions, (match) => ({
      expected: `NOT ${match[1]?.trim()}`,
      actual: match[2]?.trim() ?? null,
    }));

    // FluentAssertions: .Should().Be() / .Should().BeEquivalentTo()
    const fluentBePattern = /(\w+)\.Should\(\)\.Be\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentBePattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    const fluentBeEquivalentPattern = /(\w+)\.Should\(\)\.BeEquivalentTo\s*\(\s*([^)]+)\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentBeEquivalentPattern, "equals", assertions, (match) => ({
      expected: match[2]?.trim() ?? null,
      actual: match[1]?.trim() ?? null,
    }));

    // FluentAssertions: .Should().BeTrue() / .Should().BeFalse()
    const fluentBeTruePattern = /(\w+)\.Should\(\)\.BeTrue\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentBeTruePattern, "truthy", assertions, (match) => ({
      expected: "true",
      actual: match[1]?.trim() ?? null,
    }));

    const fluentBeFalsePattern = /(\w+)\.Should\(\)\.BeFalse\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentBeFalsePattern, "truthy", assertions, (match) => ({
      expected: "false",
      actual: match[1]?.trim() ?? null,
    }));

    // FluentAssertions: .Should().BeNull() / .Should().NotBeNull()
    const fluentBeNullPattern = /(\w+)\.Should\(\)\.BeNull\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentBeNullPattern, "equals", assertions, (match) => ({
      expected: "null",
      actual: match[1]?.trim() ?? null,
    }));

    const fluentNotBeNullPattern = /(\w+)\.Should\(\)\.NotBeNull\(\)/g;
    this.extractAssertionMatches(body, baseLineNumber, fluentNotBeNullPattern, "truthy", assertions, (match) => ({
      expected: "NOT null",
      actual: match[1]?.trim() ?? null,
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

  private convertToSourceMethod(raw: RawMethod, namespaceName?: string, className?: string): SourceMethod {
    const parameters = this.parseParameters(raw.parameters);

    return {
      name: raw.name,
      filePath: this.filePath,
      lineNumber: raw.lineNumber,
      endLine: raw.endLine,
      parameters,
      returnType: raw.returnType,
      body: raw.body,
      className: raw.className || className,
    };
  }

  private parseParameters(paramString: string): Parameter[] {
    if (!paramString.trim()) {
      return [];
    }

    const params: Parameter[] = [];
    const parts = this.splitParameters(paramString);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // C# params: [attributes] [modifiers] Type name [= default]
      // Handle: out, ref, in, params keywords
      const match = /(?:(?:out|ref|in|params)\s+)?([\w<>[\],\s?]+)\s+(\w+)(?:\s*=\s*(.+))?/.exec(trimmed);
      if (match) {
        params.push({
          name: match[2],
          type: match[1].trim(),
          defaultValue: match[3]?.trim(),
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
      if (char === "<" || char === "[") depth++;
      else if (char === ">" || char === "]") depth--;
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

export async function parseCSharpFile(filePath: string): Promise<CSharpParseResult> {
  const parser = new CSharpParser(filePath);
  return parser.parseFile();
}
