package com.example.order;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Arrays;

/**
 * Unit tests for OrderService.
 *
 * NOTE: This test file is intentionally OUTDATED for demo purposes.
 * The testPremiumDiscount test expects 10% discount but the code
 * now applies 15% discount.
 */
class OrderServiceTest {

    private OrderService orderService;
    private PaymentGateway mockPaymentGateway;
    private OrderValidator mockValidator;

    @BeforeEach
    void setUp() {
        mockPaymentGateway = mock(PaymentGateway.class);
        mockValidator = mock(OrderValidator.class);
        orderService = new OrderService(mockPaymentGateway, mockValidator);
    }

    // ========================================================================
    // calculateDiscount Tests
    // ========================================================================

    @Test
    @DisplayName("Premium customers should receive 10% discount")
    void testPremiumDiscount() {
        // Arrange
        double price = 100.0;
        boolean isPremium = true;

        // Act
        double result = orderService.calculateDiscount(price, isPremium);

        // Assert - OUTDATED: Code now applies 15% discount, not 10%
        // This test will FAIL because:
        // - Test expects: 100 * 0.90 = 90.0 (10% discount)
        // - Code returns: 100 * 0.85 = 85.0 (15% discount)
        assertEquals(90.0, result, 0.01, "Premium discount should be 10%");
    }

    @Test
    @DisplayName("Standard customers should receive 5% discount")
    void testStandardDiscount() {
        // Arrange
        double price = 100.0;
        boolean isPremium = false;

        // Act
        double result = orderService.calculateDiscount(price, isPremium);

        // Assert - This test passes correctly
        assertEquals(95.0, result, 0.01, "Standard discount should be 5%");
    }

    @Test
    @DisplayName("Should throw exception for negative price")
    void testCalculateDiscount_NegativePrice() {
        // Arrange
        double price = -50.0;

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            orderService.calculateDiscount(price, true);
        });
    }

    @Test
    @DisplayName("Should throw exception for zero price")
    void testCalculateDiscount_ZeroPrice() {
        // Arrange
        double price = 0.0;

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            orderService.calculateDiscount(price, false);
        });
    }

    // ========================================================================
    // validateOrder Tests
    // ========================================================================

    // NOTE: testValidateOrder_NullInput is MISSING!
    // This is an important edge case that should be tested.
    // Hambugsy should suggest adding this test.

    @Test
    @DisplayName("Should throw exception for empty order items")
    void testValidateOrder_EmptyItems() throws ValidationException {
        // Arrange
        Order order = new Order();
        order.setCustomerId("CUST-123");
        order.setItems(Arrays.asList());

        // Act & Assert
        ValidationException exception = assertThrows(ValidationException.class, () -> {
            orderService.validateOrder(order);
        });

        assertEquals("Order must contain at least one item", exception.getMessage());
    }

    @Test
    @DisplayName("Should throw exception for missing customer ID")
    void testValidateOrder_MissingCustomerId() throws ValidationException {
        // Arrange
        Order order = new Order();
        order.setCustomerId("");
        OrderItem item = createOrderItem("PROD-1", "Test Product", 10.0, 1);
        order.setItems(Arrays.asList(item));

        // Act & Assert
        assertThrows(ValidationException.class, () -> {
            orderService.validateOrder(order);
        });
    }

    @Test
    @DisplayName("Should pass validation for valid order")
    void testValidateOrder_ValidOrder() throws ValidationException {
        // Arrange
        Order order = new Order();
        order.setCustomerId("CUST-123");
        OrderItem item = createOrderItem("PROD-1", "Test Product", 25.0, 2);
        order.setItems(Arrays.asList(item));

        // Act & Assert - should not throw
        assertDoesNotThrow(() -> {
            orderService.validateOrder(order);
        });
    }

    // ========================================================================
    // processPayment Tests
    // ========================================================================

    @Test
    @DisplayName("Should successfully process valid payment")
    void testProcessPayment_Success() throws PaymentGatewayException {
        // Arrange
        PaymentRequest request = createPaymentRequest("4111111111111111", 100.0, "USD");
        when(mockPaymentGateway.charge(anyString(), anyDouble(), anyString()))
                .thenReturn("TXN-12345");

        // Act
        PaymentResult result = orderService.processPayment(request);

        // Assert
        assertTrue(result.isSuccess());
        assertEquals("TXN-12345", result.getTransactionId());
        assertEquals(100.0, result.getAmount(), 0.01);
    }

    @Test
    @DisplayName("Should fail for invalid card number")
    void testProcessPayment_InvalidCard() {
        // Arrange
        PaymentRequest request = createPaymentRequest("invalid", 100.0, "USD");

        // Act
        PaymentResult result = orderService.processPayment(request);

        // Assert
        assertFalse(result.isSuccess());
        assertEquals("Invalid card number", result.getErrorMessage());
    }

    @Test
    @DisplayName("Should fail for zero amount")
    void testProcessPayment_ZeroAmount() {
        // Arrange
        PaymentRequest request = createPaymentRequest("4111111111111111", 0.0, "USD");

        // Act
        PaymentResult result = orderService.processPayment(request);

        // Assert
        assertFalse(result.isSuccess());
        assertEquals("Invalid payment amount", result.getErrorMessage());
    }

    @Test
    @DisplayName("Should handle gateway exception")
    void testProcessPayment_GatewayFailure() throws PaymentGatewayException {
        // Arrange
        PaymentRequest request = createPaymentRequest("4111111111111111", 100.0, "USD");
        when(mockPaymentGateway.charge(anyString(), anyDouble(), anyString()))
                .thenThrow(new PaymentGatewayException("Connection timeout"));

        // Act
        PaymentResult result = orderService.processPayment(request);

        // Assert
        assertFalse(result.isSuccess());
        assertTrue(result.getErrorMessage().contains("Connection timeout"));
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    private OrderItem createOrderItem(String productId, String name, double price, int quantity) {
        OrderItem item = new OrderItem();
        // Note: These would need setters in real code
        return item;
    }

    private PaymentRequest createPaymentRequest(String cardNumber, double amount, String currency) {
        PaymentRequest request = new PaymentRequest();
        // Note: These would need setters in real code
        return request;
    }
}
