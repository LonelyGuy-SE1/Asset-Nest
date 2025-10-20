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
 */
export class MonorailDataClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.NEXT_PUBLIC_MONORAIL_API_URL || 'https://testnet-pathfinder.monorail.xyz';
  }

  /**
   * Get portfolio balances for an address
   * Reference: https://testnet-preview.monorail.xyz/developers/api-reference/data
   *
   * GET /v1/portfolio/{address}
   */
  async getPortfolio(address: Address): Promise<MonorailPortfolio> {
    console.log('Fetching portfolio from Monorail Data API:', address);

    try {
      const response = await axios.get(`${this.baseUrl}/v1/portfolio/${address}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = response.data;

      // Transform Monorail response to our format
      const portfolio: MonorailPortfolio = {
        address,
        totalValueUSD: data.totalValueUSD || 0,
        tokens: data.tokens?.map((token: any) => ({
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: token.balance,
          balanceUSD: token.balanceUSD || 0,
          price: token.price || 0,
          logo: token.logo,
        })) || [],
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
   * GET /v1/tokens/{address}
   */
  async getTokenInfo(tokenAddress: Address): Promise<MonorailTokenInfo> {
    console.log('Fetching token info from Monorail:', tokenAddress);

    try {
      const response = await axios.get(`${this.baseUrl}/v1/tokens/${tokenAddress}`, {
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
        price: data.price || 0,
        priceChange24h: data.priceChange24h || 0,
        volume24h: data.volume24h || 0,
        liquidity: data.liquidity || 0,
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
   * Get token prices for multiple addresses
   *
   * POST /v1/tokens/prices
   */
  async getTokenPrices(tokenAddresses: Address[]): Promise<Record<Address, number>> {
    console.log('Fetching token prices from Monorail:', tokenAddresses);

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/tokens/prices`,
        {
          addresses: tokenAddresses,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const prices: Record<Address, number> = {};

      if (response.data.prices) {
        for (const [address, price] of Object.entries(response.data.prices)) {
          prices[address as Address] = typeof price === 'number' ? price : 0;
        }
      }

      return prices;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail prices error:', error.response?.data || error.message);

        // Return empty prices if endpoint not available
        if (error.response?.status === 404) {
          console.warn('Monorail prices endpoint not available, returning empty prices');
          return {};
        }
      }
      throw error;
    }
  }

  /**
   * Get historical price data for a token
   *
   * GET /v1/tokens/{address}/history?interval=1h&limit=24
   */
  async getTokenHistory(
    tokenAddress: Address,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit: number = 24
  ): Promise<Array<{ timestamp: number; price: number; volume: number }>> {
    console.log('Fetching token history from Monorail:', tokenAddress);

    try {
      const response = await axios.get(
        `${this.baseUrl}/v1/tokens/${tokenAddress}/history`,
        {
          params: { interval, limit },
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.history || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail history error:', error.response?.data || error.message);

        if (error.response?.status === 404) {
          return [];
        }
      }
      throw error;
    }
  }

  /**
   * Get top tokens by volume or liquidity
   *
   * GET /v1/tokens/top?sortBy=volume&limit=10
   */
  async getTopTokens(
    sortBy: 'volume' | 'liquidity' | 'marketCap' = 'volume',
    limit: number = 10
  ): Promise<MonorailTokenInfo[]> {
    console.log('Fetching top tokens from Monorail');

    try {
      const response = await axios.get(`${this.baseUrl}/v1/tokens/top`, {
        params: { sortBy, limit },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.tokens || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Monorail top tokens error:', error.response?.data || error.message);

        if (error.response?.status === 404) {
          return [];
        }
      }
      throw error;
    }
  }
}

// Export singleton instance
export const monorailDataClient = new MonorailDataClient();
