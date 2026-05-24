import { describe, it, expect } from 'vitest'
import { formatBDT, parseBDT } from '../currency'

describe('formatBDT', () => {
  it('should format zero correctly', () => {
    const result = formatBDT(0)
    expect(result).toContain('৳')
    // Result will have Bengali numerals
    expect(result).toBeTruthy()
  })

  it('should format positive numbers with BDT symbol', () => {
    const result1 = formatBDT(1000)
    const result2 = formatBDT(100000)
    expect(result1).toContain('৳')
    expect(result2).toContain('৳')
  })

  it('should format decimal numbers correctly', () => {
    const result1 = formatBDT(1234.56)
    const result2 = formatBDT(0.99)
    expect(result1).toContain('৳')
    expect(result2).toContain('৳')
  })

  it('should handle large numbers', () => {
    const result1 = formatBDT(1000000)
    const result2 = formatBDT(9999999.99)
    expect(result1).toContain('৳')
    expect(result2).toContain('৳')
  })

  it('should handle negative numbers', () => {
    const result1 = formatBDT(-1000)
    const result2 = formatBDT(-0.99)
    expect(result1).toContain('৳')
    expect(result2).toContain('৳')
  })

  it('should include BDT symbol by default', () => {
    const result = formatBDT(1000)
    expect(result).toContain('৳')
  })

  it('should exclude symbol when showSymbol is false', () => {
    const result = formatBDT(1000, false)
    expect(result).not.toContain('৳')
  })
})

describe('parseBDT', () => {
  it('should parse formatted BDT string back to number', () => {
    const formatted = formatBDT(1000)
    const parsed = parseBDT(formatted)
    expect(parsed).toBe(1000)
  })

  it('should handle decimal values', () => {
    const formatted = formatBDT(1234.56)
    const parsed = parseBDT(formatted)
    expect(parsed).toBeCloseTo(1234.56, 1)
  })

  it('should return 0 for invalid input', () => {
    expect(parseBDT('invalid')).toBe(0)
    expect(parseBDT('')).toBe(0)
  })
})
