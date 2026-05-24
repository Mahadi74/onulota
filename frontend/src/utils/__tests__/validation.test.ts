import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Define validation schemas for testing
const emailSchema = z.string().email('Invalid email')
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')
const phoneSchema = z.string().regex(/^\+?880\d{9,10}$/, 'Invalid Bangladesh phone number')
const postalCodeSchema = z.string().regex(/^\d{4}$/, 'Postal code must be 4 digits')

describe('Validation Schemas', () => {
  describe('Email Validation', () => {
    it('should validate correct email', () => {
      expect(() => emailSchema.parse('user@example.com')).not.toThrow()
    })

    it('should reject invalid email', () => {
      expect(() => emailSchema.parse('invalid-email')).toThrow()
      expect(() => emailSchema.parse('user@')).toThrow()
      expect(() => emailSchema.parse('@example.com')).toThrow()
    })

    it('should reject empty email', () => {
      expect(() => emailSchema.parse('')).toThrow()
    })
  })

  describe('Password Validation', () => {
    it('should validate correct password', () => {
      expect(() => passwordSchema.parse('SecurePass123')).not.toThrow()
    })

    it('should reject short password', () => {
      expect(() => passwordSchema.parse('short')).toThrow()
    })

    it('should reject empty password', () => {
      expect(() => passwordSchema.parse('')).toThrow()
    })
  })

  describe('Phone Number Validation', () => {
    it('should validate Bangladesh phone numbers', () => {
      expect(() => phoneSchema.parse('+8801234567890')).not.toThrow()
      expect(() => phoneSchema.parse('8801234567890')).not.toThrow()
      expect(() => phoneSchema.parse('+880123456789')).not.toThrow()
    })

    it('should reject invalid phone numbers', () => {
      expect(() => phoneSchema.parse('1234567890')).toThrow()
      expect(() => phoneSchema.parse('+1234567890')).toThrow()
      expect(() => phoneSchema.parse('invalid')).toThrow()
    })

    it('should reject empty phone', () => {
      expect(() => phoneSchema.parse('')).toThrow()
    })
  })

  describe('Postal Code Validation', () => {
    it('should validate 4-digit postal codes', () => {
      expect(() => postalCodeSchema.parse('1000')).not.toThrow()
      expect(() => postalCodeSchema.parse('9999')).not.toThrow()
    })

    it('should reject non-4-digit codes', () => {
      expect(() => postalCodeSchema.parse('100')).toThrow()
      expect(() => postalCodeSchema.parse('10000')).toThrow()
      expect(() => postalCodeSchema.parse('abcd')).toThrow()
    })

    it('should reject empty postal code', () => {
      expect(() => postalCodeSchema.parse('')).toThrow()
    })
  })
})
