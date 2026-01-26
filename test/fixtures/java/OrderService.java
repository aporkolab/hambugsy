package com.example.order;

import java.util.List;

/**
 * Order processing service - handles discounts, validation, and payments.
 *
 * NOTE: This file contains an intentional "bug" for demo purposes.
 * The calculateDiscount method applies 15% discount instead of the
 * documented 10% premium discount.
 */
public class OrderService {

    private static final double STANDARD_DISCOUNT = 0.05;  // 5%
    private static final double PREMIUM_DISCOUNT = 0.15;   // BUG: Should be 0.10 (10%)

    private final PaymentGateway paymentGateway;
    private final OrderValidator validator;

    public OrderService(PaymentGateway paymentGateway, OrderValidator validator) {
        this.paymentGateway = paymentGateway;
        this.validator = validator;
    }

    /**
     * Calculate discount based on customer type.
     *
     * @param price Base price of the order
     * @param isPremium Whether the customer has premium membership
     * @return Final price after discount
     *
     * Premium customers should receive 10% discount.
     * Standard customers receive 5% discount.
     */
    public double calculateDiscount(double price, boolean isPremium) {
        if (price <= 0) {
            throw new IllegalArgumentException("Price must be positive");
        }

        double discountRate = isPremium ? PREMIUM_DISCOUNT : STANDARD_DISCOUNT;
        return price * (1 - discountRate);
    }

    /**
     * Validate an order before processing.
     *
     * @param order The order to validate
     * @throws ValidationException if the order is invalid
     */
    public void validateOrder(Order order) throws ValidationException {
        if (order == null) {
            throw new ValidationException("Order cannot be null");
        }

        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new ValidationException("Order must contain at least one item");
        }

        if (order.getCustomerId() == null || order.getCustomerId().isBlank()) {
            throw new ValidationException("Customer ID is required");
        }

        double total = order.getItems().stream()
                .mapToDouble(OrderItem::getPrice)
                .sum();

        if (total <= 0) {
            throw new ValidationException("Order total must be positive");
        }

        // Validate each item
        for (OrderItem item : order.getItems()) {
            validator.validateItem(item);
        }
    }

    /**
     * Process a payment for an order.
     *
     * @param request The payment request
     * @return Payment result with transaction details
     */
    public PaymentResult processPayment(PaymentRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Payment request cannot be null");
        }

        if (request.getAmount() <= 0) {
            return PaymentResult.failure("Invalid payment amount");
        }

        if (request.getCardNumber() == null || !isValidCardNumber(request.getCardNumber())) {
            return PaymentResult.failure("Invalid card number");
        }

        try {
            String transactionId = paymentGateway.charge(
                    request.getCardNumber(),
                    request.getAmount(),
                    request.getCurrency()
            );

            return PaymentResult.success(transactionId, request.getAmount());
        } catch (PaymentGatewayException e) {
            return PaymentResult.failure("Payment failed: " + e.getMessage());
        }
    }

    private boolean isValidCardNumber(String cardNumber) {
        // Simple Luhn check simulation
        return cardNumber != null &&
               cardNumber.length() >= 13 &&
               cardNumber.length() <= 19 &&
               cardNumber.matches("\\d+");
    }
}

// ============================================================================
// Supporting Types
// ============================================================================

class Order {
    private String customerId;
    private List<OrderItem> items;
    private boolean premiumCustomer;

    public String getCustomerId() { return customerId; }
    public void setCustomerId(String customerId) { this.customerId = customerId; }
    public List<OrderItem> getItems() { return items; }
    public void setItems(List<OrderItem> items) { this.items = items; }
    public boolean isPremiumCustomer() { return premiumCustomer; }
    public void setPremiumCustomer(boolean premiumCustomer) { this.premiumCustomer = premiumCustomer; }
}

class OrderItem {
    private String productId;
    private String name;
    private double price;
    private int quantity;

    public String getProductId() { return productId; }
    public double getPrice() { return price; }
    public int getQuantity() { return quantity; }
}

class PaymentRequest {
    private String cardNumber;
    private double amount;
    private String currency;

    public String getCardNumber() { return cardNumber; }
    public double getAmount() { return amount; }
    public String getCurrency() { return currency; }
}

class PaymentResult {
    private boolean success;
    private String transactionId;
    private double amount;
    private String errorMessage;

    public static PaymentResult success(String transactionId, double amount) {
        PaymentResult result = new PaymentResult();
        result.success = true;
        result.transactionId = transactionId;
        result.amount = amount;
        return result;
    }

    public static PaymentResult failure(String errorMessage) {
        PaymentResult result = new PaymentResult();
        result.success = false;
        result.errorMessage = errorMessage;
        return result;
    }

    public boolean isSuccess() { return success; }
    public String getTransactionId() { return transactionId; }
    public double getAmount() { return amount; }
    public String getErrorMessage() { return errorMessage; }
}

class ValidationException extends Exception {
    public ValidationException(String message) {
        super(message);
    }
}

interface PaymentGateway {
    String charge(String cardNumber, double amount, String currency) throws PaymentGatewayException;
}

class PaymentGatewayException extends Exception {
    public PaymentGatewayException(String message) {
        super(message);
    }
}

interface OrderValidator {
    void validateItem(OrderItem item) throws ValidationException;
}
