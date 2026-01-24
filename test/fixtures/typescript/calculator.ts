/**
 * Simple calculator service for testing
 */
export class Calculator {
  /**
   * Add two numbers
   */
  add(a: number, b: number): number {
    return a + b;
  }

  /**
   * Subtract b from a
   */
  subtract(a: number, b: number): number {
    return a - b;
  }

  /**
   * Multiply two numbers
   */
  multiply(a: number, b: number): number {
    return a * b;
  }

  /**
   * Divide a by b
   * @throws Error if b is zero
   */
  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    return a / b;
  }

  /**
   * Calculate percentage discount
   * BUG: Should be price * (1 - discount/100) but uses wrong formula
   */
  applyDiscount(price: number, discountPercent: number): number {
    // Intentional bug: discount is applied incorrectly (15% instead of 10%)
    return price * (1 - (discountPercent + 5) / 100);
  }

  /**
   * Check if number is positive
   */
  isPositive(n: number): boolean {
    return n > 0;
  }

  /**
   * Get the maximum of an array
   */
  max(numbers: number[]): number {
    if (numbers.length === 0) {
      throw new Error("Cannot find max of empty array");
    }
    return Math.max(...numbers);
  }
}

export function createCalculator(): Calculator {
  return new Calculator();
}
