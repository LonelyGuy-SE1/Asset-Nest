import axios from 'axios';
import { type Address } from 'viem';

/**
 * Monorail Data API Integration
 * Reference: https://testnet-preview.monorail.xyz/developers/api-reference/data
 *
 * Provides portfolio balances, token prices, and historical data from Monorail
 */

export interface MonorailTokenBalance {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUSD: number;
  price: number;
  logo?: string;
  categories?: string[];
  pconf?: string;
  monValue?: string;
  monPerToken?: string;
}

export interface MonorailPortfolio {
  address: Address;
  totalValueUSD: number;
  tokens: MonorailTokenBalance[];
  lastUpdated: number;
}

export interface MonorailTokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

/**
 * Monorail Data API Client for Monad Testnet
 * API Documentation: https://testnet-preview.monorail.xyz/developers/api-reference/data
 */
export class MonorailDataClient {
  private baseUrl: string;
  private dataApiUrl: string;

  constructor() {
    // Pathfinder API for swaps (different from Data API)
    this.baseUrl = process.env.NEXT_PUBLIC_MONORAIL_API_URL || 'https://testnet-pathfinder.monorail.xyz';

    // Data API for balances and token info - using the correct testnet URLs with /v1
    this.dataApiUrl = process.env.NEXT_PUBLIC_MONORAIL_DATA_API_URL || 'https://testnet-api.monorail.xyz/v1';
  }

  /**
   * Get portfolio balances for an address
   * Reference: https://testnet-preview.monorail.xyz/developers/api-reference/data
   *
   * Correct endpoint: GET /v1/wallet/{address}/balances
   */
  async getPortfolio(address: Address): Promise<MonorailPortfolio> {
    console.log('Fetching portfolio from Monorail Data API:', address);
    console.log('Using Data API URL:', this.dataApiUrl);

    try {
      const response = await axios.get(`${this.dataApiUrl}/wallet/${address}/balances`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      console.log('Raw Monorail Data API response:', JSON.stringify(data, null, 2));
      
      // Log individual token data to see what logo fields are available
      if (data.length > 0) {
        console.log('First token sample:', JSON.stringify(data[0], null, 2));
        console.log('Logo field value:', data[0].logo);
        console.log('Available fields:', Object.keys(data[0]));
      }

      // Transform Monorail response to our format
      // The API returns an array of token objects directly
      const tokens = response.data || [];
      console.log(`Received ${tokens.length} tokens from Monorail`);

      const transformedTokens = tokens.map((token: any, index: number) => {
        // Parse balance and price - be VERY explicit
        const balance = parseFloat(token.balance || '0');
        const priceUSD = parseFloat(token.usd_per_token || '0');

        // Calculate USD value
        const balanceUSD = balance * priceUSD;



        return {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance, // Keep as string (already human-readable, not wei)
          balanceUSD: balanceUSD,
          price: priceUSD,
          logo: token.logo,
          categories: token.categories || [],
          pconf: token.pconf || '0',
          monValue: token.mon_value || '0',
          monPerToken: token.mon_per_token || '0',
        };
      });

      const totalValueUSD = transformedTokens.reduce((sum: number, t: any) => sum + t.balanceUSD, 0);

      // Sort tokens by USD value (largest first)
      const sortedTokens = transformedTokens.sort((a: any, b: any) => b.balanceUSD - a.balanceUSD);

      const portfolio: MonorailPortfolio = {
        address,
        totalValueUSD,
        tokens: sortedTokens,
        lastUpdated: Date.now(),
      };

      console.log('Portfolio fetched from Monorail:', portfolio);
      return portfolio;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail Data API error:', error.response?.data || error.message);

        // If endpoint doesn't exist yet, return empty portfolio
        if (error.response?.status === 404) {
          console.warn('Monorail portfolio endpoint not available, returning empty portfolio');
          return {
            address,
            totalValueUSD: 0,
            tokens: [],
            lastUpdated: Date.now(),
          };
        }

        throw new Error(
          `Failed to fetch portfolio: ${error.response?.data?.message || error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Get token information and price
   *
   * Correct endpoint: GET /token/{contractAddress}
   */
  async getTokenInfo(tokenAddress: Address): Promise<MonorailTokenInfo> {
    console.log('Fetching token info from Monorail:', tokenAddress);

    try {
      const response = await axios.get(`${this.dataApiUrl}/token/${tokenAddress}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      const tokenInfo: MonorailTokenInfo = {
        address: tokenAddress,
        symbol: data.symbol,
        name: data.name,
        decimals: data.decimals,
        price: data.usd_per_token ? parseFloat(data.usd_per_token) : 0,
        priceChange24h: 0, // Not provided in current API
        volume24h: 0, // Not provided in current API
        liquidity: 0, // Not provided in current API
      };

      return tokenInfo;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail token info error:', error.response?.data || error.message);

        // Return default values if not available
        if (error.response?.status === 404) {
          return {
            address: tokenAddress,
            symbol: 'UNKNOWN',
            name: 'Unknown Token',
            decimals: 18,
            price: 0,
            priceChange24h: 0,
            volume24h: 0,
            liquidity: 0,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Get all tokens list
   *
   * GET /v1/tokens
   */
  async getAllTokens(): Promise<any[]> {
    console.log('Fetching all tokens from Monorail Data API');

    try {
      // Use the correct endpoint from test-monorail-data-api.js
      const endpoint = `${this.dataApiUrl}/tokens`;

      console.log(`Fetching from endpoint: ${endpoint}`);
      const response = await axios.get(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const tokens = response.data || [];
      console.log(`Successfully fetched ${tokens.length} tokens from Monorail Data API`);

      // Log first few tokens to see the structure
      if (tokens.length > 0) {
        console.log('First 3 tokens:', tokens.slice(0, 3));
      }

      return tokens;
    } catch (error: any) {
      console.error('getAllTokens failed:', error.response?.data || error.message);

      // If endpoint doesn't exist yet, return empty array
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.warn('Monorail tokens endpoint not available, returning empty array');
        return [];
      }

      return [];
    }
  }

  /**
   * Get token prices for multiple addresses (using individual token lookups)
   * Note: Batch pricing endpoint may not exist, so we fetch individually
   */
  async getTokenPrices(tokenAddresses: Address[]): Promise<Record<Address, number>> {
    console.log('Fetching token prices from Monorail:', tokenAddresses);

    try {
      // Fetch each token individually since batch endpoint may not exist
      const pricePromises = tokenAddresses.map(async (addr) => {
        try {
          const tokenInfo = await this.getTokenInfo(addr);
          return { address: addr, price: tokenInfo.price };
        } catch {
          return { address: addr, price: 0 };
        }
      });

      const results = await Promise.all(pricePromises);

      const prices: Record<Address, number> = {};
      results.forEach(({ address, price }) => {
        prices[address] = price;
      });

      return prices;
    } catch (error) {
      console.error('Monorail prices error:', error);
      return {};
    }
  }

  /**
   * Get portfolio value in USD
   *
   * GET /portfolio/{address}/value
   */
  async getPortfolioValue(address: Address): Promise<number> {
    console.log('Fetching portfolio value from Monorail:', address);

    try {
      const response = await axios.get(`${this.dataApiUrl}/portfolio/${address}/value`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.value ? parseFloat(response.data.value) : 0;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail portfolio value error:', error.response?.data || error.message);
        return 0;
      }
      throw error;
    }
  }
}

// Export singleton instance
export const monorailDataClient = new MonorailDataClient();
