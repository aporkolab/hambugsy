/**
 * Mutation Testing Module
 *
 * Provides mutation testing capabilities to:
 * 1. Identify code changes that tests wouldn't catch
 * 2. Detect weak test assertions
 * 3. Find potential discrepancies between expected and actual values
 *
 * This module performs "dry" mutation testing - it analyzes what would happen
 * if certain values were changed, without actually running the tests.
 */

import { readFileSync } from "fs";
import type { TestSourcePair } from "../core/types.js";

// ============================================================================
// Types
// ============================================================================

export interface Mutation {
  type: MutationType;
  location: { line: number; column: number };
  original: string;
  mutated: string;
  description: string;
}

export type MutationType =
  | "NUMERIC_CHANGE"      // 0.10 -> 0.15
  | "OPERATOR_CHANGE"     // + -> -, * -> /
  | "BOUNDARY_CHANGE"     // > -> >=, < -> <=
  | "BOOLEAN_FLIP"        // true -> false
  | "RETURN_VALUE_CHANGE" // return x -> return x + 1
  | "CONSTANT_CHANGE"     // Remove constant, change constant value
  | "NULL_CHECK_REMOVE"   // Remove null check
  | "CONDITION_FLIP";     // if (x) -> if (!x)

export interface MutationTestResult {
  mutation: Mutation;
  wouldBeCaught: boolean;
  relevantAssertions: string[];
  confidence: number;
  explanation: string;
}

export interface MutationAnalysisResult {
  totalMutations: number;
  caughtMutations: number;
  uncaughtMutations: number;
  mutationScore: number; // caught / total
  results: MutationTestResult[];
  weakSpots: WeakSpot[];
}

export interface WeakSpot {
  location: { line: number; column: number };
  code: string;
  issue: string;
  suggestion: string;
  severity: "high" | "medium" | "low";
}

// ============================================================================
// Main Mutation Analysis
// ============================================================================

export function analyzeMutations(pair: TestSourcePair): MutationAnalysisResult {
  const sourceContent = readFileSync(pair.source.filePath, "utf8");
  const testContent = pair.test.body;

  // Generate possible mutations
  const mutations = generateMutations(sourceContent, pair.source.name);

  // Analyze which mutations would be caught by tests
  const results = mutations.map(mutation =>
    analyzeMutation(mutation, testContent, sourceContent)
  );

  const caught = results.filter(r => r.wouldBeCaught).length;
  const uncaught = results.filter(r => !r.wouldBeCaught).length;

  // Identify weak spots
  const weakSpots = identifyWeakSpots(results, sourceContent);

  return {
    totalMutations: mutations.length,
    caughtMutations: caught,
    uncaughtMutations: uncaught,
    mutationScore: mutations.length > 0 ? caught / mutations.length : 1,
    results,
    weakSpots,
  };
}

// ============================================================================
// Mutation Generation
// ============================================================================

function generateMutations(sourceContent: string, methodName: string): Mutation[] {
  const mutations: Mutation[] = [];
  const lines = sourceContent.split("\n");

  // Find method body
  const methodStart = findMethodBoundary(sourceContent, methodName, "start");
  const methodEnd = findMethodBoundary(sourceContent, methodName, "end");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Only mutate within method body (if found)
    if (methodStart >= 0 && (lineNum < methodStart || lineNum > methodEnd)) {
      continue;
    }

    // Numeric literal mutations
    const numMatches = line.matchAll(/\b(\d+\.?\d*)[dDfFlL]?\b/g);
    for (const match of numMatches) {
      const original = match[1];
      const num = parseFloat(original);

      if (!isNaN(num) && num !== 0 && num !== 1) {
        // Mutate by small amount
        mutations.push({
          type: "NUMERIC_CHANGE",
          location: { line: lineNum, column: match.index! + 1 },
          original,
          mutated: String(num * 1.1), // 10% increase
          description: `Change ${original} to ${(num * 1.1).toFixed(2)}`,
        });

        mutations.push({
          type: "NUMERIC_CHANGE",
          location: { line: lineNum, column: match.index! + 1 },
          original,
          mutated: String(num * 0.9), // 10% decrease
          description: `Change ${original} to ${(num * 0.9).toFixed(2)}`,
        });
      }
    }

    // Operator mutations
    const operatorMutations: Array<[RegExp, string, string]> = [
      [/\+(?!=)/g, "+", "-"],
      [/-(?!=)/g, "-", "+"],
      [/\*(?!=)/g, "*", "/"],
      [/\/(?!=)/g, "/", "*"],
      [/>(?!=)/g, ">", ">="],
      [/<(?!=)/g, "<", "<="],
      [/>=/, ">=", ">"],
      [/<=/, "<=", "<"],
      [/==/g, "==", "!="],
      [/!=/g, "!=", "=="],
      [/&&/g, "&&", "||"],
      [/\|\|/g, "||", "&&"],
    ];

    for (const [pattern, original, mutated] of operatorMutations) {
      if (pattern.test(line)) {
        mutations.push({
          type: original.includes(">") || original.includes("<") ? "BOUNDARY_CHANGE" : "OPERATOR_CHANGE",
          location: { line: lineNum, column: line.search(pattern) + 1 },
          original,
          mutated,
          description: `Change operator ${original} to ${mutated}`,
        });
      }
    }

    // Boolean flip mutations
    if (line.includes("true") && !line.includes("assertTrue")) {
      mutations.push({
        type: "BOOLEAN_FLIP",
        location: { line: lineNum, column: line.indexOf("true") + 1 },
        original: "true",
        mutated: "false",
        description: "Flip boolean true to false",
      });
    }
    if (line.includes("false") && !line.includes("assertFalse")) {
      mutations.push({
        type: "BOOLEAN_FLIP",
        location: { line: lineNum, column: line.indexOf("false") + 1 },
        original: "false",
        mutated: "true",
        description: "Flip boolean false to true",
      });
    }

    // Return value mutations
    const returnMatch = line.match(/return\s+(.+?);/);
    if (returnMatch) {
      const returnExpr = returnMatch[1];

      // For numeric returns, try incrementing
      if (/^[\d\w\s\+\-\*\/\.\(\)]+$/.test(returnExpr)) {
        mutations.push({
          type: "RETURN_VALUE_CHANGE",
          location: { line: lineNum, column: line.indexOf("return") + 1 },
          original: `return ${returnExpr}`,
          mutated: `return ${returnExpr} + 1`,
          description: `Change return value from ${returnExpr} to ${returnExpr} + 1`,
        });
      }
    }

    // Condition flip mutations
    const ifMatch = line.match(/if\s*\(\s*([^)]+)\s*\)/);
    if (ifMatch) {
      const condition = ifMatch[1];
      if (!condition.startsWith("!")) {
        mutations.push({
          type: "CONDITION_FLIP",
          location: { line: lineNum, column: line.indexOf("if") + 1 },
          original: `if (${condition})`,
          mutated: `if (!(${condition}))`,
          description: `Negate condition: ${condition}`,
        });
      }
    }
  }

  return mutations;
}

function findMethodBoundary(content: string, methodName: string, boundary: "start" | "end"): number {
  const lines = content.split("\n");

  // Find method definition
  const methodPattern = new RegExp(
    `(?:public|private|protected)?\\s*(?:static\\s+)?(?:async\\s+)?\\w+\\s+${methodName}\\s*\\(|` +
    `function\\s+${methodName}\\s*\\(|` +
    `${methodName}\\s*=\\s*(?:async\\s+)?(?:function|\\()|` +
    `def\\s+${methodName}\\s*\\(`,
    "i"
  );

  let methodStart = -1;
  let braceCount = 0;
  let inMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (methodStart < 0 && methodPattern.test(line)) {
      methodStart = i + 1;
      inMethod = true;
    }

    if (inMethod) {
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount <= 0 && methodStart > 0) {
        return boundary === "start" ? methodStart : i + 1;
      }
    }
  }

  return boundary === "start" ? methodStart : lines.length;
}

// ============================================================================
// Mutation Analysis
// ============================================================================

function analyzeMutation(
  mutation: Mutation,
  testContent: string,
  sourceContent: string
): MutationTestResult {
  // Find relevant assertions that might catch this mutation
  const relevantAssertions = findRelevantAssertions(mutation, testContent, sourceContent);

  // Analyze if the mutation would be caught
  const analysis = wouldMutationBeCaught(mutation, relevantAssertions, testContent);

  return {
    mutation,
    wouldBeCaught: analysis.caught,
    relevantAssertions,
    confidence: analysis.confidence,
    explanation: analysis.explanation,
  };
}

function findRelevantAssertions(
  mutation: Mutation,
  testContent: string,
  _sourceContent: string
): string[] {
  const assertions: string[] = [];

  // Extract all assertions from test
  const assertionPatterns = [
    /assertEquals\s*\([^)]+\)/g,
    /assertThat\([^)]+\)[^;]+/g,
    /expect\([^)]+\)\.[^;]+/g,
    /assert\s+[^#\n]+/g,
  ];

  for (const pattern of assertionPatterns) {
    const matches = testContent.match(pattern);
    if (matches) {
      assertions.push(...matches);
    }
  }

  // Filter to relevant assertions based on mutation type
  if (mutation.type === "NUMERIC_CHANGE") {
    // Look for assertions that check numeric values
    return assertions.filter(a =>
      /\d+\.?\d*/.test(a) || a.includes("result") || a.includes("actual")
    );
  }

  if (mutation.type === "BOOLEAN_FLIP") {
    return assertions.filter(a =>
      a.includes("true") || a.includes("false") ||
      a.includes("Truthy") || a.includes("Falsy")
    );
  }

  if (mutation.type === "RETURN_VALUE_CHANGE") {
    return assertions.filter(a =>
      a.includes("result") || a.includes("return") || /\d+/.test(a)
    );
  }

  return assertions;
}

function wouldMutationBeCaught(
  mutation: Mutation,
  relevantAssertions: string[],
  _testContent: string
): { caught: boolean; confidence: number; explanation: string } {
  if (relevantAssertions.length === 0) {
    return {
      caught: false,
      confidence: 0.9,
      explanation: `No assertions found that would catch ${mutation.description}`,
    };
  }

  // Analyze based on mutation type
  switch (mutation.type) {
    case "NUMERIC_CHANGE": {
      const originalNum = parseFloat(mutation.original);
      const mutatedNum = parseFloat(mutation.mutated);

      // Check if any assertion explicitly checks for the original value
      const hasExactCheck = relevantAssertions.some(a => {
        const nums = a.match(/\d+\.?\d*/g);
        return nums?.some(n => Math.abs(parseFloat(n) - originalNum) < 0.01);
      });

      if (hasExactCheck) {
        return {
          caught: true,
          confidence: 0.95,
          explanation: `Assertion explicitly checks for value ${originalNum}, mutation to ${mutatedNum} would be caught`,
        };
      }

      // Check if assertions use approximate comparisons
      const hasApproxCheck = relevantAssertions.some(a =>
        a.includes("delta") || a.includes("tolerance") || a.includes("closeTo")
      );

      if (hasApproxCheck) {
        const diff = Math.abs(originalNum - mutatedNum) / originalNum;
        if (diff > 0.1) {
          return {
            caught: true,
            confidence: 0.7,
            explanation: `${(diff * 100).toFixed(0)}% change would likely exceed tolerance`,
          };
        }
      }

      return {
        caught: false,
        confidence: 0.6,
        explanation: `No exact value check found for ${originalNum}`,
      };
    }

    case "BOOLEAN_FLIP": {
      const hasExactBoolCheck = relevantAssertions.some(a =>
        a.includes(`(${mutation.original})`) ||
        a.includes(`${mutation.original},`) ||
        a.includes(`${mutation.original})`)
      );

      if (hasExactBoolCheck) {
        return {
          caught: true,
          confidence: 0.95,
          explanation: `Boolean assertion would catch flip from ${mutation.original} to ${mutation.mutated}`,
        };
      }

      const hasTruthyCheck = relevantAssertions.some(a =>
        a.includes("Truthy") || a.includes("Falsy") ||
        a.includes("assertTrue") || a.includes("assertFalse")
      );

      if (hasTruthyCheck) {
        return {
          caught: true,
          confidence: 0.85,
          explanation: "Truthy/falsy assertion would catch boolean flip",
        };
      }

      return {
        caught: false,
        confidence: 0.7,
        explanation: "No boolean-specific assertions found",
      };
    }

    case "OPERATOR_CHANGE":
    case "BOUNDARY_CHANGE": {
      // These are often caught by value assertions
      if (relevantAssertions.length > 0) {
        return {
          caught: true,
          confidence: 0.6,
          explanation: `Operator change from ${mutation.original} to ${mutation.mutated} likely affects result values`,
        };
      }
      return {
        caught: false,
        confidence: 0.5,
        explanation: "No value assertions to catch operator change",
      };
    }

    case "RETURN_VALUE_CHANGE": {
      if (relevantAssertions.some(a => /\d+\.?\d*/.test(a))) {
        return {
          caught: true,
          confidence: 0.85,
          explanation: "Numeric assertions would catch return value change",
        };
      }
      return {
        caught: false,
        confidence: 0.6,
        explanation: "No numeric assertions for return value",
      };
    }

    default:
      return {
        caught: relevantAssertions.length > 0,
        confidence: 0.5,
        explanation: "General mutation analysis",
      };
  }
}

// ============================================================================
// Weak Spot Identification
// ============================================================================

function identifyWeakSpots(
  results: MutationTestResult[],
  sourceContent: string
): WeakSpot[] {
  const weakSpots: WeakSpot[] = [];
  const lines = sourceContent.split("\n");

  // Group uncaught mutations by location
  const uncaughtByLine = new Map<number, MutationTestResult[]>();
  for (const result of results) {
    if (!result.wouldBeCaught) {
      const line = result.mutation.location.line;
      const existing = uncaughtByLine.get(line) || [];
      existing.push(result);
      uncaughtByLine.set(line, existing);
    }
  }

  // Create weak spots from grouped uncaught mutations
  for (const [lineNum, uncaught] of uncaughtByLine) {
    const code = lines[lineNum - 1] || "";

    // Determine severity based on number and type of uncaught mutations
    const hasNumericMutation = uncaught.some(u => u.mutation.type === "NUMERIC_CHANGE");
    const hasReturnMutation = uncaught.some(u => u.mutation.type === "RETURN_VALUE_CHANGE");
    const severity: WeakSpot["severity"] =
      (hasNumericMutation && hasReturnMutation) ? "high" :
      (hasNumericMutation || hasReturnMutation) ? "medium" : "low";

    const mutationTypes = [...new Set(uncaught.map(u => u.mutation.type))];

    weakSpots.push({
      location: { line: lineNum, column: 1 },
      code: code.trim(),
      issue: `${uncaught.length} mutation(s) would not be caught: ${mutationTypes.join(", ")}`,
      suggestion: generateSuggestion(uncaught),
      severity,
    });
  }

  return weakSpots.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

function generateSuggestion(uncaught: MutationTestResult[]): string {
  const types = new Set(uncaught.map(u => u.mutation.type));

  if (types.has("NUMERIC_CHANGE")) {
    return "Add assertions that check for specific numeric values";
  }
  if (types.has("RETURN_VALUE_CHANGE")) {
    return "Add assertions to verify return values";
  }
  if (types.has("BOOLEAN_FLIP")) {
    return "Add explicit boolean assertions (assertTrue/assertFalse)";
  }
  if (types.has("BOUNDARY_CHANGE")) {
    return "Add boundary value tests (e.g., test with 0, -1, max values)";
  }
  if (types.has("CONDITION_FLIP")) {
    return "Add tests for both true and false conditions";
  }

  return "Add more specific assertions for this code";
}

// ============================================================================
// Integration with Divergence Detection
// ============================================================================

/**
 * Detect value mismatches by analyzing which mutations would make tests pass.
 * This is different from traditional mutation testing - we look for mutations
 * that WOULD align code behavior with test expectations.
 */
export function detectValueMismatchFromMutations(
  pair: TestSourcePair
): { description: string; expected: string; actual: string; codeLine: number; confidence: number } | null {
  try {
    const sourceContent = readFileSync(pair.source.filePath, "utf8");
    const testContent = pair.test.body;

    // Extract expected values from test assertions
    const expectedValues = extractExpectedValues(testContent);
    if (expectedValues.length === 0) return null;

    // Extract numeric values from source code
    const sourceValues = extractSourceNumericValues(sourceContent, pair.source.name);
    if (sourceValues.length === 0) return null;

    // Look for mismatches: test expects X but source has Y where X != Y but they're related
    for (const expected of expectedValues) {
      for (const actual of sourceValues) {
        // Skip if values are equal
        if (Math.abs(expected.value - actual.value) < 0.001) continue;

        // Check for percentage-related mismatches
        // e.g., test expects 10 (10% of 100), source has 15 (15%)
        if (expected.value >= 1 && expected.value <= 100 &&
            actual.value >= 1 && actual.value <= 100) {
          const diff = Math.abs(expected.value - actual.value);
          // If difference is small (< 20) it might be a rate/percentage mismatch
          if (diff >= 1 && diff <= 20) {
            return {
              description: `Value mismatch: test expects ${expected.value} but code uses ${actual.value}. Changing ${actual.value} to ${expected.value} would fix this test.`,
              expected: String(expected.value),
              actual: String(actual.value),
              codeLine: actual.line,
              confidence: 0.85,
            };
          }
        }

        // Check for multiplicative relationships
        // e.g., test expects 90 (100 - 10%), source has 0.15 (15%)
        if (expected.value >= 50 && expected.value <= 100 && actual.value > 0 && actual.value < 1) {
          const impliedPercentage = 100 - expected.value; // e.g., 90 → 10%
          const sourcePercentage = actual.value * 100;     // e.g., 0.15 → 15%

          if (Math.abs(impliedPercentage - sourcePercentage) >= 1 &&
              Math.abs(impliedPercentage - sourcePercentage) <= 20) {
            return {
              description: `Rate mismatch: test implies ${impliedPercentage}% but code uses ${sourcePercentage.toFixed(0)}%.`,
              expected: `${impliedPercentage}%`,
              actual: `${sourcePercentage.toFixed(0)}%`,
              codeLine: actual.line,
              confidence: 0.80,
            };
          }
        }

        // Check for threshold mismatches
        // e.g., test uses 10 items as boundary, source uses 5
        if (expected.value >= 1 && expected.value <= 100 &&
            actual.value >= 1 && actual.value <= 100) {
          const ratio = expected.value / actual.value;
          if (ratio >= 0.5 && ratio <= 2 && Math.abs(expected.value - actual.value) >= 2) {
            // Check context to see if it's likely a threshold
            if (actual.context.includes('>=') || actual.context.includes('<=') ||
                actual.context.includes('>') || actual.context.includes('<')) {
              return {
                description: `Threshold mismatch: test expects threshold of ${expected.value} but code uses ${actual.value}.`,
                expected: String(expected.value),
                actual: String(actual.value),
                codeLine: actual.line,
                confidence: 0.75,
              };
            }
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

function extractExpectedValues(testContent: string): Array<{ value: number; line: number }> {
  const results: Array<{ value: number; line: number }> = [];
  const lines = testContent.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match various assertion patterns
    const patterns = [
      /expect\([^)]+\)\.toBe\(\s*(-?\d+\.?\d*)\s*\)/g,
      /expect\([^)]+\)\.toEqual\(\s*(-?\d+\.?\d*)\s*\)/g,
      /assertEquals\s*\(\s*(-?\d+\.?\d*)\s*,/g,
      /assert\s+[^=]+=+\s*(-?\d+\.?\d*)/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          results.push({ value, line: i + 1 });
        }
      }
    }
  }

  return results;
}

function extractSourceNumericValues(
  sourceContent: string,
  methodName: string
): Array<{ value: number; line: number; context: string }> {
  const results: Array<{ value: number; line: number; context: string }> = [];
  const lines = sourceContent.split("\n");

  // Find method boundaries
  const methodStart = findMethodBoundary(sourceContent, methodName, "start");
  const methodEnd = findMethodBoundary(sourceContent, methodName, "end");

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;

    // Only look within method body if found, or whole file
    if (methodStart >= 0 && (lineNum < methodStart || lineNum > methodEnd)) {
      continue;
    }

    const line = lines[i];

    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;

    // Find numeric literals (excluding array indices and common false positives)
    const numMatches = line.matchAll(/(?<![.\w])(\d+\.?\d*)(?![.\w\[])/g);
    for (const match of numMatches) {
      const value = parseFloat(match[1]);
      // Filter out 0, 1, 2 (too common) and very large numbers
      if (!isNaN(value) && value >= 3 && value <= 1000) {
        results.push({
          value,
          line: lineNum,
          context: line.trim(),
        });
      }
    }
  }

  return results;
}
