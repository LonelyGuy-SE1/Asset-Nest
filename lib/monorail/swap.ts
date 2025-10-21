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
    // Use app ID as shown in Monorail documentation (default: '0')
    this.appId = process.env.NEXT_PUBLIC_MONORAIL_APP_ID || '0';
  }

  /**
   * Register Asset Nest with Monorail for fee sharing program
   * Monorail offers fee sharing - bring volume, earn fees
   */
  async registerWithMonorail(): Promise<void> {
    console.log('Registering Asset Nest with Monorail fee sharing program...');
    // In production, this would register our app for fee sharing
    // Use the provided app ID for fee sharing
  }

  /**
   * Get a swap quote from Monorail V4 Pathfinder API
   * Reference: https://testnet-preview.monorail.xyz/developers/api-reference/pathfinder
   * Features: Sub-200ms response times, 15+ DEX aggregation, gasless approvals
   */
  async getQuote(params: MonorailQuoteParams): Promise<MonorailQuoteResponse> {
    console.log('Fetching swap quote from Monorail V4 Pathfinder...');
    console.log('Swap params:', params);

    const slippage = params.slippage || 0.5;

    try {
      // Follow exact Monorail documentation pattern
      // Reference: https://testnet-preview.monorail.xyz/developers/documentation
      const quoteUrl = new URL(`${this.baseUrl}/v4/quote`);
      quoteUrl.searchParams.set('source', params.source || this.appId);
      quoteUrl.searchParams.set('from', params.from);
      quoteUrl.searchParams.set('to', params.to);
      quoteUrl.searchParams.set('amount', params.amount);
      
      // Note: Slippage is NOT part of the quote request based on Monorail docs
      // It's handled during execution phase

      console.log('Monorail V4 Pathfinder URL:', quoteUrl.toString());

      const response = await fetch(quoteUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Asset-Nest/1.0.0',
          'X-Source-App': this.appId,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Monorail API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const quote = await response.json();
      console.log('Monorail V4 quote received:', {
        fromToken: quote.fromToken,
        toToken: quote.toToken,
        outputFormatted: quote.output_formatted,
        priceImpact: quote.priceImpact,
        gasEstimate: quote.estimatedGas,
        route: quote.route?.length || 0,
      });

      // Transform to our expected format
      const transformedQuote: MonorailQuoteResponse = {
        fromToken: params.from,
        toToken: params.to,
        fromAmount: params.amount,
        toAmount: quote.output || quote.outputAmount || '0',
        estimatedGas: quote.estimatedGas || '100000',
        priceImpact: parseFloat(quote.priceImpact || '0'),
        route: quote.route || [],
        transaction: {
          to: quote.transaction?.to || quote.to,
          data: quote.transaction?.data || quote.data,
          value: quote.transaction?.value || quote.value || '0',
          gasLimit: quote.transaction?.gasLimit || quote.gasLimit || '300000',
        },
      };

      return transformedQuote;
    } catch (error: any) {
      console.error('Monorail V4 Pathfinder error:', error);
      throw new Error(`Failed to get V4 quote: ${error.message}`);
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
    // For testnet, return realistic mock prices (testnet tokens have no real value)
    const mockPrices: Record<string, number> = {
      '0x0000000000000000000000000000000000000000': 1, // MON = $1 (testnet has no real value)
      '0x0000000000000000000000000000000000000001': 1, // USDC = $1
      '0x0000000000000000000000000000000000000002': 1, // USDT = $1
      '0x0000000000000000000000000000000000000003': 2500, // WETH = $2500 (for simulation)
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
