using System;

namespace CalculatorApp
{
    /// <summary>
    /// A simple calculator for basic math operations
    /// </summary>
    public class Calculator
    {
        private readonly int _precision;

        public Calculator()
        {
            _precision = 2;
        }

        /// <summary>
        /// Returns the sum of two numbers
        /// </summary>
        public double Add(double a, double b)
        {
            return a + b;
        }

        /// <summary>
        /// Returns the difference of two numbers
        /// </summary>
        public double Subtract(double a, double b)
        {
            return a - b;
        }

        /// <summary>
        /// Returns the product of two numbers
        /// </summary>
        public double Multiply(double a, double b)
        {
            return a * b;
        }

        /// <summary>
        /// Returns the quotient of two numbers
        /// </summary>
        public double Divide(double a, double b)
        {
            if (b == 0)
            {
                throw new DivideByZeroException("Cannot divide by zero");
            }
            return a / b;
        }

        /// <summary>
        /// Applies a discount percentage to a price
        /// </summary>
        public static double ApplyDiscount(double price, double discountPercent)
        {
            return price * (1 - discountPercent / 100);
        }
    }
}
