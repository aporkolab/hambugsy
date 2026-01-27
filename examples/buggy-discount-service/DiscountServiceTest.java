package com.example.discount;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for DiscountService.
 *
 * NOTE: This test file contains an OUTDATED test!
 * The testPremiumDiscount test expects 10% discount but the code now applies 15%.
 * Run `hambugsy analyze .` to detect this issue!
 */
class DiscountServiceTest {

    private DiscountService discountService;

    @BeforeEach
    void setUp() {
        discountService = new DiscountService();
    }

    @Test
    @DisplayName("Premium members should get 10% discount")
    void testPremiumDiscount() {
        // OUTDATED: Expects 10% discount (90.0) but code now applies 15% (85.0)
        double result = discountService.calculateDiscountedPrice(100.0, true);
        assertEquals(90.0, result, "Premium discount should be 10%");
    }

    @Test
    @DisplayName("Standard members should get 5% discount")
    void testStandardDiscount() {
        double result = discountService.calculateDiscountedPrice(100.0, false);
        assertEquals(95.0, result, "Standard discount should be 5%");
    }

    @Test
    @DisplayName("Negative price should throw exception")
    void testNegativePrice() {
        assertThrows(IllegalArgumentException.class, () -> {
            discountService.calculateDiscountedPrice(-50.0, true);
        });
    }

    @Test
    @DisplayName("Zero price should return zero")
    void testZeroPrice() {
        double result = discountService.calculateDiscountedPrice(0.0, true);
        assertEquals(0.0, result);
    }

    @Test
    @DisplayName("Premium discount amount should be 10% of price")
    void testPremiumDiscountAmount() {
        // OUTDATED: Expects 10.0 (10%) but code now returns 15.0 (15%)
        double result = discountService.calculateDiscountAmount(100.0, true);
        assertEquals(10.0, result, "Premium discount amount should be 10%");
    }

    @Test
    @DisplayName("Customer with $1000+ purchases qualifies for premium")
    void testQualifiesForPremium() {
        assertTrue(discountService.qualifiesForPremium(1000.0));
        assertTrue(discountService.qualifiesForPremium(1500.0));
    }

    @Test
    @DisplayName("Customer with less than $1000 does not qualify")
    void testDoesNotQualifyForPremium() {
        assertFalse(discountService.qualifiesForPremium(999.99));
        assertFalse(discountService.qualifiesForPremium(0.0));
    }
}
