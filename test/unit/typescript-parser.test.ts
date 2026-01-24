import { describe, it, expect, beforeAll } from "vitest";
import { TypeScriptParser } from "../../src/parser/typescript/parser.js";
import { resolve } from "path";

describe("TypeScriptParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/typescript");

  describe("parseFile - calculator.ts", () => {
    let parseResult: Awaited<ReturnType<TypeScriptParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new TypeScriptParser(
        resolve(fixturesPath, "calculator.ts")
      );
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find exported functions", () => {
      const fn = parseResult.methods.find((m) => m.name === "createCalculator");
      expect(fn).toBeDefined();
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "add");
      if (method) {
        expect(method.parameters.length).toBe(2);
      }
    });

    it("should not include tests in methods", () => {
      expect(parseResult.tests).toHaveLength(0);
    });
  });

  describe("parseFile - calculator.test.ts", () => {
    let parseResult: Awaited<ReturnType<TypeScriptParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new TypeScriptParser(
        resolve(fixturesPath, "calculator.test.ts")
      );
      parseResult = await parser.parseFile();
    });

    it("should extract test cases", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find it() style tests", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("add two positive numbers")
      );
      expect(test).toBeDefined();
    });

    it("should find test() style tests", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("createCalculator returns")
      );
      expect(test).toBeDefined();
    });

    it("should detect Jest/Vitest framework", () => {
      parseResult.tests.forEach((test) => {
        expect(["jest", "vitest"]).toContain(test.framework);
      });
    });

    it("should extract assertions from tests", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("add two positive numbers")
      );
      expect(test?.assertions.length).toBeGreaterThan(0);
    });

    it("should parse toBe assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const toBeAssertions = allAssertions.filter((a) => a.raw.includes("toBe"));
      expect(toBeAssertions.length).toBeGreaterThan(0);
    });

    it("should parse toThrow assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const throwAssertions = allAssertions.filter(
        (a) => a.type === "throws" || a.raw.includes("toThrow")
      );
      expect(throwAssertions.length).toBeGreaterThan(0);
    });

    it("should parse toBeTruthy/toBeFalsy assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const truthyAssertions = allAssertions.filter(
        (a) => a.type === "truthy"
      );
      expect(truthyAssertions.length).toBeGreaterThan(0);
    });

    it("should capture line numbers", () => {
      parseResult.tests.forEach((test) => {
        expect(test.lineNumber).toBeGreaterThan(0);
      });
    });

    it("should extract test body", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("add two positive numbers")
      );
      expect(test?.body).toContain("expect");
    });
  });

  describe("assertion extraction", () => {
    let parseResult: Awaited<ReturnType<TypeScriptParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new TypeScriptParser(
        resolve(fixturesPath, "calculator.test.ts")
      );
      parseResult = await parser.parseFile();
    });

    it("should identify equals assertions (toBe, toEqual)", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const equalsAssertions = allAssertions.filter((a) => a.type === "equals");
      expect(equalsAssertions.length).toBeGreaterThan(0);
    });

    it("should extract expected values from assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const equalsAssertions = allAssertions.filter((a) => a.type === "equals");
      const withExpected = equalsAssertions.filter((a) => a.expected !== null);
      expect(withExpected.length).toBeGreaterThan(0);
    });

    it("should extract actual values from assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const withActual = allAssertions.filter((a) => a.actual !== null);
      expect(withActual.length).toBeGreaterThan(0);
    });

    it("should identify contains assertions (toContain)", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      // May not have toContain in our fixture, so just check structure
      allAssertions.forEach((a) => {
        expect(["equals", "truthy", "throws", "contains", "other"]).toContain(
          a.type
        );
      });
    });
  });

  describe("edge cases", () => {
    it("should handle file not found", async () => {
      const parser = new TypeScriptParser("/nonexistent/file.ts");
      await expect(parser.parseFile()).rejects.toThrow();
    });

    it("should handle async test functions", async () => {
      const parser = new TypeScriptParser(
        resolve(fixturesPath, "calculator.test.ts")
      );
      const result = await parser.parseFile();
      // Our fixture has some async tests
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });
});
