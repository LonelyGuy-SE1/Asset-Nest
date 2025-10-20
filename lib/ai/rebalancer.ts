import { OpenAI } from 'openai';
import axios from 'axios';

/**
 * AI-Powered Portfolio Rebalancer
 * Uses AI (OpenAI or Crestal IntentKit) to compute optimal rebalancing trades
 * Reference: https://open.service.crestal.network/v1/redoc
 */

export interface PortfolioHolding {
  token: string;
  symbol: string;
  balance: string;
  valueUSD: number;
}

export interface PortfolioTarget {
  symbol: string;
  targetPercentage: number;
}

export interface RebalanceTrade {
  fromToken: string;
  toToken: string;
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  reason: string;
}

export interface RebalanceStrategy {
  trades: RebalanceTrade[];
  rationale: string;
  estimatedGas: string;
}

/**
 * AI Rebalancer using OpenAI GPT-4
 * Analyzes portfolio and suggests optimal trades
 */
export class OpenAIRebalancer {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async computeRebalancingTrades(
    holdings: PortfolioHolding[],
    targets: PortfolioTarget[]
  ): Promise<RebalanceStrategy> {
    console.log('Computing rebalancing trades with OpenAI...');

    const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    const prompt = `You are a DeFi portfolio manager. Analyze this portfolio and suggest optimal trades to rebalance it.

Current Holdings:
${holdings
  .map(
    (h) =>
      `- ${h.symbol}: ${h.balance} (${((h.valueUSD / totalValue) * 100).toFixed(2)}% of portfolio, $${h.valueUSD.toFixed(2)})`
  )
  .join('\n')}

Target Allocation:
${targets.map((t) => `- ${t.symbol}: ${t.targetPercentage}%`).join('\n')}

Total Portfolio Value: $${totalValue.toFixed(2)}

Task: Generate a list of trades to rebalance the portfolio to match target allocations. Minimize the number of trades and gas costs.

Respond in this exact JSON format:
{
  "trades": [
    {
      "fromToken": "address",
      "toToken": "address",
      "fromSymbol": "SYMBOL",
      "toSymbol": "SYMBOL",
      "amount": "amount in wei",
      "reason": "explanation"
    }
  ],
  "rationale": "overall strategy explanation",
  "estimatedGas": "estimated gas cost"
}`;

    try {
      const completion = await this.client.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional DeFi portfolio manager specializing in optimal trade execution and gas efficiency. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;
      if (!response) throw new Error('Empty response from OpenAI');

      const strategy: RebalanceStrategy = JSON.parse(response);
      console.log('Rebalancing strategy computed:', strategy);

      return strategy;
    } catch (error) {
      console.error('Error computing rebalancing trades:', error);
      throw error;
    }
  }
}

/**
 * AI Rebalancer using Crestal IntentKit
 * Reference: https://open.service.crestal.network/v1/redoc
 * Uses Crestal's AI agent API for more sophisticated intent-based trading
 */
export class CrestalRebalancer {
  private apiUrl: string;
  private apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async computeRebalancingTrades(
    holdings: PortfolioHolding[],
    targets: PortfolioTarget[]
  ): Promise<RebalanceStrategy> {
    console.log('Computing rebalancing trades with Crestal IntentKit...');

    const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    // Construct intent for Crestal API
    const intent = {
      type: 'portfolio_rebalance',
      current_holdings: holdings,
      target_allocation: targets,
      total_value: totalValue,
      constraints: {
        minimize_trades: true,
        minimize_gas: true,
        max_slippage: 0.5,
      },
    };

    try {
      // Call Crestal IntentKit API
      // Reference: https://open.service.crestal.network/v1/redoc
      const response = await axios.post(
        `${this.apiUrl}/agent/execute`,
        {
          intent,
          chain: 'monad-testnet',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      const strategy: RebalanceStrategy = response.data.result;
      console.log('Rebalancing strategy computed:', strategy);

      return strategy;
    } catch (error) {
      console.error('Error calling Crestal API:', error);
      // Fallback to simple algorithm
      return this.fallbackRebalanceAlgorithm(holdings, targets);
    }
  }

  /**
   * Fallback algorithm if AI APIs are unavailable
   * Simple greedy rebalancing approach
   */
  private fallbackRebalanceAlgorithm(
    holdings: PortfolioHolding[],
    targets: PortfolioTarget[]
  ): RebalanceStrategy {
    console.log('Using fallback rebalancing algorithm...');

    const trades: RebalanceTrade[] = [];
    const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    // Calculate current vs target percentages
    const rebalanceNeeds = holdings.map((holding) => {
      const currentPercent = (holding.valueUSD / totalValue) * 100;
      const target = targets.find((t) => t.symbol === holding.symbol);
      const targetPercent = target?.targetPercentage || 0;
      const diff = targetPercent - currentPercent;
      const diffValue = (diff / 100) * totalValue;

      return {
        ...holding,
        currentPercent,
        targetPercent,
        diff,
        diffValue,
      };
    });

    // Find tokens to sell (negative diff) and buy (positive diff)
    const toSell = rebalanceNeeds.filter((h) => h.diff < -0.5).sort((a, b) => a.diff - b.diff);
    const toBuy = rebalanceNeeds.filter((h) => h.diff > 0.5).sort((a, b) => b.diff - a.diff);

    // Create trades
    for (const sell of toSell) {
      for (const buy of toBuy) {
        if (Math.abs(sell.diffValue) > 1 && Math.abs(buy.diffValue) > 1) {
          const tradeValue = Math.min(Math.abs(sell.diffValue), Math.abs(buy.diffValue));
          const amount = ((tradeValue / sell.valueUSD) * parseFloat(sell.balance)).toString();

          trades.push({
            fromToken: sell.token,
            toToken: buy.token,
            fromSymbol: sell.symbol,
            toSymbol: buy.symbol,
            amount,
            reason: `Rebalance ${sell.symbol} (${sell.currentPercent.toFixed(1)}% -> ${sell.targetPercent}%) to ${buy.symbol} (${buy.currentPercent.toFixed(1)}% -> ${buy.targetPercent}%)`,
          });

          sell.diffValue += tradeValue;
          buy.diffValue -= tradeValue;
        }
      }
    }

    return {
      trades,
      rationale: 'Simple greedy rebalancing to match target allocations',
      estimatedGas: '0.001 ETH',
    };
  }
}

/**
 * Factory function to create the appropriate rebalancer based on configuration
 */
export function createRebalancer(): OpenAIRebalancer | CrestalRebalancer {
  const openaiKey = process.env.OPENAI_API_KEY;
  const crestalKey = process.env.CRESTAL_API_KEY;
  const crestalUrl = process.env.CRESTAL_API_URL || 'https://open.service.crestal.network/v1';

  if (crestalKey && crestalUrl) {
    console.log('Using Crestal IntentKit for AI rebalancing');
    return new CrestalRebalancer(crestalUrl, crestalKey);
  } else if (openaiKey) {
    console.log('Using OpenAI for AI rebalancing');
    return new OpenAIRebalancer(openaiKey);
  } else {
    console.warn('No AI API keys configured, using fallback algorithm');
    return new CrestalRebalancer('', ''); // Will use fallback
  }
}
