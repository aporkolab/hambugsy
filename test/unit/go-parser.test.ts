import { describe, it, expect, beforeAll } from "vitest";
import { GoParser } from "../../src/parser/go/parser.js";
import { resolve } from "path";

describe("GoParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/go");

  describe("parseFile - calculator.go", () => {
    let parseResult: Awaited<ReturnType<GoParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new GoParser(resolve(fixturesPath, "calculator.go"));
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find Add method", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method).toBeDefined();
    });

    it("should find Divide method with return type", () => {
      const method = parseResult.methods.find((m) => m.name === "Divide");
      expect(method).toBeDefined();
    });

    it("should find ApplyDiscount function", () => {
      const method = parseResult.methods.find((m) => m.name === "ApplyDiscount");
      expect(method).toBeDefined();
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.parameters.length).toBeGreaterThan(0);
    });

    it("should capture line numbers", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.lineNumber).toBeGreaterThan(0);
      expect(method?.endLine).toBeGreaterThan(method!.lineNumber);
    });

    it("should extract method body", () => {
      const method = parseResult.methods.find((m) => m.name === "Add");
      expect(method?.body).toContain("return");
    });
  });

  describe("parseFile - calculator_test.go", () => {
    let parseResult: Awaited<ReturnType<GoParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new GoParser(resolve(fixturesPath, "calculator_test.go"));
      parseResult = await parser.parseFile();
    });

    it("should extract test cases", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find TestAdd test", () => {
      const test = parseResult.tests.find((t) => t.name === "TestAdd");
      expect(test).toBeDefined();
      expect(test?.framework).toBe("go-test");
    });

    it("should find BenchmarkAdd benchmark", () => {
      const test = parseResult.tests.find((t) => t.name === "BenchmarkAdd");
      expect(test).toBeDefined();
      expect(test?.framework).toBe("go-benchmark");
    });

    it("should extract assertions from tests", () => {
      const test = parseResult.tests.find((t) => t.name === "TestAdd");
      expect(test?.assertions.length).toBeGreaterThan(0);
    });

    it("should parse assert.Equal assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "TestAdd");
      const assertion = test?.assertions.find((a) => a.type === "equals");
      expect(assertion).toBeDefined();
    });

    it("should parse require.NoError assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "TestDivide");
      expect(test?.assertions.length).toBeGreaterThan(0);
    });

    it("should parse assert.Error assertions", () => {
      const test = parseResult.tests.find((t) => t.name === "TestDivideByZero");
      const assertion = test?.assertions.find((a) => a.type === "throws");
      expect(assertion).toBeDefined();
    });

    it("should detect go-test framework", () => {
      const regularTests = parseResult.tests.filter(
        (t) => t.name.startsWith("Test") && !t.name.startsWith("Benchmark")
      );
      regularTests.forEach((test) => {
        expect(test.framework).toBe("go-test");
      });
    });

    it("should detect go-benchmark framework", () => {
      const benchmarks = parseResult.tests.filter((t) =>
        t.name.startsWith("Benchmark")
      );
      benchmarks.forEach((test) => {
        expect(test.framework).toBe("go-benchmark");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle file not found gracefully", async () => {
      const parser = new GoParser("/nonexistent/file.go");
      await expect(parser.parseFile()).rejects.toThrow();
    });
  });
});
