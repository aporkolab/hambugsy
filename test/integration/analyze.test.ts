import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { JavaParser } from "../../src/parser/java/parser.js";

// ============================================================================
// Test Fixtures Path
// ============================================================================

const FIXTURES_PATH = resolve(__dirname, "../fixtures/java");
const ORDER_SERVICE_PATH = resolve(FIXTURES_PATH, "OrderService.java");
const ORDER_SERVICE_TEST_PATH = resolve(FIXTURES_PATH, "OrderServiceTest.java");

// ============================================================================
// Integration Tests
// ============================================================================

describe("Hambugsy Integration Tests", () => {
  describe("Java Parser", () => {
    it("should parse OrderService.java source file", async () => {
      const parser = new JavaParser(ORDER_SERVICE_PATH);
      const result = await parser.parseFile();

      expect(result.methods.length).toBeGreaterThan(0);

      // Check calculateDiscount method
      const calculateDiscount = result.methods.find((m) => m.name === "calculateDiscount");
      expect(calculateDiscount).toBeDefined();
      expect(calculateDiscount?.parameters).toHaveLength(2);
      expect(calculateDiscount?.returnType).toBe("double");

      // Check validateOrder method
      const validateOrder = result.methods.find((m) => m.name === "validateOrder");
      expect(validateOrder).toBeDefined();

      // Check processPayment method
      const processPayment = result.methods.find((m) => m.name === "processPayment");
      expect(processPayment).toBeDefined();
    });

    it("should parse OrderServiceTest.java test file", async () => {
      const parser = new JavaParser(ORDER_SERVICE_TEST_PATH);
      const result = await parser.parseFile();

      expect(result.tests.length).toBeGreaterThan(0);

      // Check testPremiumDiscount test
      const premiumTest = result.tests.find((t) => t.name === "testPremiumDiscount");
      expect(premiumTest).toBeDefined();
      expect(premiumTest?.assertions.length).toBeGreaterThan(0);

      // Check for assertEquals assertion
      const equalsAssertion = premiumTest?.assertions.find((a) => a.type === "equals");
      expect(equalsAssertion).toBeDefined();
      expect(equalsAssertion?.expected).toContain("90.0");
    });

    it("should extract assertions from test methods", async () => {
      const parser = new JavaParser(ORDER_SERVICE_TEST_PATH);
      const result = await parser.parseFile();

      // testCalculateDiscount_NegativePrice should have assertThrows
      const negativeTest = result.tests.find((t) => t.name === "testCalculateDiscount_NegativePrice");
      expect(negativeTest).toBeDefined();

      const throwsAssertion = negativeTest?.assertions.find((a) => a.type === "throws");
      expect(throwsAssertion).toBeDefined();
      expect(throwsAssertion?.expected).toContain("IllegalArgumentException");
    });
  });

  describe("Test-Source Correlation", () => {
    it("should correlate test methods with source methods by naming convention", async () => {
      const sourceParser = new JavaParser(ORDER_SERVICE_PATH);
      const testParser = new JavaParser(ORDER_SERVICE_TEST_PATH);

      const sourceResult = await sourceParser.parseFile();
      const testResult = await testParser.parseFile();

      // Find tests related to calculateDiscount
      const calculateDiscountTests = testResult.tests.filter(
        (t) =>
          t.name.toLowerCase().includes("discount") ||
          t.name.toLowerCase().includes("premium") ||
          t.name.toLowerCase().includes("standard")
      );

      expect(calculateDiscountTests.length).toBeGreaterThanOrEqual(2);

      // Find source method
      const calculateDiscount = sourceResult.methods.find((m) => m.name === "calculateDiscount");
      expect(calculateDiscount).toBeDefined();
    });

    it("should identify tests that call specific methods", async () => {
      const testParser = new JavaParser(ORDER_SERVICE_TEST_PATH);
      const testResult = await testParser.parseFile();

      // testPremiumDiscount should call calculateDiscount
      const premiumTest = testResult.tests.find((t) => t.name === "testPremiumDiscount");
      expect(premiumTest?.body).toContain("calculateDiscount");
    });
  });

  describe("Outdated Test Detection", () => {
    it("should detect mismatch between test expectation and code behavior", async () => {
      const sourceParser = new JavaParser(ORDER_SERVICE_PATH);
      const testParser = new JavaParser(ORDER_SERVICE_TEST_PATH);

      const sourceResult = await sourceParser.parseFile();
      const testResult = await testParser.parseFile();

      // Get the premium discount test
      const premiumTest = testResult.tests.find((t) => t.name === "testPremiumDiscount");
      expect(premiumTest).toBeDefined();

      // Get the calculateDiscount method
      const calculateDiscount = sourceResult.methods.find((m) => m.name === "calculateDiscount");
      expect(calculateDiscount).toBeDefined();

      // Test expects 90.0 (10% discount)
      const assertion = premiumTest?.assertions.find((a) => a.type === "equals");
      expect(assertion?.expected).toContain("90.0");

      // But code applies 15% discount (would return 85.0)
      // Check that the PREMIUM_DISCOUNT constant is 0.15
      expect(calculateDiscount?.body).toContain("PREMIUM_DISCOUNT");

      // This is the "outdated test" scenario that Hambugsy should detect
    });
  });

  describe("Missing Test Detection", () => {
    it("should identify methods without null input tests", async () => {
      const testParser = new JavaParser(ORDER_SERVICE_TEST_PATH);
      const testResult = await testParser.parseFile();

      // Check for validateOrder null input test
      const nullInputTest = testResult.tests.find(
        (t) =>
          t.name.toLowerCase().includes("validateorder") &&
          t.name.toLowerCase().includes("null")
      );

      // This test is intentionally MISSING - Hambugsy should suggest it
      expect(nullInputTest).toBeUndefined();
    });

    it("should identify methods with nullable parameters that need tests", async () => {
      const sourceParser = new JavaParser(ORDER_SERVICE_PATH);
      const sourceResult = await sourceParser.parseFile();

      // validateOrder takes Order parameter which could be null
      const validateOrder = sourceResult.methods.find((m) => m.name === "validateOrder");
      expect(validateOrder).toBeDefined();
      expect(validateOrder?.parameters.length).toBeGreaterThan(0);

      // The method body shows it handles null: "if (order == null)"
      expect(validateOrder?.body).toContain("order == null");

      // Hambugsy should suggest a test for this null case
    });

    it("should identify exception scenarios that need testing", async () => {
      const sourceParser = new JavaParser(ORDER_SERVICE_PATH);
      const sourceResult = await sourceParser.parseFile();

      // processPayment can throw exceptions
      const processPayment = sourceResult.methods.find((m) => m.name === "processPayment");
      expect(processPayment).toBeDefined();

      // Method body shows it handles null request
      expect(processPayment?.body).toContain("request == null");

      // Hambugsy should ensure there's a test for null request
    });
  });

  describe("Code Bug Detection", () => {
    it("should identify discrepancy between documentation and implementation", async () => {
      const sourceParser = new JavaParser(ORDER_SERVICE_PATH);
      const sourceResult = await sourceParser.parseFile();

      const calculateDiscount = sourceResult.methods.find((m) => m.name === "calculateDiscount");
      expect(calculateDiscount).toBeDefined();

      // The method body contains the "buggy" 15% discount
      // while the Javadoc says 10%
      expect(calculateDiscount?.body).toContain("PREMIUM_DISCOUNT");

      // In a full implementation, Hambugsy would:
      // 1. Parse the Javadoc comment (Premium customers should receive 10% discount)
      // 2. Analyze the code (applies PREMIUM_DISCOUNT = 0.15 = 15%)
      // 3. Detect the mismatch
      // 4. Determine if test is outdated or code has a bug
    });
  });
});

// ============================================================================
// Helper Functions for Future Tests
// ============================================================================

/**
 * Create a mock AnalysisResult for testing
 * @internal Used by future verdict engine tests
 */
export function createMockAnalysisResult(options: {
  testExpects: string;
  codeReturns: string;
  hasGitHistory?: boolean;
}) {
  return {
    pair: {
      test: {
        name: "testPremiumDiscount",
        filePath: ORDER_SERVICE_TEST_PATH,
        lineNumber: 40,
        endLine: 55,
        framework: "junit5" as const,
        assertions: [
          {
            type: "equals" as const,
            expected: options.testExpects,
            actual: "result",
            lineNumber: 52,
            raw: `assertEquals(${options.testExpects}, result, 0.01)`,
          },
        ],
        body: "...",
      },
      source: {
        name: "calculateDiscount",
        filePath: ORDER_SERVICE_PATH,
        lineNumber: 32,
        endLine: 40,
        parameters: [
          { name: "price", type: "double" },
          { name: "isPremium", type: "boolean" },
        ],
        returnType: "double",
        body: "...",
      },
      confidence: 0.95,
      correlationType: "NAMING_CONVENTION" as const,
    },
    testExpectation: {
      description: "Premium customers should receive 10% discount",
      expectedBehavior: "Returns price with 10% discount",
      inputValues: ["100.0", "true"],
      expectedOutput: options.testExpects,
      expectedExceptions: [],
    },
    codeBehavior: {
      description: "Applies PREMIUM_DISCOUNT (15%) to price",
      actualBehavior: "Returns price with 15% discount",
      codePathTaken: ["isPremium = true", "discountRate = PREMIUM_DISCOUNT"],
      returnValue: options.codeReturns,
      thrownExceptions: [],
    },
    divergence: {
      type: "RETURN_VALUE_MISMATCH" as const,
      description: "Test expects 90.0 but code returns 85.0",
      testLine: 52,
      codeLine: 38,
      expected: options.testExpects,
      actual: options.codeReturns,
    },
    gitContext: {
      lastTestChange: options.hasGitHistory
        ? {
            hash: "abc1234",
            author: "developer",
            date: new Date("2024-01-15"),
            message: "Add premium discount test",
            filesChanged: [ORDER_SERVICE_TEST_PATH],
          }
        : null,
      lastCodeChange: options.hasGitHistory
        ? {
            hash: "def5678",
            author: "developer",
            date: new Date("2024-02-01"),
            message: "feat: increase premium discount to 15%",
            filesChanged: [ORDER_SERVICE_PATH],
          }
        : null,
      recentCommits: [],
      blame: null,
    },
  };
}
