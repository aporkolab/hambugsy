using NUnit.Framework;
using Xunit;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using FluentAssertions;

namespace CalculatorApp.Tests
{
    // NUnit Tests
    [TestFixture]
    public class CalculatorNUnitTests
    {
        private Calculator _calculator;

        [SetUp]
        public void Setup()
        {
            _calculator = new Calculator();
        }

        [Test]
        public void Add_TwoNumbers_ReturnsSum()
        {
            var result = _calculator.Add(2, 3);
            Assert.AreEqual(5.0, result);
        }

        [Test]
        public void Subtract_TwoNumbers_ReturnsDifference()
        {
            var result = _calculator.Subtract(5, 3);
            Assert.That(result, Is.EqualTo(2.0));
        }

        [Test]
        public void Multiply_TwoNumbers_ReturnsProduct()
        {
            var result = _calculator.Multiply(4, 3);
            Assert.IsTrue(result == 12.0);
        }

        [Test]
        public void Divide_ValidNumbers_ReturnsQuotient()
        {
            var result = _calculator.Divide(10, 2);
            Assert.AreEqual(5.0, result);
        }

        [Test]
        public void Divide_ByZero_ThrowsException()
        {
            Assert.Throws<DivideByZeroException>(() => _calculator.Divide(10, 0));
        }
    }

    // xUnit Tests
    public class CalculatorXUnitTests
    {
        private readonly Calculator _calculator = new Calculator();

        [Fact]
        public void Add_TwoNumbers_ReturnsSum()
        {
            var result = _calculator.Add(2, 3);
            Assert.Equal(5.0, result);
        }

        [Fact]
        public void Subtract_TwoNumbers_ReturnsDifference()
        {
            var result = _calculator.Subtract(5, 3);
            Assert.Equal(2.0, result);
        }

        [Theory]
        [InlineData(4, 3, 12)]
        [InlineData(2, 5, 10)]
        public void Multiply_TwoNumbers_ReturnsProduct(double a, double b, double expected)
        {
            var result = _calculator.Multiply(a, b);
            Assert.Equal(expected, result);
        }

        [Fact]
        public void Divide_ByZero_ThrowsException()
        {
            Assert.Throws<DivideByZeroException>(() => _calculator.Divide(10, 0));
        }
    }

    // MSTest Tests
    [TestClass]
    public class CalculatorMSTestTests
    {
        private Calculator _calculator;

        [TestInitialize]
        public void Setup()
        {
            _calculator = new Calculator();
        }

        [TestMethod]
        public void Add_TwoNumbers_ReturnsSum()
        {
            var result = _calculator.Add(2, 3);
            Assert.AreEqual(5.0, result);
        }

        [TestMethod]
        public void Subtract_TwoNumbers_ReturnsDifference()
        {
            var result = _calculator.Subtract(5, 3);
            Assert.AreEqual(2.0, result);
        }

        [TestMethod]
        [ExpectedException(typeof(DivideByZeroException))]
        public void Divide_ByZero_ThrowsException()
        {
            _calculator.Divide(10, 0);
        }
    }

    // FluentAssertions Tests
    public class CalculatorFluentTests
    {
        private readonly Calculator _calculator = new Calculator();

        [Fact]
        public void Add_TwoNumbers_ReturnsSum()
        {
            var result = _calculator.Add(2, 3);
            result.Should().Be(5.0);
        }

        [Fact]
        public void Subtract_TwoNumbers_ReturnsDifference()
        {
            var result = _calculator.Subtract(5, 3);
            result.Should().BeEquivalentTo(2.0);
        }

        [Fact]
        public void Result_ShouldBeTrue()
        {
            var isPositive = _calculator.Add(1, 1) > 0;
            isPositive.Should().BeTrue();
        }

        [Fact]
        public void Result_ShouldNotBeNull()
        {
            var calc = new Calculator();
            calc.Should().NotBeNull();
        }
    }
}
