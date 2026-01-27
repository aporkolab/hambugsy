package calculator

// Calculator provides basic math operations
type Calculator struct {
	precision int
}

// NewCalculator creates a new calculator with default precision
func NewCalculator() *Calculator {
	return &Calculator{precision: 2}
}

// Add returns the sum of two numbers
func (c *Calculator) Add(a, b float64) float64 {
	return a + b
}

// Subtract returns the difference of two numbers
func (c *Calculator) Subtract(a, b float64) float64 {
	return a - b
}

// Multiply returns the product of two numbers
func (c *Calculator) Multiply(a, b float64) float64 {
	return a * b
}

// Divide returns the quotient of two numbers
func (c *Calculator) Divide(a, b float64) (float64, error) {
	if b == 0 {
		return 0, ErrDivisionByZero
	}
	return a / b, nil
}

// ApplyDiscount applies a discount percentage to a price
func ApplyDiscount(price float64, discountPercent float64) float64 {
	return price * (1 - discountPercent/100)
}
