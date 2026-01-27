/**
 * Discount Service - Demo with intentional bugs
 *
 * This service has BUGS that hambugsy should detect:
 * 1. Premium discount is 15% instead of documented 10%
 * 2. Bulk discount threshold is wrong (should be 10, not 5)
 */

export interface Customer {
  id: string;
  name: string;
  isPremium: boolean;
}

export interface Order {
  items: number;
  subtotal: number;
}

/**
 * Calculate discount for a customer's order
 *
 * Rules (as documented):
 * - Premium customers get 10% discount
 * - Orders with 10+ items get 5% bulk discount
 * - Discounts stack (premium + bulk = 15% max)
 */
export function calculateDiscount(customer: Customer, order: Order): number {
  let discountPercent = 0;

  // BUG: Premium discount is 15% instead of 10%
  if (customer.isPremium) {
    discountPercent += 15; // Should be 10
  }

  // BUG: Bulk discount triggers at 5 items instead of 10
  if (order.items >= 5) {
    // Should be >= 10
    discountPercent += 5;
  }

  return order.subtotal * (discountPercent / 100);
}

/**
 * Apply discount to order total
 */
export function applyDiscount(subtotal: number, discountAmount: number): number {
  return subtotal - discountAmount;
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Validate order - throws if invalid
 */
export function validateOrder(order: Order | null): void {
  if (!order) {
    throw new Error("Order cannot be null");
  }
  if (order.items < 0) {
    throw new Error("Item count cannot be negative");
  }
  if (order.subtotal < 0) {
    throw new Error("Subtotal cannot be negative");
  }
}
