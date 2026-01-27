/// A simple calculator for basic math operations
pub struct Calculator {
    precision: u32,
}

impl Calculator {
    /// Creates a new calculator with default precision
    pub fn new() -> Self {
        Calculator { precision: 2 }
    }

    /// Returns the sum of two numbers
    pub fn add(&self, a: f64, b: f64) -> f64 {
        a + b
    }

    /// Returns the difference of two numbers
    pub fn subtract(&self, a: f64, b: f64) -> f64 {
        a - b
    }

    /// Returns the product of two numbers
    pub fn multiply(&self, a: f64, b: f64) -> f64 {
        a * b
    }

    /// Returns the quotient of two numbers
    pub fn divide(&self, a: f64, b: f64) -> Result<f64, &'static str> {
        if b == 0.0 {
            Err("Division by zero")
        } else {
            Ok(a / b)
        }
    }
}

/// Applies a discount percentage to a price
pub fn apply_discount(price: f64, discount_percent: f64) -> f64 {
    price * (1.0 - discount_percent / 100.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        let calc = Calculator::new();
        let result = calc.add(2.0, 3.0);
        assert_eq!(result, 5.0);
    }

    #[test]
    fn test_subtract() {
        let calc = Calculator::new();
        let result = calc.subtract(5.0, 3.0);
        assert_eq!(result, 2.0);
    }

    #[test]
    fn test_multiply() {
        let calc = Calculator::new();
        let result = calc.multiply(4.0, 3.0);
        assert_eq!(result, 12.0);
    }

    #[test]
    fn test_divide() {
        let calc = Calculator::new();
        let result = calc.divide(10.0, 2.0).unwrap();
        assert_eq!(result, 5.0);
    }

    #[test]
    fn test_divide_by_zero() {
        let calc = Calculator::new();
        let result = calc.divide(10.0, 0.0);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_discount() {
        let result = apply_discount(100.0, 10.0);
        assert_eq!(result, 90.0);
    }

    #[test]
    #[should_panic]
    fn test_panic_example() {
        panic!("This test expects a panic");
    }
}
