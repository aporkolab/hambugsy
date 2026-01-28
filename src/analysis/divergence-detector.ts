/**
 * Advanced Divergence Detection Module
 *
 * This module provides real, general-purpose divergence detection between
 * test assertions and source code behavior - not hardcoded patterns.
 *
 * Uses multiple strategies:
 * 1. Real test execution errors (most accurate)
 * 2. AST-based analysis (TypeScript/JavaScript)
 * 3. AI-powered comparison (Copilot)
 * 4. Static pattern analysis (fallback)
 */

import { readFileSync } from "fs";
import type { TestSourcePair, AnalysisResult } from "../core/types.js";
import type { CopilotBridge } from "../services/copilot.js";
import {
  analyzeTypeScriptAST,
  analyzeJavaCode,
  analyzePythonCode,
  compareAssertionToSource,
  type ASTAnalysisResult,
} from "./ast-analyzer.js";
import { detectValueMismatchFromMutations } from "./mutation-tester.js";

// ============================================================================
// Configuration Constants
// ============================================================================

/** Confidence level when no divergence is detected */
const CONFIDENCE_NO_DIVERGENCE = 0.99;
/** Confidence for real test error parsing */
const CONFIDENCE_REAL_ERROR = 0.98;
/** Confidence for exception-type errors */
const CONFIDENCE_EXCEPTION = 0.95;
/** Confidence for generic failures */
const CONFIDENCE_GENERIC_FAILURE = 0.90;
/** Confidence for AI-powered analysis */
const CONFIDENCE_AI_ANALYSIS = 0.85;
/** Confidence when AI finds no divergence */
const CONFIDENCE_AI_NO_DIVERGENCE = 0.80;
/** Confidence for AST-based analysis */
const CONFIDENCE_AST_ANALYSIS = 0.88;
/** Confidence for static analysis value mismatch */
const CONFIDENCE_STATIC_MISMATCH = 0.75;
/** Confidence for percentage/rate calculation mismatch */
const CONFIDENCE_RATE_MISMATCH = 0.80;
/** Confidence for exception mismatch */
const CONFIDENCE_STATIC_EXCEPTION = 0.70;
/** Confidence when static analysis finds nothing */
const CONFIDENCE_STATIC_NO_DIVERGENCE = 0.60;

/** Minimum ratio for similar values (70%) */
const RATIO_MIN_SIMILAR = 0.7;
/** Maximum ratio for similar values (130%) */
const RATIO_MAX_SIMILAR = 1.3;
/** Tolerance for floating-point comparison */
const FLOAT_TOLERANCE = 0.001;
/** Maximum expression length for safe evaluation */
const MAX_EXPRESSION_LENGTH = 100;

// ============================================================================
// Types
// ============================================================================

export interface AssertionInfo {
  type: "equals" | "true" | "false" | "null" | "notNull" | "throws" | "contains" | "other";
  expectedValue: string | null;
  actualExpression: string | null;
  lineNumber: number;
  raw: string;
}

export interface SourceValueInfo {
  type: "return" | "constant" | "assignment" | "calculation";
  value: string;
  expression: string;
  lineNumber: number;
  context: string; // surrounding code for context
}

export interface DivergenceResult {
  hasDivergence: boolean;
  divergence: AnalysisResult["divergence"];
  confidence: number;
  details: string;
}

// ============================================================================
// Main Detection Function
// ============================================================================

export async function detectDivergenceAdvanced(
  pair: TestSourcePair,
  copilot: CopilotBridge | null,
  realErrorMessage?: string
): Promise<DivergenceResult> {
  // Priority 1: Real test execution error (most accurate)
  if (realErrorMessage) {
    return parseRealTestError(pair, realErrorMessage);
  }

  // Extract all assertions from test
  const assertions = extractAllAssertions(pair.test.body, pair.test.filePath);

  // Read full source file for better analysis (includes class-level constants)
  let sourceContent = pair.source.body;
  try {
    sourceContent = readFileSync(pair.source.filePath, "utf8");
  } catch {
    // Fall back to method body if file read fails (e.g., permission issues, file moved)
  }

  // Extract values and expressions from source
  const sourceValues = extractSourceValues(sourceContent, pair.source.name);

  // Priority 2: Use Copilot for intelligent comparison (if available)
  if (copilot) {
    try {
      const copilotResult = await detectWithCopilot(pair, copilot, assertions, sourceValues);
      if (copilotResult.hasDivergence) {
        return copilotResult;
      }
    } catch {
      // Copilot failed, fall through to static analysis
    }
  }

  // Priority 3: Static analysis - compare assertion values with source values
  const staticResult = detectWithStaticAnalysis(pair, assertions, sourceValues);
  if (staticResult.hasDivergence) {
    return staticResult;
  }

  // Priority 4: Mutation-based value mismatch detection
  // Finds cases where a specific code change would make the test pass
  const mutationResult = detectValueMismatchFromMutations(pair);
  if (mutationResult) {
    return {
      hasDivergence: true,
      divergence: {
        type: "RETURN_VALUE_MISMATCH",
        description: mutationResult.description,
        testLine: pair.test.lineNumber,
        codeLine: mutationResult.codeLine,
        expected: mutationResult.expected,
        actual: mutationResult.actual,
      },
      confidence: mutationResult.confidence,
      details: `Mutation Analysis: ${mutationResult.description}`,
    };
  }

  // No divergence found
  return {
    hasDivergence: false,
    divergence: null,
    confidence: CONFIDENCE_NO_DIVERGENCE,
    details: "No divergence detected between test expectations and code behavior",
  };
}

// ============================================================================
// Real Test Error Parsing
// ============================================================================

function parseRealTestError(
  pair: TestSourcePair,
  errorMessage: string
): DivergenceResult {
  const errorLower = errorMessage.toLowerCase();

  // Pattern: "Expected X but got Y" or "expected: X actual: Y"
  const patterns = [
    /expected[:\s]+[<\[]?([^\n\]>]+)[>\]]?\s*(?:but\s+(?:was|got)|actual)[:\s]+[<\[]?([^\n\]>]+)/i,
    /expected[:\s]+([^\n]+)\s+to\s+(?:equal|be|match)\s+([^\n]+)/i,
    /AssertionError[:\s]+([^\n]+)\s*!==?\s*([^\n]+)/i,
    /(\S+)\s*!==?\s*(\S+)/,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      return {
        hasDivergence: true,
        divergence: {
          type: "RETURN_VALUE_MISMATCH",
          description: `Test assertion failed: expected ${match[1].trim()} but got ${match[2].trim()}`,
          testLine: pair.test.lineNumber,
          codeLine: pair.source.lineNumber,
          expected: match[1].trim(),
          actual: match[2].trim(),
        },
        confidence: CONFIDENCE_REAL_ERROR,
        details: errorMessage,
      };
    }
  }

  // Exception errors
  if (errorLower.includes("exception") || errorLower.includes("error") || errorLower.includes("throw")) {
    return {
      hasDivergence: true,
      divergence: {
        type: "EXCEPTION_MISMATCH",
        description: `Exception occurred: ${errorMessage.split("\n")[0]}`,
        testLine: pair.test.lineNumber,
        codeLine: pair.source.lineNumber,
        expected: "no exception or different exception",
        actual: errorMessage.split("\n")[0],
      },
      confidence: CONFIDENCE_EXCEPTION,
      details: errorMessage,
    };
  }

  // Generic failure
  return {
    hasDivergence: true,
    divergence: {
      type: "RETURN_VALUE_MISMATCH",
      description: `Test failed: ${errorMessage.split("\n")[0]}`,
      testLine: pair.test.lineNumber,
      codeLine: pair.source.lineNumber,
      expected: "test to pass",
      actual: "test failed",
    },
    confidence: CONFIDENCE_GENERIC_FAILURE,
    details: errorMessage,
  };
}

// ============================================================================
// Assertion Extraction
// ============================================================================

function extractAllAssertions(testBody: string, _filePath: string): AssertionInfo[] {
  const assertions: AssertionInfo[] = [];
  const lines = testBody.split("\n");

  // Comprehensive assertion patterns for multiple languages/frameworks
  const assertionPatterns: Array<{
    pattern: RegExp;
    type: AssertionInfo["type"];
    expectedGroup: number;
    actualGroup?: number;
  }> = [
    // Java JUnit
    { pattern: /assertEquals\s*\(\s*(.+?)\s*,\s*(.+?)\s*[,)]/g, type: "equals", expectedGroup: 1, actualGroup: 2 },
    { pattern: /assertThat\s*\(\s*(.+?)\s*\)\s*\.isEqualTo\s*\(\s*(.+?)\s*\)/g, type: "equals", expectedGroup: 2, actualGroup: 1 },
    { pattern: /assertTrue\s*\(\s*(.+?)\s*\)/g, type: "true", expectedGroup: 1 },
    { pattern: /assertFalse\s*\(\s*(.+?)\s*\)/g, type: "false", expectedGroup: 1 },
    { pattern: /assertNull\s*\(\s*(.+?)\s*\)/g, type: "null", expectedGroup: 1 },
    { pattern: /assertNotNull\s*\(\s*(.+?)\s*\)/g, type: "notNull", expectedGroup: 1 },
    { pattern: /assertThrows\s*\(\s*(\w+)\.class/g, type: "throws", expectedGroup: 1 },

    // JavaScript/TypeScript Jest/Vitest
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toBe\s*\(\s*(.+?)\s*\)/g, type: "equals", expectedGroup: 2, actualGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toEqual\s*\(\s*(.+?)\s*\)/g, type: "equals", expectedGroup: 2, actualGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toStrictEqual\s*\(\s*(.+?)\s*\)/g, type: "equals", expectedGroup: 2, actualGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toBeTruthy\s*\(\s*\)/g, type: "true", expectedGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toBeFalsy\s*\(\s*\)/g, type: "false", expectedGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toBeNull\s*\(\s*\)/g, type: "null", expectedGroup: 1 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toThrow\s*\(\s*(.+?)?\s*\)/g, type: "throws", expectedGroup: 2 },
    { pattern: /expect\s*\(\s*(.+?)\s*\)\s*\.toContain\s*\(\s*(.+?)\s*\)/g, type: "contains", expectedGroup: 2, actualGroup: 1 },

    // Python pytest/unittest
    { pattern: /assert\s+(.+?)\s*==\s*(.+?)(?:\s*$|\s*#)/gm, type: "equals", expectedGroup: 2, actualGroup: 1 },
    { pattern: /assertEqual\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/g, type: "equals", expectedGroup: 1, actualGroup: 2 },
    { pattern: /assertAlmostEqual\s*\(\s*(.+?)\s*,\s*(.+?)\s*[,)]/g, type: "equals", expectedGroup: 1, actualGroup: 2 },
    { pattern: /assertTrue\s*\(\s*(.+?)\s*\)/g, type: "true", expectedGroup: 1 },
    { pattern: /assertFalse\s*\(\s*(.+?)\s*\)/g, type: "false", expectedGroup: 1 },
    { pattern: /assertIsNone\s*\(\s*(.+?)\s*\)/g, type: "null", expectedGroup: 1 },
    { pattern: /assertRaises\s*\(\s*(\w+)/g, type: "throws", expectedGroup: 1 },
    { pattern: /pytest\.raises\s*\(\s*(\w+)/g, type: "throws", expectedGroup: 1 },
  ];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    for (const { pattern, type, expectedGroup, actualGroup } of assertionPatterns) {
      // Reset regex state
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(line)) !== null) {
        assertions.push({
          type,
          expectedValue: match[expectedGroup]?.trim() || null,
          actualExpression: actualGroup ? match[actualGroup]?.trim() || null : null,
          lineNumber,
          raw: match[0],
        });
      }
    }
  }

  return assertions;
}

// ============================================================================
// Source Value Extraction
// ============================================================================

function extractSourceValues(sourceContent: string, methodName: string): SourceValueInfo[] {
  const values: SourceValueInfo[] = [];

  // Find the method body
  const methodStart = findMethodStart(sourceContent, methodName);
  const relevantContent = methodStart >= 0 ? sourceContent.substring(methodStart) : sourceContent;

  // Extract return statements
  const returnPattern = /return\s+([^;]+);/g;
  let match;
  while ((match = returnPattern.exec(relevantContent)) !== null) {
    const lineNum = getLineNumber(relevantContent, match.index);
    values.push({
      type: "return",
      value: evaluateExpression(match[1].trim()),
      expression: match[1].trim(),
      lineNumber: lineNum + (methodStart >= 0 ? getLineNumber(sourceContent, methodStart) : 0),
      context: getContext(relevantContent, match.index),
    });
  }

  // Extract constants (class-level and method-level)
  const constantPatterns = [
    /(?:final\s+|const\s+|static\s+)*(?:double|float|int|long|number)\s+(\w+)\s*=\s*([^;]+);/gi,
    /(?:private|public|protected)?\s*(?:static\s+)?(?:final\s+)?(\w+)\s*=\s*(-?\d+\.?\d*)\s*;/gi,
    /(\w+)\s*:\s*number\s*=\s*([^;]+);/gi,
  ];

  for (const pattern of constantPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(sourceContent)) !== null) {
      const lineNum = getLineNumber(sourceContent, match.index);
      values.push({
        type: "constant",
        value: evaluateExpression(match[2].trim()),
        expression: `${match[1]} = ${match[2].trim()}`,
        lineNumber: lineNum,
        context: getContext(sourceContent, match.index),
      });
    }
  }

  // Extract calculations (e.g., price * 0.85)
  const calcPatterns = [
    /(\w+)\s*\*\s*(\d+\.?\d*)/g,
    /(\w+)\s*-\s*(\w+)\s*\*\s*(\d+\.?\d*)/g,
  ];

  for (const pattern of calcPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(relevantContent)) !== null) {
      const lineNum = getLineNumber(relevantContent, match.index);
      values.push({
        type: "calculation",
        value: match[0],
        expression: match[0],
        lineNumber: lineNum + (methodStart >= 0 ? getLineNumber(sourceContent, methodStart) : 0),
        context: getContext(relevantContent, match.index),
      });
    }
  }

  return values;
}

function findMethodStart(content: string, methodName: string): number {
  // Look for method definition
  const patterns = [
    new RegExp(`(?:public|private|protected)?\\s*(?:static\\s+)?\\w+\\s+${methodName}\\s*\\(`, "i"),
    new RegExp(`function\\s+${methodName}\\s*\\(`, "i"),
    new RegExp(`${methodName}\\s*=\\s*(?:async\\s+)?(?:function|\\()`, "i"),
    new RegExp(`def\\s+${methodName}\\s*\\(`, "i"),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match) {
      return match.index;
    }
  }

  return -1;
}

function evaluateExpression(expr: string): string {
  // Try to evaluate simple numeric expressions
  const cleaned = expr.replace(/[dDfFlL]$/, ""); // Remove type suffixes

  try {
    // SECURITY: Only evaluate if it's a simple numeric expression
    // Strict validation: only digits, whitespace, and basic math operators
    const SAFE_MATH_PATTERN = /^[\d\s\+\-\*\/\.\(\)]+$/;
    if (SAFE_MATH_PATTERN.test(cleaned) && cleaned.length < MAX_EXPRESSION_LENGTH) {
      // Additional validation: ensure balanced parentheses
      const openParens = (cleaned.match(/\(/g) || []).length;
      const closeParens = (cleaned.match(/\)/g) || []).length;
      if (openParens === closeParens) {
        const result = Function(`"use strict"; return (${cleaned})`)();
        if (typeof result === "number" && isFinite(result)) {
          return String(result);
        }
      }
    }
  } catch {
    // Expression evaluation failed, return original
  }

  return cleaned;
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}

function getContext(content: string, index: number, range: number = 50): string {
  const start = Math.max(0, index - range);
  const end = Math.min(content.length, index + range);
  return content.substring(start, end).replace(/\n/g, " ").trim();
}

// ============================================================================
// Copilot-Based Detection
// ============================================================================

async function detectWithCopilot(
  pair: TestSourcePair,
  copilot: CopilotBridge,
  assertions: AssertionInfo[],
  sourceValues: SourceValueInfo[]
): Promise<DivergenceResult> {
  // Build a focused prompt with extracted information
  const assertionSummary = assertions
    .filter(a => a.type === "equals" && a.expectedValue)
    .map(a => `- Expects: ${a.expectedValue}`)
    .join("\n");

  const valueSummary = sourceValues
    .filter(v => v.type === "return" || v.type === "constant")
    .map(v => `- ${v.type}: ${v.expression}`)
    .join("\n");

  // Use explainDivergence for comparison
  const explanation = await copilot.explainDivergence(
    pair.test.body,
    pair.source.body
  );

  // Parse Copilot's response for divergence indicators
  const divergenceIndicators = [
    /mismatch/i,
    /different/i,
    /incorrect/i,
    /wrong/i,
    /outdated/i,
    /expects.*but.*returns/i,
    /test.*fails/i,
    /assertion.*fail/i,
    /does not match/i,
    /inconsistent/i,
  ];

  const hasDivergence = divergenceIndicators.some(pattern => pattern.test(explanation));

  if (hasDivergence) {
    // Extract specific values from Copilot's explanation
    const expectedMatch = explanation.match(/expects?\s+(?:value\s+)?[:\s]*([\d.]+|"[^"]+"|'[^']+'|\w+)/i);
    const actualMatch = explanation.match(/(?:returns?|produces?|gives?)\s+(?:value\s+)?[:\s]*([\d.]+|"[^"]+"|'[^']+'|\w+)/i);

    return {
      hasDivergence: true,
      divergence: {
        type: "RETURN_VALUE_MISMATCH",
        description: explanation.split("\n")[0].substring(0, 200),
        testLine: pair.test.lineNumber,
        codeLine: pair.source.lineNumber,
        expected: expectedMatch?.[1] || assertions[0]?.expectedValue || "expected value",
        actual: actualMatch?.[1] || sourceValues[0]?.value || "actual value",
      },
      confidence: CONFIDENCE_AI_ANALYSIS,
      details: `AI Analysis:\n${explanation}\n\nTest assertions:\n${assertionSummary}\n\nSource values:\n${valueSummary}`,
    };
  }

  return {
    hasDivergence: false,
    divergence: null,
    confidence: CONFIDENCE_AI_NO_DIVERGENCE,
    details: `AI Analysis found no clear divergence:\n${explanation}`,
  };
}

// ============================================================================
// AST-Based Detection
// ============================================================================

function detectWithAST(pair: TestSourcePair): DivergenceResult | null {
  try {
    const testPath = pair.test.filePath;
    const sourcePath = pair.source.filePath;
    const ext = testPath.split(".").pop()?.toLowerCase();

    let testAST: ASTAnalysisResult;
    let sourceAST: ASTAnalysisResult;

    // Parse based on file type
    if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
      testAST = analyzeTypeScriptAST(testPath);
      sourceAST = analyzeTypeScriptAST(sourcePath);
    } else if (ext === "java") {
      const testContent = readFileSync(testPath, "utf8");
      const sourceContent = readFileSync(sourcePath, "utf8");
      testAST = analyzeJavaCode(testContent);
      sourceAST = analyzeJavaCode(sourceContent);
    } else if (ext === "py") {
      const testContent = readFileSync(testPath, "utf8");
      const sourceContent = readFileSync(sourcePath, "utf8");
      testAST = analyzePythonCode(testContent);
      sourceAST = analyzePythonCode(sourceContent);
    } else {
      return null; // Unknown file type
    }

    // Compare each assertion with source
    for (const assertion of testAST.assertions) {
      const comparison = compareAssertionToSource(assertion, sourceAST);

      if (!comparison.match && comparison.mismatchType === "value") {
        return {
          hasDivergence: true,
          divergence: {
            type: "RETURN_VALUE_MISMATCH",
            description: comparison.details,
            testLine: assertion.location.line,
            codeLine: comparison.actualValue ?
              sourceAST.returns[0]?.location.line || pair.source.lineNumber :
              pair.source.lineNumber,
            expected: comparison.expectedValue?.raw || "expected value",
            actual: comparison.actualValue?.raw || "actual value",
          },
          confidence: CONFIDENCE_AST_ANALYSIS,
          details: `AST Analysis: ${comparison.details}`,
        };
      }
    }

    return null; // No divergence found by AST
  } catch {
    return null; // AST parsing failed, fall back to other methods
  }
}

// ============================================================================
// Static Analysis Detection
// ============================================================================

function detectWithStaticAnalysis(
  pair: TestSourcePair,
  assertions: AssertionInfo[],
  sourceValues: SourceValueInfo[]
): DivergenceResult {
  // First try AST-based detection
  const astResult = detectWithAST(pair);
  if (astResult) {
    return astResult;
  }
  // Extract numeric values from assertions
  const expectedNumbers = assertions
    .filter(a => a.type === "equals" && a.expectedValue)
    .map(a => {
      const num = parseFloat(a.expectedValue!);
      return isNaN(num) ? null : { value: num, assertion: a };
    })
    .filter((x): x is { value: number; assertion: AssertionInfo } => x !== null);

  // Extract numeric values from source
  const sourceNumbers = sourceValues
    .map(v => {
      const num = parseFloat(v.value);
      return isNaN(num) ? null : { value: num, source: v };
    })
    .filter((x): x is { value: number; source: SourceValueInfo } => x !== null);

  // Compare values - look for mismatches
  for (const expected of expectedNumbers) {
    // Look for return values or calculations that should match but don't
    for (const actual of sourceNumbers) {
      // Skip if values are equal
      if (Math.abs(expected.value - actual.value) < FLOAT_TOLERANCE) continue;

      // Check if this is a related value (same order of magnitude, similar context)
      const ratio = expected.value / actual.value;

      // Case 1: Values are close but different (possible regression)
      if (ratio > RATIO_MIN_SIMILAR && ratio < RATIO_MAX_SIMILAR && Math.abs(expected.value - actual.value) >= 1) {
        return {
          hasDivergence: true,
          divergence: {
            type: "RETURN_VALUE_MISMATCH",
            description: `Value mismatch: test expects ${expected.value}, but source has ${actual.value}`,
            testLine: expected.assertion.lineNumber,
            codeLine: actual.source.lineNumber,
            expected: String(expected.value),
            actual: String(actual.value),
          },
          confidence: CONFIDENCE_STATIC_MISMATCH,
          details: `Test assertion: ${expected.assertion.raw}\nSource: ${actual.source.expression}`,
        };
      }

      // Case 2: Percentage/rate calculation mismatch
      // If expected is like 85-99 and actual is 0.05-0.20, might be discount
      if (expected.value >= 80 && expected.value < 100 && actual.value > 0 && actual.value < 1) {
        const impliedDiscount = 100 - expected.value; // e.g., 90 -> 10%
        const actualDiscount = Math.round(actual.value * 100); // e.g., 0.15 -> 15%

        if (impliedDiscount !== actualDiscount && Math.abs(impliedDiscount - actualDiscount) <= 20) {
          return {
            hasDivergence: true,
            divergence: {
              type: "RETURN_VALUE_MISMATCH",
              description: `Calculation mismatch: test expects result of ${expected.value} (${impliedDiscount}% adjustment), but code applies ${actualDiscount}% (${actual.value})`,
              testLine: expected.assertion.lineNumber,
              codeLine: actual.source.lineNumber,
              expected: `${expected.value} (${impliedDiscount}% rate)`,
              actual: `${100 - actualDiscount} (${actualDiscount}% rate from ${actual.value})`,
            },
            confidence: CONFIDENCE_RATE_MISMATCH,
            details: `Test assertion: ${expected.assertion.raw}\nSource constant/calculation: ${actual.source.expression}`,
          };
        }
      }
    }
  }

  // Check for exception mismatches
  const throwAssertions = assertions.filter(a => a.type === "throws");
  if (throwAssertions.length > 0) {
    // Check if source actually throws the expected exception
    const sourceThrows = sourceValues.some(v =>
      v.context.includes("throw") || v.expression.includes("throw")
    );

    if (!sourceThrows) {
      return {
        hasDivergence: true,
        divergence: {
          type: "EXCEPTION_MISMATCH",
          description: `Test expects exception ${throwAssertions[0].expectedValue} but code may not throw`,
          testLine: throwAssertions[0].lineNumber,
          codeLine: pair.source.lineNumber,
          expected: throwAssertions[0].expectedValue || "exception",
          actual: "no exception found in code",
        },
        confidence: CONFIDENCE_STATIC_EXCEPTION,
        details: `Test expects: ${throwAssertions[0].raw}`,
      };
    }
  }

  return {
    hasDivergence: false,
    divergence: null,
    confidence: CONFIDENCE_STATIC_NO_DIVERGENCE,
    details: "Static analysis found no clear divergence",
  };
}
