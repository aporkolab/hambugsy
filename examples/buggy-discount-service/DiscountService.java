package com.example.discount;

/**
 * Service for calculating discounts on orders.
 *
 * INTENTIONAL BUG: The premium discount was changed from 10% to 15%
 * but the test was not updated - Hambugsy should detect this!
 */
public class DiscountService {

    // BUG: This was 0.10 (10%) but was changed to 0.15 (15%)
    // The test still expects 10% discount!
    private static final double PREMIUM_DISCOUNT = 0.15;
    private static final double STANDARD_DISCOUNT = 0.05;

    /**
     * Calculate the discounted price for an order.
     *
     * @param originalPrice The original price before discount
     * @param isPremiumMember Whether the customer is a premium member
     * @return The price after applying the appropriate discount
     */
    public double calculateDiscountedPrice(double originalPrice, boolean isPremiumMember) {
        if (originalPrice < 0) {
            throw new IllegalArgumentException("Price cannot be negative");
        }

        double discount = isPremiumMember ? PREMIUM_DISCOUNT : STANDARD_DISCOUNT;
        return originalPrice * (1 - discount);
    }

    /**
     * Calculate the discount amount for an order.
     *
     * @param originalPrice The original price before discount
     * @param isPremiumMember Whether the customer is a premium member
     * @return The discount amount
     */
    public double calculateDiscountAmount(double originalPrice, boolean isPremiumMember) {
        double discount = isPremiumMember ? PREMIUM_DISCOUNT : STANDARD_DISCOUNT;
        return originalPrice * discount;
    }

    /**
     * Check if a customer qualifies for premium status.
     *
     * @param totalPurchases Total lifetime purchases
     * @return true if customer qualifies for premium
     */
    public boolean qualifiesForPremium(double totalPurchases) {
        return totalPurchases >= 1000.0;
    }
}
