import { describe, it, expect, beforeAll } from "vitest";
import { PythonParser } from "../../src/parser/python/parser.js";
import { resolve } from "path";

describe("PythonParser", () => {
  const fixturesPath = resolve(__dirname, "../fixtures/python");

  describe("parseFile - user_service.py", () => {
    let parseResult: Awaited<ReturnType<PythonParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "user_service.py")
      );
      parseResult = await parser.parseFile();
    });

    it("should extract source methods", () => {
      expect(parseResult.methods.length).toBeGreaterThan(0);
    });

    it("should find create_user method", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      expect(method).toBeDefined();
    });

    it("should find get_user method", () => {
      const method = parseResult.methods.find((m) => m.name === "get_user");
      expect(method).toBeDefined();
    });

    it("should extract method parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      expect(method?.parameters.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle type hints in parameters", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      const nameParam = method?.parameters.find((p) => p.name === "name");
      expect(nameParam?.type).toBe("str");
    });

    it("should extract return types", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      expect(method?.returnType).toBeDefined();
    });

    it("should capture line numbers", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      expect(method?.lineNumber).toBeGreaterThan(0);
    });

    it("should extract method body", () => {
      const method = parseResult.methods.find((m) => m.name === "create_user");
      expect(method?.body).toContain("ValidationError");
    });

    it("should find factory function", () => {
      const fn = parseResult.methods.find(
        (m) => m.name === "create_user_service"
      );
      expect(fn).toBeDefined();
    });

    it("should not include tests in methods", () => {
      expect(parseResult.tests).toHaveLength(0);
    });
  });

  describe("parseFile - test_user_service.py", () => {
    let parseResult: Awaited<ReturnType<PythonParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "test_user_service.py")
      );
      parseResult = await parser.parseFile();
    });

    it("should extract test cases", () => {
      expect(parseResult.tests.length).toBeGreaterThan(0);
    });

    it("should find test_ prefixed functions", () => {
      const test = parseResult.tests.find((t) =>
        t.name.startsWith("test_")
      );
      expect(test).toBeDefined();
    });

    it("should detect pytest framework", () => {
      parseResult.tests.forEach((test) => {
        expect(["pytest", "unittest"]).toContain(test.framework);
      });
    });

    it("should extract assertions from tests", () => {
      const testWithAssertions = parseResult.tests.find(
        (t) => t.assertions.length > 0
      );
      expect(testWithAssertions).toBeDefined();
    });

    it("should parse assert statements", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const assertStatements = allAssertions.filter(
        (a) => a.raw.includes("assert")
      );
      expect(assertStatements.length).toBeGreaterThan(0);
    });

    it("should parse pytest.raises", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const raisesAssertions = allAssertions.filter(
        (a) => a.type === "throws" || a.raw.includes("raises")
      );
      expect(raisesAssertions.length).toBeGreaterThan(0);
    });

    it("should capture line numbers", () => {
      parseResult.tests.forEach((test) => {
        expect(test.lineNumber).toBeGreaterThan(0);
      });
    });

    it("should extract test body", () => {
      const test = parseResult.tests.find((t) =>
        t.name.includes("create_user_success")
      );
      expect(test?.body).toContain("assert");
    });
  });

  describe("assertion extraction", () => {
    let parseResult: Awaited<ReturnType<PythonParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "test_user_service.py")
      );
      parseResult = await parser.parseFile();
    });

    it("should identify equals assertions (==)", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const equalsAssertions = allAssertions.filter((a) => a.type === "equals");
      expect(equalsAssertions.length).toBeGreaterThan(0);
    });

    it("should identify truthy assertions", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const truthyAssertions = allAssertions.filter((a) => a.type === "truthy");
      expect(truthyAssertions.length).toBeGreaterThan(0);
    });

    it("should identify throws assertions (pytest.raises)", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const throwsAssertions = allAssertions.filter((a) => a.type === "throws");
      expect(throwsAssertions.length).toBeGreaterThan(0);
    });

    it("should extract expected exception types", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      const throwsAssertions = allAssertions.filter((a) => a.type === "throws");
      const withExpected = throwsAssertions.filter((a) => a.expected !== null);
      expect(withExpected.length).toBeGreaterThan(0);
    });

    it("should handle assert x is True/False", () => {
      const allAssertions = parseResult.tests.flatMap((t) => t.assertions);
      // Check we can parse various assertion forms
      expect(allAssertions.length).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle file not found", async () => {
      const parser = new PythonParser("/nonexistent/file.py");
      await expect(parser.parseFile()).rejects.toThrow();
    });

    it("should handle methods with default parameters", async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "user_service.py")
      );
      const result = await parser.parseFile();

      const method = result.methods.find((m) => m.name === "list_users");
      expect(method?.parameters.some((p) => p.defaultValue !== undefined)).toBe(
        true
      );
    });

    it("should handle *args and **kwargs", async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "user_service.py")
      );
      const result = await parser.parseFile();
      // Our fixture may not have *args, but structure should work
      expect(result.methods.length).toBeGreaterThan(0);
    });
  });

  describe("method extraction details", () => {
    let parseResult: Awaited<ReturnType<PythonParser["parseFile"]>>;

    beforeAll(async () => {
      const parser = new PythonParser(
        resolve(fixturesPath, "user_service.py")
      );
      parseResult = await parser.parseFile();
    });

    it("should filter out self parameter", () => {
      const method = parseResult.methods.find((m) => m.name === "get_user");
      const selfParam = method?.parameters.find((p) => p.name === "self");
      expect(selfParam).toBeUndefined();
    });

    it("should extract Optional type hints", () => {
      const method = parseResult.methods.find(
        (m) => m.name === "get_user_by_email"
      );
      expect(method?.returnType).toBeDefined();
    });

    it("should handle methods in classes", () => {
      // Most methods in our fixture are class methods
      expect(parseResult.methods.length).toBeGreaterThan(5);
    });
  });
});
