import { z } from 'zod'

/**
 * Bangladesh-specific validation schemas
 */

/**
 * Validate Bangladesh phone number
 * Format: +880XXXXXXXXXX or 0XXXXXXXXXX (10-11 digits)
 */
export const bangladeshPhoneSchema = z
  .string()
  .regex(
    /^(\+880|0)[1-9]\d{8,9}$/,
    'Invalid Bangladesh phone number. Use format: +880XXXXXXXXXX or 0XXXXXXXXXX'
  )

/**
 * Validate Bangladesh postal code
 * Format: 4-digit postal code (1000-9999)
 */
export const bangladeshPostalCodeSchema = z
  .string()
  .regex(/^\d{4}$/, 'Postal code must be 4 digits (e.g., 1205 for Dhaka)')
  .refine(
    (code) => {
      const num = parseInt(code, 10)
      return num >= 1000 && num <= 9999
    },
    'Postal code must be between 1000 and 9999'
  )

/**
 * Validate Bangladesh address
 */
export const bangladeshAddressSchema = z.object({
  recipientName: z.string().min(2, 'Name is required'),
  phone: bangladeshPhoneSchema,
  street: z.string().min(5, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  postalCode: bangladeshPostalCodeSchema,
  country: z.literal('Bangladesh').default('Bangladesh'),
})

export type BangladeshAddress = z.infer<typeof bangladeshAddressSchema>

/**
 * Common Bangladesh cities
 */
export const bangladeshCities = [
  'Dhaka',
  'Chittagong',
  'Khulna',
  'Rajshahi',
  'Barisal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
  'Gazipur',
  'Narayanganj',
  'Narsingdi',
  'Tangail',
  'Jashore',
  'Bogra',
  'Dinajpur',
  'Pabna',
  'Sirajganj',
  'Comilla',
  'Noakhali',
  'Feni',
  'Habiganj',
  'Moulvibazar',
  'Sunamganj',
  'Kurigram',
  'Lalmonirhat',
  'Nilphamari',
  'Thakurgaon',
  'Panchagarh',
  'Jaipurhat',
  'Naogaon',
  'Chapainawabganj',
  'Pirojpur',
  'Jhalokati',
  'Patuakhali',
  'Bhola',
  'Madaripur',
  'Shariatpur',
  'Rajbari',
  'Munshiganj',
  'Manikganj',
  'Kishoreganj',
  'Netrokona',
  'Sherpur',
  'Jamalpur',
]

/**
 * Bangladesh postal code ranges by division
 */
export const bangladeshPostalCodeRanges: Record<string, { min: number; max: number }> = {
  'Dhaka Division': { min: 1000, max: 1999 },
  'Chittagong Division': { min: 4000, max: 4999 },
  'Khulna Division': { min: 9000, max: 9999 },
  'Rajshahi Division': { min: 6000, max: 6999 },
  'Barisal Division': { min: 8200, max: 8999 },
  'Sylhet Division': { min: 3100, max: 3199 },
  'Rangpur Division': { min: 5400, max: 5999 },
  'Mymensingh Division': { min: 2200, max: 2299 },
}

/**
 * Get division name from postal code
 */
export const getDivisionFromPostalCode = (postalCode: string): string | null => {
  const code = parseInt(postalCode, 10)
  for (const [division, range] of Object.entries(bangladeshPostalCodeRanges)) {
    if (code >= range.min && code <= range.max) {
      return division
    }
  }
  return null
}

/**
 * Format Bangladesh phone number
 * Converts various formats to standard +880XXXXXXXXXX format
 */
export const formatBangladeshPhone = (phone: string): string => {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // If starts with 0, replace with +880
  if (cleaned.startsWith('0')) {
    cleaned = '+880' + cleaned.slice(1)
  }

  // If doesn't start with +880, add it
  if (!cleaned.startsWith('+880')) {
    cleaned = '+880' + cleaned.replace(/^\+?/, '')
  }

  return cleaned
}

/**
 * Validate Bangladesh NID (National ID) format
 * Format: 10 or 13 digits
 */
export const bangladeshNIDSchema = z
  .string()
  .regex(/^\d{10}$|^\d{13}$/, 'NID must be 10 or 13 digits')

/**
 * Validate Bangladesh TIN (Tax Identification Number)
 * Format: 12 digits
 */
export const bangladeshTINSchema = z
  .string()
  .regex(/^\d{12}$/, 'TIN must be 12 digits')
