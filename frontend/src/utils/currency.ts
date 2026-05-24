/**
 * Format a number as BDT currency with Bengali locale
 * @param amount - The amount to format
 * @param showSymbol - Whether to show the BDT symbol (default: true)
 * @returns Formatted currency string
 */
export const formatBDT = (amount: number, showSymbol = true): string => {
  const formatted = new Intl.NumberFormat('bn-BD', {
    style: 'currency',
    currency: 'BDT',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)

  // If showSymbol is false, remove the BDT symbol but keep the number
  if (!showSymbol) {
    return formatted.replace(/৳\s?/, '').trim()
  }

  return formatted
}

/**
 * Format a number as BDT with custom symbol
 * @param amount - The amount to format
 * @returns Formatted currency string with ৳ symbol
 */
export const formatBDTWithSymbol = (amount: number): string => {
  const numStr = Math.round(amount).toLocaleString('bn-BD')
  return `৳${numStr}`
}

/**
 * Parse a BDT formatted string back to a number
 * @param formatted - The formatted currency string
 * @returns The numeric value
 */
export const parseBDT = (formatted: string): number => {
  // Bengali digit mapping
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
  
  // Convert Bengali numerals to English
  let converted = formatted
  bengaliDigits.forEach((bengali, index) => {
    converted = converted.replace(new RegExp(bengali, 'g'), englishDigits[index])
  })
  
  // Remove currency symbol and whitespace
  const cleaned = converted.replace(/[৳\s,]/g, '')
  return parseFloat(cleaned) || 0
}
