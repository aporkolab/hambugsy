package calculator

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdd(t *testing.T) {
	calc := NewCalculator()
	result := calc.Add(2, 3)
	assert.Equal(t, 5.0, result)
}

func TestSubtract(t *testing.T) {
	calc := NewCalculator()
	result := calc.Subtract(5, 3)
	assert.Equal(t, 2.0, result)
}

func TestMultiply(t *testing.T) {
	calc := NewCalculator()
	result := calc.Multiply(4, 3)
	assert.Equal(t, 12.0, result)
}

func TestDivide(t *testing.T) {
	calc := NewCalculator()
	result, err := calc.Divide(10, 2)
	require.NoError(t, err)
	assert.Equal(t, 5.0, result)
}

func TestDivideByZero(t *testing.T) {
	calc := NewCalculator()
	_, err := calc.Divide(10, 0)
	assert.Error(t, err)
}

func TestApplyDiscount(t *testing.T) {
	result := ApplyDiscount(100, 10)
	assert.Equal(t, 90.0, result)
}

func BenchmarkAdd(b *testing.B) {
	calc := NewCalculator()
	for i := 0; i < b.N; i++ {
		calc.Add(1, 2)
	}
}
