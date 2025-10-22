// Utility functions for working with Monorail API
// Handles amount conversions and token formatting

/**
 * Convert human-readable amount to wei/smallest unit
 * @param amount - Human readable amount (e.g., "1.5")
 * @param decimals - Token decimals (default: 18)
 * @returns Amount in wei as string
 */
export function toWei(amount: string, decimals: number = 18): string {
  const [integer, fraction = '0'] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  const value = BigInt(integer) * BigInt(10 ** decimals) + BigInt(paddedFraction);
  return value.toString();
}

/**
 * Convert wei/smallest unit to human-readable amount
 * @param wei - Amount in wei as string
 * @param decimals - Token decimals (default: 18)
 * @param precision - Display precision (default: 6)
 * @returns Human readable amount
 */
export function fromWei(wei: string, decimals: number = 18, precision: number = 6): string {
  const value = BigInt(wei);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  if (fractionalPart === BigInt(0)) {
    return integerPart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const trimmedFractional = fractionalStr.slice(0, precision).replace(/0+$/, '');
  
  if (trimmedFractional === '') {
    return integerPart.toString();
  }

  return `${integerPart}.${trimmedFractional}`;
}

/**
 * Common Monad testnet token addresses
 */
export const MONAD_TOKENS = {
  MON: '0x0000000000000000000000000000000000000000', // Native MON
  WMON: '0x760afe86e5de5fa0ee542fc7b7b713e1c5425701', // Wrapped MON
  USDC: '0xf817257fed379853cde0fa4f97ab987181b1e5ea', // USDC
  USDT: '0x0000000000000000000000000000000000000001', // Example USDT (update with real address)
  WETH: '0x0000000000000000000000000000000000000002', // Example WETH (update with real address)
} as const;

/**
 * Example usage for testing Monorail integration
 */
export function getSwapExample() {
  return {
    // Swap 1.5 MON for USDC
    fromToken: MONAD_TOKENS.MON,
    toToken: MONAD_TOKENS.USDC,
    amount: '1.5', // Human-readable format as per Monorail docs
    sender: '0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5', // Example address
  };
}

// Example usage:
if (typeof require !== 'undefined' && require.main === module) {
  console.log('Monorail Utility Examples:');
  console.log('');
  
  // Amount conversion examples
  console.log('Amount conversions:');
  console.log('- 1.5 MON to wei:', toWei('1.5'));
  console.log('- 1500000000000000000 wei to MON:', fromWei('1500000000000000000'));
  console.log('');
  
  // Swap example
  console.log('Swap example:');
  const example = getSwapExample();
  console.log('- From Token (MON):', example.fromToken);
  console.log('- To Token (USDC):', example.toToken);
  console.log('- Amount (1.5 MON in wei):', example.amount);
  console.log('- Sender:', example.sender);
  console.log('');
  
  // Quote URL example
  const quoteUrl = new URL('https://testnet-pathfinder.monorail.xyz/v4/quote');
  quoteUrl.searchParams.set('source', '0');
  quoteUrl.searchParams.set('from', example.fromToken);
  quoteUrl.searchParams.set('to', example.toToken);
  quoteUrl.searchParams.set('amount', example.amount); // Human-readable format
  quoteUrl.searchParams.set('sender', example.sender);
  
  console.log('Monorail API URL:');
  console.log(quoteUrl.toString());
}