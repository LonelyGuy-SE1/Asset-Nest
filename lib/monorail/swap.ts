import axios from 'axios';
import { type Address, type Hex } from 'viem';

/**
 * Monorail Swap Integration
 * Reference: https://testnet-preview.monorail.xyz/developers
 * Monorail provides optimal swap routing on Monad for best price execution
 */

export interface MonorailQuoteParams {
  from: Address; // Token to swap from (0x000...000 for native MON)
  to: Address; // Token to swap to
  amount: string; // Amount in wei
  slippage?: number; // Slippage tolerance (default 0.5%)
  source?: string; // App identifier
}

export interface MonorailQuoteResponse {
  fromToken: Address;
  toToken: Address;
  fromAmount: string;
  toAmount: string;
  estimatedGas: string;
  priceImpact: number;
  route: any[];
  transaction: {
    to: Address;
    data: Hex;
    value: string;
    gasLimit: string;
  };
}

export interface SwapTransaction {
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * Monorail API Client for Monad Testnet
 * Provides quote and swap execution functionality
 */
export class MonorailClient {
  private baseUrl: string;
  private appId: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_MONORAIL_API_URL || 'https://testnet-pathfinder.monorail.xyz';
    this.appId = process.env.NEXT_PUBLIC_MONORAIL_APP_ID || 'asset-nest-rebalancer';
  }

  /**
   * Get a swap quote from Monorail
   * Reference: https://testnet-preview.monorail.xyz/developers/documentation
   * Example: /v4/quote?source=APPID&from=0x...&to=0x...&amount=1000000
   */
  async getQuote(params: MonorailQuoteParams): Promise<MonorailQuoteResponse> {
    console.log('Fetching swap quote from Monorail...');
    console.log('Swap params:', params);

    const slippage = params.slippage || 0.5;

    try {
      const response = await axios.get(`${this.baseUrl}/v4/quote`, {
        params: {
          source: params.source || this.appId,
          from: params.from,
          to: params.to,
          amount: params.amount,
          slippage: slippage.toString(),
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const quote: MonorailQuoteResponse = response.data;
      console.log('Quote received:', quote);

      return quote;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail API error:', error.response?.data || error.message);
        throw new Error(`Failed to get quote: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get multiple quotes for batch swaps
   * Useful when rebalancing requires multiple trades
   */
  async getBatchQuotes(swapParams: MonorailQuoteParams[]): Promise<MonorailQuoteResponse[]> {
    console.log(`Fetching ${swapParams.length} swap quotes...`);

    const quotes = await Promise.all(
      swapParams.map((params) =>
        this.getQuote(params).catch((error) => {
          console.error(`Failed to get quote for ${params.from} -> ${params.to}:`, error);
          throw error;
        })
      )
    );

    console.log('All quotes received');
    return quotes;
  }

  /**
   * Prepare a swap transaction from a quote
   * Returns the transaction data ready to be sent via smart account
   */
  prepareSwapTransaction(quote: MonorailQuoteResponse): SwapTransaction {
    return {
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: BigInt(quote.transaction.value || '0'),
    };
  }

  /**
   * Get token price in USD (if Monorail provides pricing endpoints)
   * Fallback to hardcoded values for testnet
   */
  async getTokenPrice(tokenAddress: Address): Promise<number> {
    // In production, call Monorail's price API
    // For testnet, return mock prices
    const mockPrices: Record<string, number> = {
      '0x0000000000000000000000000000000000000000': 1000, // MON = $1000
      '0x0000000000000000000000000000000000000001': 1, // USDC = $1
      '0x0000000000000000000000000000000000000002': 1, // USDT = $1
      '0x0000000000000000000000000000000000000003': 2500, // WETH = $2500
    };

    return mockPrices[tokenAddress.toLowerCase()] || 1;
  }

  /**
   * Estimate total gas cost for multiple swaps
   */
  estimateBatchGasCost(quotes: MonorailQuoteResponse[]): bigint {
    const totalGas = quotes.reduce((sum, quote) => {
      return sum + BigInt(quote.estimatedGas);
    }, BigInt(0));

    // Add 20% buffer for safety
    return (totalGas * BigInt(120)) / BigInt(100);
  }
}

/**
 * Helper function to format token amounts for display
 */
export function formatTokenAmount(amount: string, decimals: number): string {
  const value = BigInt(amount);
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;

  return `${integerPart}.${fractionalPart.toString().padStart(decimals, '0').slice(0, 6)}`;
}

/**
 * Helper function to parse token amounts from human-readable format
 */
export function parseTokenAmount(amount: string, decimals: number): string {
  const [integer, fraction = '0'] = amount.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0');
  const value = BigInt(integer) * BigInt(10 ** decimals) + BigInt(paddedFraction);
  return value.toString();
}

// Export singleton instance
export const monorailClient = new MonorailClient();
