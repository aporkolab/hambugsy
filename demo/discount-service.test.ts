/**
 * Discount Service Tests - Demo with failing tests
 *
 * Run these tests to see hambugsy in action:
 *   npx vitest run demo/
 *
 * These tests WILL FAIL because the code has bugs!
 * Use hambugsy to diagnose:
 *   npx hambugsy analyze demo/
 */

import { describe, it, expect } from "vitest";
import {
  calculateDiscount,
  applyDiscount,
  formatPrice,
  validateOrder,
  type Customer,
  type Order,
} from "./discount-service.js";

describe("DiscountService", () => {
  describe("calculateDiscount", () => {
    const premiumCustomer: Customer = {
      id: "1",
      name: "Premium Pete",
      isPremium: true,
    };

    const regularCustomer: Customer = {
      id: "2",
      name: "Regular Rita",
      isPremium: false,
    };

    it("should apply 10% discount for premium customers", () => {
      // Premium customers should get 10% discount
      const order: Order = { items: 1, subtotal: 100 };
      const discount = calculateDiscount(premiumCustomer, order);

      // FAILS: Code returns 15 (15%) instead of 10 (10%)
      expect(discount).toBe(10);
    });

    it("should apply 5% bulk discount for orders with 10+ items", () => {
      // Bulk discount should only apply for 10+ items
      const order: Order = { items: 10, subtotal: 100 };
      const discount = calculateDiscount(regularCustomer, order);

      // PASSES: But for wrong reason - code triggers at 5 items
      expect(discount).toBe(5);
    });

    it("should NOT apply bulk discount for orders with less than 10 items", () => {
      // Orders with 5-9 items should NOT get bulk discount
      const order: Order = { items: 7, subtotal: 100 };
      const discount = calculateDiscount(regularCustomer, order);

      // FAILS: Code returns 5 because it triggers at 5 items
      expect(discount).toBe(0);
    });

    it("should stack discounts for premium customers with bulk orders", () => {
      // Premium (10%) + Bulk (5%) = 15%
      const order: Order = { items: 15, subtotal: 100 };
      const discount = calculateDiscount(premiumCustomer, order);

      // FAILS: Code returns 20 (15% premium + 5% bulk) instead of 15
      expect(discount).toBe(15);
    });

    it("should return 0 for regular customers with small orders", () => {
      const order: Order = { items: 3, subtotal: 100 };
      const discount = calculateDiscount(regularCustomer, order);

      // PASSES: No discounts apply
      expect(discount).toBe(0);
    });
  });

  describe("applyDiscount", () => {
    it("should subtract discount from subtotal", () => {
      expect(applyDiscount(100, 10)).toBe(90);
    });

    it("should handle zero discount", () => {
      expect(applyDiscount(50, 0)).toBe(50);
    });
  });

  describe("formatPrice", () => {
    it("should format with dollar sign and 2 decimals", () => {
      expect(formatPrice(99.9)).toBe("$99.90");
    });

    it("should handle round numbers", () => {
      expect(formatPrice(100)).toBe("$100.00");
    });
  });

  describe("validateOrder", () => {
    it("should throw for null order", () => {
      expect(() => validateOrder(null)).toThrow("Order cannot be null");
    });

    it("should throw for negative items", () => {
      expect(() => validateOrder({ items: -1, subtotal: 100 })).toThrow(
        "Item count cannot be negative"
      );
    });

    it("should throw for negative subtotal", () => {
      expect(() => validateOrder({ items: 1, subtotal: -50 })).toThrow(
        "Subtotal cannot be negative"
      );
    });

    it("should not throw for valid order", () => {
      expect(() => validateOrder({ items: 5, subtotal: 100 })).not.toThrow();
    });
  });
});
