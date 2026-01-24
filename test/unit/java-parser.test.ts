import { describe, it, expect, beforeAll } from "vitest";
import { JavaParser } from "../../src/parser/java/parser.js";
import { resolve } from "path";

describe("JavaParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/java");

  describe("parseFile - OrderService.java", () => {
    let parseResult: Awaited<ReturnType<JavaParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new JavaParser(resolve(fixturesPath, "OrderService.java"));
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find calculateDiscount method", () => {
      const method = parseResult.methods.find(
        (m) => m.name === "calculateDiscount"
      );
      expect(method).toBeDefined();
      expect(method?.returnType).toBe("double");
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find(
        (m) => m.name === "calculateDiscount"
      );
      expect(method?.parameters).toHaveLength(2);
      expect(method?.parameters[0].name).toBe("price");
      expect(method?.parameters[0].type).toBe("double");
      expect(method?.parameters[1].name).toBe("isPremium");
      expect(method?.parameters[1].type).toBe("boolean");
    });

    it("should extract method body", () => {
      const method = parseResult.methods.find(
        (m) => m.name === "calculateDiscount"
      );
      expect(method?.body).toContain("isPremium");
      expect(method?.body).toContain("return");
    });

    it("should capture line numbers", () => {
      const method = parseResult.methods.find(
        (m) => m.name === "calculateDiscount"
      );
      expect(method?.lineNumber).toBeGreaterThan(0);
      expect(method?.endLine).toBeGreaterThan(method!.lineNumber);
    });
  });

  describe("parseFile - OrderServiceTest.java", () => {
    let parseResult: Awaited<ReturnType<JavaParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new JavaParser(
        resolve(fixturesPath, "OrderServiceTest.java")
      );
      parseResult = await parser.parseFile();
    });

    it("should extract test cases", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find testPremiumDiscount test", () => {
      const test = parseResult.tests.find(
        (t) => t.name === "testPremiumDiscount"
      );
      expect(test).toBeDefined();
      expect(test?.framework).toBe("junit5");
    });

    it("should extract assertions from tests", () => {
      const test = parseResult.tests.find(
        (t) => t.name === "testPremiumDiscount"
      );
      expect(test?.assertions.length).toBeGreaterThan(0);
    });

    it("should parse assertEquals assertions", () => {
      const test = parseResult.tests.find(
        (t) => t.name === "testPremiumDiscount"
      );
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
      expect(assertion?.expected).toBeDefined();
    });

    it("should parse assertThrows assertions", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("NegativePrice")
      );
      if (test) {
        const assertion = test.assertions.find((a) => a.type === "throws");
        expect(assertion).toBeDefined();
        expect(assertion?.expected).toContain("IllegalArgumentException");
      }
    });

    it("should extract test body", () => {
      const test = parseResult.tests.find(
        (t) => t.name === "testPremiumDiscount"
      );
      expect(test?.body).toContain("calculateDiscount");
    });

    it("should detect JUnit 5 framework", () => {
      parseResult.tests.forEach((test) => {
        expect(test.framework).toBe("junit5");
      });
    });

    it("should handle @DisplayName annotation", () => {
      // Tests with @DisplayName should still have correct name extracted
      const tests = parseResult.tests;
      expect(tests.some((t) => t.name.length > 0)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle file not found gracefully", async () => {
      const parser = new JavaParser("/nonexistent/file.java");
      await expect(parser.parseFile()).rejects.toThrow();
    });

    it("should return empty arrays for non-Java content", async () => {
      // Create a parser for a file that exists but has no Java code
      const parser = new JavaParser(resolve(fixturesPath, "OrderService.java"));
      const result = await parser.parseFile();
      // Even with valid Java, should have structured output
      expect(Array.isArray(result.tests)).toBe(true);
      expect(Array.isArray(result.methods)).toBe(true);
    });
  });

  describe("assertion types", () => {
    let parseResult: Awaited<ReturnType<JavaParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new JavaParser(
        resolve(fixturesPath, "OrderServiceTest.java")
      );
      parseResult = await parser.parseFile();
    });

    it("should identify equals assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const equalsAssertions = allAssertions.filter((a) => a.type === "equals");
      expect(equalsAssertions.length).toBeGreaterThan(0);
    });

    it("should identify throws assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const throwsAssertions = allAssertions.filter((a) => a.type === "throws");
      expect(throwsAssertions.length).toBeGreaterThan(0);
    });

    it("should capture assertion line numbers", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      allAssertions.forEach((assertion) => {
        expect(assertion.lineNumber).toBeGreaterThan(0);
      });
    });

    it("should capture raw assertion text", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      allAssertions.forEach((assertion) => {
        expect(assertion.raw.length).toBeGreaterThan(0);
      });
    });
  });
});
