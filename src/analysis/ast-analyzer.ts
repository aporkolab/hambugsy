/**
 * AST-Based Code Analysis Module
 *
 * Uses Abstract Syntax Tree parsing for accurate extraction of:
 * - Assertion expected values
 * - Return statements and their values
 * - Variable assignments and calculations
 * - Method call chains
 */

import { readFileSync } from "fs";

// ============================================================================
// Configuration Constants
// ============================================================================

/** Maximum expression length for safe evaluation (prevents DoS) */
const MAX_SAFE_EXPRESSION_LENGTH = 100;

// ============================================================================
// Types
// ============================================================================

export interface ASTAssertion {
  type: "equals" | "truthy" | "falsy" | "throws" | "contains" | "null" | "undefined";
  expectedValue: ASTValue | null;
  actualExpression: string;
  location: { line: number; column: number };
}

export interface ASTValue {
  type: "number" | "string" | "boolean" | "null" | "undefined" | "expression" | "identifier";
  value: string | number | boolean | null;
  raw: string;
}

export interface ASTReturnInfo {
  expression: string;
  value: ASTValue | null;
  location: { line: number; column: number };
  context: string;
}

export interface ASTConstant {
  name: string;
  value: ASTValue;
  location: { line: number; column: number };
  isStatic: boolean;
  isFinal: boolean;
}

export interface ASTAnalysisResult {
  assertions: ASTAssertion[];
  returns: ASTReturnInfo[];
  constants: ASTConstant[];
  calculations: Array<{
    expression: string;
    variables: string[];
    operators: string[];
    location: { line: number; column: number };
  }>;
}

// ============================================================================
// TypeScript/JavaScript AST Analysis
// ============================================================================

export function analyzeTypeScriptAST(filePath: string): ASTAnalysisResult {
  // Try to use TypeScript compiler for accurate AST analysis
  // Falls back to regex-based analysis if TypeScript is not available
  try {
    // Dynamic import of TypeScript
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ts = require("typescript");
    return analyzeWithTypeScript(filePath, ts);
  } catch {
    // TypeScript not available, use regex-based fallback
    return analyzeTypeScriptRegex(filePath);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function analyzeWithTypeScript(filePath: string, ts: any): ASTAnalysisResult {
  const content = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const result: ASTAnalysisResult = {
    assertions: [],
    returns: [],
    constants: [],
    calculations: [],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function visit(node: any) {
    // Extract assertions
    if (ts.isCallExpression(node)) {
      const assertion = extractTSAssertion(node, sourceFile, ts);
      if (assertion) {
        result.assertions.push(assertion);
      }
    }

    // Extract return statements
    if (ts.isReturnStatement(node)) {
      const returnInfo = extractTSReturn(node, sourceFile, ts);
      if (returnInfo) {
        result.returns.push(returnInfo);
      }
    }

    // Extract constants
    if (ts.isVariableDeclaration(node)) {
      const constant = extractTSConstant(node, sourceFile, ts);
      if (constant) {
        result.constants.push(constant);
      }
    }

    // Extract calculations
    if (ts.isBinaryExpression(node)) {
      const calc = extractTSCalculation(node, sourceFile, ts);
      if (calc) {
        result.calculations.push(calc);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTSAssertion(node: any, sourceFile: any, ts: any): ASTAssertion | null {
  // Handle expect().toBe() style
  if (ts.isPropertyAccessExpression(node.expression)) {
    const propAccess = node.expression;
    const methodName = propAccess.name.getText(sourceFile);

    // Find the expect() call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let expectCall: any = null;
    let current = propAccess.expression;
    while (current) {
      if (ts.isCallExpression(current)) {
        const callText = current.expression.getText(sourceFile);
        if (callText === "expect") {
          expectCall = current;
          break;
        }
        current = current.expression;
      } else if (ts.isPropertyAccessExpression(current)) {
        current = current.expression;
      } else {
        break;
      }
    }

    if (expectCall) {
      const actualExpr = expectCall.arguments[0]?.getText(sourceFile) || "";
      const expectedArg = node.arguments[0];
      const expectedValue = expectedArg ? extractTSValue(expectedArg, sourceFile, ts) : null;

      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

      let type: ASTAssertion["type"] = "equals";
      if (methodName === "toBeTruthy") type = "truthy";
      else if (methodName === "toBeFalsy") type = "falsy";
      else if (methodName === "toThrow") type = "throws";
      else if (methodName === "toContain") type = "contains";
      else if (methodName === "toBeNull") type = "null";
      else if (methodName === "toBeUndefined") type = "undefined";

      return {
        type,
        expectedValue,
        actualExpression: actualExpr,
        location: { line: line + 1, column: character + 1 },
      };
    }
  }

  // Handle assertEquals style (less common in TS/JS)
  const fnName = node.expression.getText(sourceFile);
  if (fnName.includes("assert") || fnName.includes("Assert")) {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const args = node.arguments;

    if (args.length >= 2) {
      return {
        type: "equals",
        expectedValue: extractTSValue(args[0], sourceFile, ts),
        actualExpression: args[1].getText(sourceFile),
        location: { line: line + 1, column: character + 1 },
      };
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTSReturn(node: any, sourceFile: any, ts: any): ASTReturnInfo | null {
  if (!node.expression) return null;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const expr = node.expression.getText(sourceFile);
  const value = extractTSValue(node.expression, sourceFile, ts);

  // Get surrounding context
  const startLine = Math.max(0, line - 2);
  const lines = sourceFile.getText().split("\n");
  const context = lines.slice(startLine, line + 3).join("\n");

  return {
    expression: expr,
    value,
    location: { line: line + 1, column: character + 1 },
    context,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTSConstant(node: any, sourceFile: any, ts: any): ASTConstant | null {
  if (!node.initializer) return null;

  const name = node.name.getText(sourceFile);
  const value = extractTSValue(node.initializer, sourceFile, ts);
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  // Check if it's const
  const parent = node.parent;
  const isConst = parent && ts.isVariableDeclarationList(parent) &&
    (parent.flags & ts.NodeFlags.Const) !== 0;

  return {
    name,
    value,
    location: { line: line + 1, column: character + 1 },
    isStatic: false,
    isFinal: isConst,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTSCalculation(node: any, sourceFile: any, ts: any): ASTAnalysisResult["calculations"][0] | null {
  const operators = [
    ts.SyntaxKind.PlusToken,
    ts.SyntaxKind.MinusToken,
    ts.SyntaxKind.AsteriskToken,
    ts.SyntaxKind.SlashToken,
    ts.SyntaxKind.PercentToken,
  ];

  if (!operators.includes(node.operatorToken.kind)) return null;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const expr = node.getText(sourceFile);

  // Extract variables used in calculation
  const variables: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function findIdentifiers(n: any) {
    if (ts.isIdentifier(n)) {
      variables.push(n.getText(sourceFile));
    }
    ts.forEachChild(n, findIdentifiers);
  }
  findIdentifiers(node);

  // Get operator
  const operatorMap: Record<number, string> = {
    [ts.SyntaxKind.PlusToken]: "+",
    [ts.SyntaxKind.MinusToken]: "-",
    [ts.SyntaxKind.AsteriskToken]: "*",
    [ts.SyntaxKind.SlashToken]: "/",
    [ts.SyntaxKind.PercentToken]: "%",
  };

  return {
    expression: expr,
    variables: [...new Set(variables)],
    operators: [operatorMap[node.operatorToken.kind] || "?"],
    location: { line: line + 1, column: character + 1 },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTSValue(node: any, sourceFile: any, ts: any): ASTValue {
  const raw = node.getText(sourceFile);

  if (ts.isNumericLiteral(node)) {
    return {
      type: "number",
      value: parseFloat(node.text),
      raw,
    };
  }

  if (ts.isStringLiteral(node)) {
    return {
      type: "string",
      value: node.text,
      raw,
    };
  }

  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return { type: "boolean", value: true, raw };
  }

  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return { type: "boolean", value: false, raw };
  }

  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return { type: "null", value: null, raw };
  }

  if (node.kind === ts.SyntaxKind.UndefinedKeyword) {
    return { type: "undefined", value: null, raw };
  }

  if (ts.isIdentifier(node)) {
    return {
      type: "identifier",
      value: node.text,
      raw,
    };
  }

  // For complex expressions, try to evaluate simple math expressions
  // SECURITY: Only evaluate expressions containing digits, whitespace, and basic math operators
  // The strict regex validation ensures no code injection is possible
  if (ts.isBinaryExpression(node) || ts.isParenthesizedExpression(node)) {
    try {
      // Strict validation: only allow digits, whitespace, and basic math operators (+, -, *, /, ., parentheses)
      const SAFE_MATH_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/;
      if (SAFE_MATH_PATTERN.test(raw) && raw.length < MAX_SAFE_EXPRESSION_LENGTH) {
        // Additional validation: ensure balanced parentheses
        const openParens = (raw.match(/\(/g) || []).length;
        const closeParens = (raw.match(/\)/g) || []).length;
        if (openParens === closeParens) {
          const result = Function(`"use strict"; return (${raw})`)();
          if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
            return { type: "number", value: result, raw };
          }
        }
      }
    } catch {
      // Expression evaluation failed - return as unevaluated expression
    }
  }

  return {
    type: "expression",
    value: raw,
    raw,
  };
}

// Regex-based fallback for TypeScript/JavaScript when TS compiler not available
function analyzeTypeScriptRegex(filePath: string): ASTAnalysisResult {
  const content = readFileSync(filePath, "utf8");
  const result: ASTAnalysisResult = {
    assertions: [],
    returns: [],
    constants: [],
    calculations: [],
  };

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Extract expect().toBe/toEqual assertions
    const expectMatch = line.match(/expect\s*\(\s*(.+?)\s*\)\s*\.to(?:Be|Equal|StrictEqual)\s*\(\s*(.+?)\s*\)/);
    if (expectMatch) {
      result.assertions.push({
        type: "equals",
        expectedValue: parseJSValue(expectMatch[2]),
        actualExpression: expectMatch[1].trim(),
        location: { line: lineNum, column: line.indexOf("expect") + 1 },
      });
    }

    // Extract return statements
    const returnMatch = line.match(/return\s+([^;]+);/);
    if (returnMatch) {
      result.returns.push({
        expression: returnMatch[1].trim(),
        value: parseJSValue(returnMatch[1]),
        location: { line: lineNum, column: line.indexOf("return") + 1 },
        context: lines.slice(Math.max(0, i - 2), i + 3).join("\n"),
      });
    }

    // Extract constants
    const constMatch = line.match(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=\s*([^;]+);/);
    if (constMatch) {
      result.constants.push({
        name: constMatch[1],
        value: parseJSValue(constMatch[2]),
        location: { line: lineNum, column: 1 },
        isStatic: false,
        isFinal: line.includes("const"),
      });
    }
  }

  return result;
}

function parseJSValue(expr: string): ASTValue {
  const trimmed = expr.trim();

  // Number
  const numMatch = trimmed.match(/^(-?\d+\.?\d*)$/);
  if (numMatch) {
    return {
      type: "number",
      value: parseFloat(numMatch[1]),
      raw: trimmed,
    };
  }

  // String
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      (trimmed.startsWith("`") && trimmed.endsWith("`"))) {
    return {
      type: "string",
      value: trimmed.slice(1, -1),
      raw: trimmed,
    };
  }

  // Boolean
  if (trimmed === "true") return { type: "boolean", value: true, raw: trimmed };
  if (trimmed === "false") return { type: "boolean", value: false, raw: trimmed };

  // Null/undefined
  if (trimmed === "null") return { type: "null", value: null, raw: trimmed };
  if (trimmed === "undefined") return { type: "undefined", value: null, raw: trimmed };

  return {
    type: "expression",
    value: trimmed,
    raw: trimmed,
  };
}

// ============================================================================
// Java AST Analysis (regex-based)
// ============================================================================

export function analyzeJavaCode(content: string): ASTAnalysisResult {
  const result: ASTAnalysisResult = {
    assertions: [],
    returns: [],
    constants: [],
    calculations: [],
  };

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Extract assertEquals assertions
    const assertEqualsMatch = line.match(/assertEquals\s*\(\s*(.+?)\s*,\s*(.+?)\s*[,)]/);
    if (assertEqualsMatch) {
      result.assertions.push({
        type: "equals",
        expectedValue: parseJavaValue(assertEqualsMatch[1]),
        actualExpression: assertEqualsMatch[2].trim(),
        location: { line: lineNum, column: line.indexOf("assertEquals") + 1 },
      });
    }

    // Extract assertThat().isEqualTo()
    const assertThatMatch = line.match(/assertThat\s*\(\s*(.+?)\s*\)\s*\.isEqualTo\s*\(\s*(.+?)\s*\)/);
    if (assertThatMatch) {
      result.assertions.push({
        type: "equals",
        expectedValue: parseJavaValue(assertThatMatch[2]),
        actualExpression: assertThatMatch[1].trim(),
        location: { line: lineNum, column: line.indexOf("assertThat") + 1 },
      });
    }

    // Extract return statements
    const returnMatch = line.match(/return\s+([^;]+);/);
    if (returnMatch) {
      result.returns.push({
        expression: returnMatch[1].trim(),
        value: parseJavaValue(returnMatch[1]),
        location: { line: lineNum, column: line.indexOf("return") + 1 },
        context: lines.slice(Math.max(0, i - 2), i + 3).join("\n"),
      });
    }

    // Extract constants
    const constMatch = line.match(/(?:private|public|protected)?\s*(?:static\s+)?(?:final\s+)?(\w+)\s+(\w+)\s*=\s*([^;]+);/);
    if (constMatch) {
      const isFinal = line.includes("final");
      const isStatic = line.includes("static");
      result.constants.push({
        name: constMatch[2],
        value: parseJavaValue(constMatch[3]),
        location: { line: lineNum, column: 1 },
        isStatic,
        isFinal,
      });
    }

    // Extract calculations
    const calcMatch = line.match(/(\w+)\s*([\+\-\*\/])\s*(\d+\.?\d*)/);
    if (calcMatch) {
      result.calculations.push({
        expression: calcMatch[0],
        variables: [calcMatch[1]],
        operators: [calcMatch[2]],
        location: { line: lineNum, column: line.indexOf(calcMatch[0]) + 1 },
      });
    }
  }

  return result;
}

function parseJavaValue(expr: string): ASTValue {
  const trimmed = expr.trim();

  // Number (including d/f suffixes)
  const numMatch = trimmed.match(/^(-?\d+\.?\d*)[dDfFlL]?$/);
  if (numMatch) {
    return {
      type: "number",
      value: parseFloat(numMatch[1]),
      raw: trimmed,
    };
  }

  // String
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return {
      type: "string",
      value: trimmed.slice(1, -1),
      raw: trimmed,
    };
  }

  // Boolean
  if (trimmed === "true") return { type: "boolean", value: true, raw: trimmed };
  if (trimmed === "false") return { type: "boolean", value: false, raw: trimmed };

  // Null
  if (trimmed === "null") return { type: "null", value: null, raw: trimmed };

  // Expression
  return {
    type: "expression",
    value: trimmed,
    raw: trimmed,
  };
}

// ============================================================================
// Python AST Analysis (regex-based)
// ============================================================================

export function analyzePythonCode(content: string): ASTAnalysisResult {
  const result: ASTAnalysisResult = {
    assertions: [],
    returns: [],
    constants: [],
    calculations: [],
  };

  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Extract assert statements
    const assertMatch = line.match(/assert\s+(.+?)\s*==\s*(.+?)(?:\s*$|\s*#|\s*,)/);
    if (assertMatch) {
      result.assertions.push({
        type: "equals",
        expectedValue: parsePythonValue(assertMatch[2]),
        actualExpression: assertMatch[1].trim(),
        location: { line: lineNum, column: line.indexOf("assert") + 1 },
      });
    }

    // Extract assertEqual
    const assertEqualMatch = line.match(/assertEqual\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
    if (assertEqualMatch) {
      result.assertions.push({
        type: "equals",
        expectedValue: parsePythonValue(assertEqualMatch[2]),
        actualExpression: assertEqualMatch[1].trim(),
        location: { line: lineNum, column: line.indexOf("assertEqual") + 1 },
      });
    }

    // Extract return statements
    const returnMatch = line.match(/return\s+(.+?)(?:\s*$|\s*#)/);
    if (returnMatch) {
      result.returns.push({
        expression: returnMatch[1].trim(),
        value: parsePythonValue(returnMatch[1]),
        location: { line: lineNum, column: line.indexOf("return") + 1 },
        context: lines.slice(Math.max(0, i - 2), i + 3).join("\n"),
      });
    }

    // Extract constants (UPPER_CASE = value)
    const constMatch = line.match(/^([A-Z_]+)\s*=\s*(.+?)(?:\s*$|\s*#)/);
    if (constMatch) {
      result.constants.push({
        name: constMatch[1],
        value: parsePythonValue(constMatch[2]),
        location: { line: lineNum, column: 1 },
        isStatic: true,
        isFinal: true,
      });
    }
  }

  return result;
}

function parsePythonValue(expr: string): ASTValue {
  const trimmed = expr.trim();

  // Number
  const numMatch = trimmed.match(/^(-?\d+\.?\d*)$/);
  if (numMatch) {
    return {
      type: "number",
      value: parseFloat(numMatch[1]),
      raw: trimmed,
    };
  }

  // String
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return {
      type: "string",
      value: trimmed.slice(1, -1),
      raw: trimmed,
    };
  }

  // Boolean
  if (trimmed === "True") return { type: "boolean", value: true, raw: trimmed };
  if (trimmed === "False") return { type: "boolean", value: false, raw: trimmed };

  // None
  if (trimmed === "None") return { type: "null", value: null, raw: trimmed };

  return {
    type: "expression",
    value: trimmed,
    raw: trimmed,
  };
}

// ============================================================================
// Cross-Language Comparison
// ============================================================================

export interface ComparisonResult {
  match: boolean;
  expectedValue: ASTValue | null;
  actualValue: ASTValue | null;
  mismatchType: "value" | "type" | "none";
  details: string;
}

export function compareAssertionToSource(
  assertion: ASTAssertion,
  sourceAnalysis: ASTAnalysisResult
): ComparisonResult {
  if (!assertion.expectedValue) {
    return {
      match: true,
      expectedValue: null,
      actualValue: null,
      mismatchType: "none",
      details: "No expected value to compare",
    };
  }

  // Look for matching return statements
  for (const ret of sourceAnalysis.returns) {
    if (ret.value && assertion.expectedValue.type === "number" && ret.value.type === "number") {
      const expected = assertion.expectedValue.value as number;
      const actual = ret.value.value as number;

      if (Math.abs(expected - actual) < 0.0001) {
        return {
          match: true,
          expectedValue: assertion.expectedValue,
          actualValue: ret.value,
          mismatchType: "none",
          details: `Match found: assertion expects ${expected}, return provides ${actual}`,
        };
      } else {
        return {
          match: false,
          expectedValue: assertion.expectedValue,
          actualValue: ret.value,
          mismatchType: "value",
          details: `Mismatch: assertion expects ${expected}, but return has ${actual}`,
        };
      }
    }
  }

  // Look for related constants
  for (const constant of sourceAnalysis.constants) {
    if (constant.value.type === "number" && assertion.expectedValue.type === "number") {
      const expected = assertion.expectedValue.value as number;
      const constantVal = constant.value.value as number;

      // Check if constant could affect the expected value
      if (constantVal > 0 && constantVal < 1) {
        const impliedResult = 100 * (1 - constantVal);
        if (Math.abs(expected - impliedResult) < 0.01) {
          return {
            match: true,
            expectedValue: assertion.expectedValue,
            actualValue: constant.value,
            mismatchType: "none",
            details: `Constant ${constant.name}=${constantVal} consistent with expected ${expected}`,
          };
        } else if (expected >= 80 && expected < 100) {
          const expectedRate = (100 - expected) / 100;
          if (Math.abs(expectedRate - constantVal) > 0.001) {
            return {
              match: false,
              expectedValue: assertion.expectedValue,
              actualValue: constant.value,
              mismatchType: "value",
              details: `Rate mismatch: expected implies ${(expectedRate * 100).toFixed(0)}% but ${constant.name}=${(constantVal * 100).toFixed(0)}%`,
            };
          }
        }
      }
    }
  }

  return {
    match: true,
    expectedValue: assertion.expectedValue,
    actualValue: null,
    mismatchType: "none",
    details: "No direct comparison possible",
  };
}
