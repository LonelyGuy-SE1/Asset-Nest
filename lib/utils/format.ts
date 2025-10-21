/**
 * Utility functions for formatting numbers and currencies in the UI
 */

/**
 * Formats a number to a readable string with appropriate decimal places
 * @param value - The number to format
 * @param decimals - Token decimals (default: 18)
 * @returns Formatted string
 */
export function formatNumber(value: number | string | bigint, decimals: number = 18): string {
  // Handle zero or invalid input
  if (!value || value === 0 || value === '0') {
    return '0.00';
  }

  let result: string;
  
  // Handle different input types
  if (typeof value === 'bigint') {
    // For bigint, use manual string division to avoid Number() conversion
    const balanceStr = value.toString();
    
    if (balanceStr.length <= decimals) {
      // Very small number, add leading zeros
      const padded = balanceStr.padStart(decimals, '0');
      result = '0.' + padded;
    } else {
      // Insert decimal point
      const integerPart = balanceStr.slice(0, balanceStr.length - decimals);
      const decimalPart = balanceStr.slice(balanceStr.length - decimals);
      result = integerPart + '.' + decimalPart;
    }
  } else if (typeof value === 'string') {
    // Just use the string value directly if it's already formatted
    result = value;
  } else {
    // For regular numbers, use toFixed to avoid scientific notation
    result = value.toFixed(Math.min(decimals, 6));
  }

  // Clean up the result - limit to 2 decimal places for display
  const parts = result.split('.');
  const integerPart = parts[0] || '0';
  let decimalPart = parts[1] || '00';
  
  // Limit decimal places to 2 and remove trailing zeros
  decimalPart = decimalPart.slice(0, 2).padEnd(2, '0');

  return integerPart + '.' + decimalPart;
}

/**
 * Formats a USD currency value
 * @param value - The value to format (already in USD dollars, not wei)
 * @returns Formatted currency string
 */
export function formatUSD(value: number | string | bigint): string {
  // Handle zero or invalid input
  if (!value || value === 0 || value === '0') {
    return '$0.00';
  }

  let numValue: number;
  if (typeof value === 'bigint') {
    numValue = Number(value);
  } else if (typeof value === 'string') {
    numValue = parseFloat(value);
  } else {
    numValue = value;
  }

  // Handle invalid numbers
  if (isNaN(numValue) || !isFinite(numValue)) {
    return '$0.00';
  }

  // Format with exactly 2 decimal places
  return '$' + numValue.toFixed(2);
}

/**
 * Formats a percentage value
 * @param value - The percentage value (0-100)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number | string): string {
  let num: number;
  
  if (typeof value === 'string') {
    num = parseFloat(value);
  } else {
    num = value;
  }

  if (isNaN(num) || !isFinite(num)) {
    return '0.0%';
  }

  return num.toFixed(1) + '%';
}

/**
 * Formats a token balance
 * @param balance - Raw token balance (in wei/smallest unit)
 * @param decimals - Token decimals
 * @returns Formatted balance string
 */
export function formatTokenBalance(balance: string | bigint, decimals: number = 18): string {
  if (!balance || balance === '0' || balance === 0n) {
    return '0.00';
  }

  try {
    // Convert to string for safe manipulation
    const balanceStr = balance.toString();

    // For very large balances, use BigInt math to avoid overflow
    if (balanceStr.length > 15) {
      // Use string manipulation for precision
      if (balanceStr.length <= decimals) {
        // Very small balance
        const padded = balanceStr.padStart(decimals + 1, '0');
        const decimal = padded.slice(0, -decimals) + '.' + padded.slice(-decimals);
        const num = parseFloat(decimal);
        return num.toFixed(Math.min(6, decimals));
      } else {
        // Insert decimal point
        const integerPart = balanceStr.slice(0, balanceStr.length - decimals);
        const decimalPart = balanceStr.slice(balanceStr.length - decimals);
        return integerPart + '.' + decimalPart.slice(0, 6);
      }
    }

    // For normal-sized balances, use regular division
    const num = typeof balance === 'bigint'
      ? Number(balance) / Math.pow(10, decimals)
      : parseFloat(balance) / Math.pow(10, decimals);

    // Handle invalid results
    if (isNaN(num) || !isFinite(num)) {
      return '0.00';
    }

    // Format with up to 6 decimal places, removing trailing zeros
    return num.toFixed(6).replace(/\.?0+$/, '');
  } catch (error) {
    console.error('Error formatting token balance:', error);
    return '0.00';
  }
}

/**
 * Safely parses a number from various input types
 * @param value - The value to parse
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed number or default
 */
export function safeParseNumber(value: any, defaultValue: number = 0): number {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isFinite(parsed) ? parsed : defaultValue;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  return defaultValue;
}