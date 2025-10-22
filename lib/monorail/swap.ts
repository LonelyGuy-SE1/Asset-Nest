import axios from 'axios';
import { type Address, type Hex } from 'viem';

/**
 * COMPLETE REWRITE - Monorail Swap Integration
 * Reference: https://testnet-preview.monorail.xyz/developers/api-reference/pathfinder
 */

export interface MonorailQuoteParams {
  from: Address;
  to: Address;
  amount: string; // Human-readable format (e.g., "1.5" for 1.5 tokens)
  sender?: Address;
  max_slippage?: number; // Maximum slippage in basis points (1-7500), defaults to 50 (0.5%)
  deadline?: number; // Deadline in seconds from now, defaults to 60
  destination?: Address; // Where to send resulting tokens, defaults to sender
}

export interface MonorailQuoteResponse {
  fromToken: Address;
  toToken: Address;
  fromAmount: string; // Human-readable (e.g., "0.1")
  toAmount: string; // Human-readable (e.g., "0.099")
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

export class MonorailSwapClient {
  private baseUrl: string;
  private appId: string;

  constructor() {
    this.baseUrl = 'https://testnet-pathfinder.monorail.xyz';
    this.appId = '0'; // Default app ID for testnet
  }

  /**
   * Get swap quote from Monorail
   * IMPORTANT: amount parameter should be in human-readable format (e.g. "1.5")
   */
  async getQuote(params: MonorailQuoteParams): Promise<MonorailQuoteResponse> {
    console.log('[MONORAIL] Getting quote...');
    console.log('[MONORAIL] Input params:', {
      from: params.from,
      to: params.to,
      amount: params.amount,
      sender: params.sender,
    });

    try {
      // Build URL with query parameters
      const url = new URL(`${this.baseUrl}/v4/quote`);
      url.searchParams.set('source', this.appId);
      url.searchParams.set('from', params.from);
      url.searchParams.set('to', params.to);
      url.searchParams.set('amount', params.amount); // Human-readable format
      
      // Required parameters for executable transaction
      if (params.sender) {
        url.searchParams.set('sender', params.sender);
      }
      
      // SIMPLIFIED: Only use sender for executable transaction
      // Extra parameters might be causing transaction differences
      // Let Monorail handle slippage/deadline defaults
      
      // Only add optional parameters if explicitly provided
      if (params.max_slippage !== undefined) {
        url.searchParams.set('max_slippage', params.max_slippage.toString());
      }
      
      if (params.deadline !== undefined) {
        url.searchParams.set('deadline', params.deadline.toString());
      }
      
      if (params.destination) {
        url.searchParams.set('destination', params.destination);
      }

      console.log('[MONORAIL] Request URL:', url.toString());

      const response = await axios.get(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const result = response.data;

      console.log('[MONORAIL] Raw response:', {
        output_formatted: result.output_formatted,
        transaction: result.transaction ? 'present' : 'missing',
        gas_estimate: result.gas_estimate,
        transaction_to: result.transaction?.to,
        transaction_data_length: result.transaction?.data?.length || 0,
      });

      // Validate transaction data
      if (!result.transaction || !result.transaction.to || !result.transaction.data || result.transaction.data === '0x') {
        console.warn('[MONORAIL] Warning: Missing or invalid transaction data');
        if (!params.sender) {
          throw new Error('Transaction data missing. Please provide sender address for executable quotes.');
        }
      }

      // According to documentation, output_formatted is the expected output amount
      const toAmount = result.output_formatted || '0';

      return {
        fromToken: params.from,
        toToken: params.to,
        fromAmount: params.amount,
        toAmount,
        estimatedGas: (result.gas_estimate || 200000).toString(),
        priceImpact: 0, // Not provided in basic response
        route: result.routes || [],
        transaction: {
          to: result.transaction?.to || params.to,
          data: result.transaction?.data || '0x',
          value: result.transaction?.value || '0',
          gasLimit: (result.gas_estimate || 200000).toString(),
        },
      };
    } catch (error: any) {
      console.error('[MONORAIL] Error:', error.response?.data || error.message);
      throw new Error(`Monorail quote failed: ${error.message}`);
    }
  }

  /**
   * Prepare swap transaction from quote response
   */
  prepareSwapTransaction(quote: MonorailQuoteResponse): {
    to: Address;
    data: Hex;
    value: bigint;
  } {
    return {
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: BigInt(quote.transaction.value || '0'),
    };
  }
}

// Export singleton instance
export const monorailClient = new MonorailSwapClient();

// Helper function to format token amounts (no longer needed, kept for backwards compatibility)
export function formatTokenAmount(amount: string, decimals: number = 18): string {
  const value = BigInt(amount);
  return (Number(value) / Math.pow(10, decimals)).toString();
}
