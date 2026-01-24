import { Calculator, createCalculator } from "./calculator";

describe("Calculator", () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = createCalculator();
  });

  describe("add", () => {
    it("should add two positive numbers", () => {
      expect(calculator.add(2, 3)).toBe(5);
    });

    it("should add negative numbers", () => {
      expect(calculator.add(-1, -2)).toBe(-3);
    });

    it("should add zero", () => {
      expect(calculator.add(5, 0)).toBe(5);
    });
  });

  describe("subtract", () => {
    it("should subtract two numbers", () => {
      expect(calculator.subtract(5, 3)).toBe(2);
    });

    it("should handle negative results", () => {
      expect(calculator.subtract(3, 5)).toBe(-2);
    });
  });

  describe("multiply", () => {
    it("should multiply two numbers", () => {
      expect(calculator.multiply(4, 5)).toBe(20);
    });

    it("should return zero when multiplying by zero", () => {
      expect(calculator.multiply(5, 0)).toBe(0);
    });
  });

  describe("divide", () => {
    it("should divide two numbers", () => {
      expect(calculator.divide(10, 2)).toBe(5);
    });

    it("should throw error when dividing by zero", () => {
      expect(() => calculator.divide(10, 0)).toThrow("Division by zero");
    });

    it("should handle decimal results", () => {
      expect(calculator.divide(7, 2)).toBe(3.5);
    });
  });

  describe("applyDiscount", () => {
    // This test is OUTDATED - the code has a bug
    it("should apply 10% discount correctly", () => {
      // Expects 90 but code returns 85 (bug: adds 5% extra discount)
      expect(calculator.applyDiscount(100, 10)).toBe(90);
    });

    it("should apply 20% discount correctly", () => {
      // Expects 80 but code returns 75
      expect(calculator.applyDiscount(100, 20)).toBe(80);
    });
  });

  describe("isPositive", () => {
    it("should return true for positive numbers", () => {
      expect(calculator.isPositive(5)).toBeTruthy();
    });

    it("should return false for negative numbers", () => {
      expect(calculator.isPositive(-5)).toBeFalsy();
    });

    it("should return false for zero", () => {
      expect(calculator.isPositive(0)).toBeFalsy();
    });
  });

  describe("max", () => {
    it("should find the maximum in an array", () => {
      expect(calculator.max([1, 5, 3, 9, 2])).toBe(9);
    });

    it("should throw for empty array", () => {
      expect(() => calculator.max([])).toThrow("Cannot find max of empty array");
    });

    it("should handle single element", () => {
      expect(calculator.max([42])).toBe(42);
    });

    it("should handle negative numbers", () => {
      expect(calculator.max([-5, -2, -10])).toBe(-2);
    });
  });
});

// Additional standalone tests
test("createCalculator returns a Calculator instance", () => {
  const calc = createCalculator();
  expect(calc).toBeInstanceOf(Calculator);
});

test("calculator methods are chainable via intermediate variables", () => {
  const calc = createCalculator();
  const sum = calc.add(10, 5);
  const result = calc.multiply(sum, 2);
  expect(result).toBe(30);
});
