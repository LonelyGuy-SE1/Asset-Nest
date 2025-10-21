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
  decimals?: number;
  price?: number;
  name?: string;
  // Monorail-specific data
  pconf?: string;
  categories?: string[];
  logo?: string;
  monValue?: string;
  monPerToken?: string;
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

  constructor() {
    this.apiUrl = process.env.CRESTAL_API_URL || 'https://open.service.crestal.network/v1';
    this.apiKey = process.env.CRESTAL_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[AI] CRESTAL_API_KEY not found in environment variables');
    }
  }

  async computeRebalancingTrades(
    holdings: PortfolioHolding[],
    targets: PortfolioTarget[]
  ): Promise<RebalanceStrategy> {
    console.log('Computing rebalancing trades with Crestal AI Agent...');

    const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    // Determine if we need auto-allocation (no targets provided)
    const isAutoAllocate = !targets || targets.length === 0;

    // Build holdings analysis
    const holdingsAnalysis = holdings.map((h, i) => {
      const balance = parseFloat(h.balance || '0');
      const priceUSD = h.price || (balance > 0 ? h.valueUSD / balance : 0);
      const allocation = totalValue > 0 ? (h.valueUSD / totalValue) * 100 : 0;
      const confidence = parseFloat((h as any).pconf || '0');
      const isFake = (h as any).categories?.includes('fake');
      const isVerified = (h as any).categories?.includes('verified');
      const monLiquidity = parseFloat((h as any).monValue || '0');

      return `Token ${i + 1}: ${h.symbol} (${h.name || 'Unknown'})
- Value: $${h.valueUSD.toFixed(2)} (${allocation.toFixed(1)}% of portfolio)
- Balance: ${balance.toFixed(6)} tokens at $${priceUSD.toFixed(6)}/token
- Contract: ${h.token}
- Price Confidence: ${confidence}% ${confidence >= 97 ? 'HIGH' : confidence >= 50 ? 'MEDIUM' : 'LOW'}
- Status: ${isFake ? 'FAKE TOKEN' : isVerified ? 'VERIFIED' : 'Unverified'}
- Categories: ${(h as any).categories?.join(', ') || 'none'}
- MON Liquidity Pool: ${monLiquidity.toFixed(4)} MON ${monLiquidity < 1 ? 'LOW LIQUIDITY' : 'Good'}
- MON Exchange Rate: ${parseFloat((h as any).monPerToken || '0').toFixed(8)} MON/token`;
    }).join('\n\n');

    // Prepare COMPREHENSIVE detailed prompt with ALL Monorail data
    const prompt = `You are an expert DeFi portfolio rebalancer and risk analyst. Analyze this Monad testnet portfolio.

PORTFOLIO OVERVIEW:
Total Value: $${totalValue.toFixed(2)} USD
Token Count: ${holdings.length} tokens
Blockchain: Monad Testnet (Chain ID: 10143)
DEX: Monorail

CURRENT HOLDINGS - DETAILED ANALYSIS:
${holdingsAnalysis}

${isAutoAllocate ? 'TASK: OPTIMAL AUTO-ALLOCATION' : 'TARGET ALLOCATION'}:
${isAutoAllocate
  ? `Analyze the portfolio and suggest optimal allocation based on:
- Risk/reward analysis of each token
- Liquidity depth and confidence scores
- Market trends and token quality (verified vs unverified)
- Diversification principles
- Elimination of fake/low-quality tokens

Provide recommended percentage allocations for each safe token.`
  : targets.map(t => `${t.symbol}: ${t.targetPercentage}%`).join('\n')
}

ANALYSIS GUIDELINES:
CRITICAL RULES:
1. NEVER trade or recommend FAKE tokens
2. AVOID tokens with confidence < 50%
3. AVOID tokens with liquidity < 1 MON

OPTIMIZATION GOALS:
1. Maximize portfolio stability and diversification
2. Prioritize high-confidence tokens (>=97%)
3. Consider liquidity depth for trade execution
4. Minimize number of trades (reduce gas costs)
5. Balance risk across verified assets

REQUIRED OUTPUT FORMAT (JSON only, no markdown):
{
  "analysis": {
    "riskLevel": "LOW|MEDIUM|HIGH",
    "portfolioHealth": "score 0-100",
    "concerns": ["list any red flags or concerns"],
    "strengths": ["positive aspects of current portfolio"]
  },
  ${isAutoAllocate ? `"recommendedAllocation": [{"symbol": "TOKEN", "targetPercentage": 40, "reason": "why this allocation"}],` : ''}
  "trades": [{"fromToken": "0x...", "toToken": "0x...", "fromSymbol": "SYMBOL", "toSymbol": "SYMBOL", "amount": "123.456", "reason": "detailed reasoning with data points"}],
  "rationale": "comprehensive analysis of portfolio health, trade rationale, risk assessment",
  "estimatedGas": "0.01 ETH"
}`;

    const analysisRequest = {
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3,
    };

    try {
      // Call Crestal AI Agent API for portfolio analysis
      // Reference: https://open.service.crestal.network/v1/redoc
      const response = await axios.post(
        `${this.apiUrl}/chat/completions`,
        {
          messages: [
            {
              role: 'system',
              content: 'You are an expert DeFi portfolio rebalancer specializing in Monad testnet token analysis. Provide JSON-formatted rebalancing strategies.'
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          model: 'gpt-4o-mini',
          max_tokens: 2000,
          temperature: 0.1
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          timeout: 60000, // 60 second timeout for AI analysis
        }
      );

      console.log('Crestal AI analysis completed:', response.data);

      // Parse Crestal response - extract content from completion
      let aiContent = '';
      if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        aiContent = response.data.choices[0].message.content;
      } else if (response.data.content) {
        aiContent = response.data.content;
      } else if (typeof response.data === 'string') {
        aiContent = response.data;
      }

      console.log('AI Response Content:', aiContent);

      // Try to extract JSON from the AI response
      let parsedData: any = {};
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse AI JSON response:', e);
        }
      }

      // Parse into our strategy format
      const strategy: RebalanceStrategy = {
        trades: parsedData.trades || [],
        rationale: parsedData.rationale || 'AI-generated rebalancing strategy based on comprehensive token analysis',
        estimatedGas: parsedData.estimatedGas || '0.01 ETH',
      };

      console.log('Parsed strategy:', strategy);
      return strategy;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Crestal API Error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          endpoint: error.config?.url,
        });
      } else {
        console.error('Error calling Crestal AI:', error);
      }

      // Fallback to simple algorithm when Crestal is unavailable
      console.log('Falling back to built-in rebalancing algorithm...');
      return this.fallbackRebalanceAlgorithm(holdings, targets);
    }
  }

  /**
   * Advanced fallback algorithm if AI APIs are unavailable
   * Considers all Monorail data: confidence, categories, liquidity
   */
  private fallbackRebalanceAlgorithm(
    holdings: PortfolioHolding[],
    targets: PortfolioTarget[]
  ): RebalanceStrategy {
    console.log('Using advanced fallback rebalancing algorithm...');

    const trades: RebalanceTrade[] = [];
    const totalValue = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    // Filter out risky tokens for rebalancing
    const safeHoldings = holdings.filter((h: any) => {
      const isFake = h.categories?.includes('fake');
      const isLowConfidence = parseFloat(h.pconf || '0') < 50;
      const hasLowLiquidity = parseFloat(h.monValue || '0') < 1;
      
      if (isFake) {
        console.warn(`[AI] Skipping FAKE token: ${h.symbol}`);
        return false;
      }
      if (isLowConfidence) {
        console.warn(`[AI] Skipping low confidence token: ${h.symbol} (${h.pconf}%)`);
        return false;
      }
      if (hasLowLiquidity) {
        console.warn(`[AI] Skipping low liquidity token: ${h.symbol} (${h.monValue} MON)`);
        return false;
      }
      return true;
    });

    // Calculate current vs target percentages for safe tokens only
    const rebalanceNeeds = safeHoldings.map((holding) => {
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

  if (crestalKey) {
    console.log('Using Crestal IntentKit for AI rebalancing');
    return new CrestalRebalancer();
  } else if (openaiKey) {
    console.log('Using OpenAI for AI rebalancing');
    return new OpenAIRebalancer(openaiKey);
  } else {
    console.warn('No AI API keys configured, using fallback algorithm');
    return new CrestalRebalancer(); // Will use fallback
  }
}
