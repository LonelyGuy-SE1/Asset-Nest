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
  confidenceScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
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
      "amount": "amount in human-readable format (e.g., 1.5)",
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
    targets: PortfolioTarget[],
    riskAppetite: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<RebalanceStrategy> {
    console.log('Computing rebalancing trades with Crestal AI Agent...');
    console.log('Risk appetite:', riskAppetite);

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
- Portfolio Allocation: ${allocation.toFixed(2)}%
- Balance: ${balance.toFixed(6)} tokens
- Contract: ${h.token}
- Price Confidence: ${confidence}% ${confidence >= 97 ? 'HIGH' : confidence >= 50 ? 'MEDIUM' : 'LOW'}
- Status: ${isFake ? 'FAKE TOKEN' : isVerified ? 'VERIFIED' : 'Unverified'}  
- Categories: ${(h as any).categories?.join(', ') || 'none'}
- MON Liquidity Pool: ${monLiquidity.toFixed(4)} MON ${monLiquidity < 1 ? 'LOW LIQUIDITY' : 'Adequate'}
- MON Exchange Rate: ${parseFloat((h as any).monPerToken || '0').toFixed(8)} MON/token`;
    }).join('\n\n');

    const prompt = `You are a professional DeFi portfolio optimization agent. Conduct a comprehensive analysis of this Monad testnet portfolio and provide precise rebalancing recommendations.

PORTFOLIO COMPOSITION:
Token Count: ${holdings.length} assets
Blockchain: Monad Testnet (Chain ID: 10143)
DEX Protocol: Monorail

DETAILED ASSET ANALYSIS:
${holdingsAnalysis}

${isAutoAllocate ? 'TASK: OPTIMAL AUTO-ALLOCATION' : 'TARGET ALLOCATION'}:
${isAutoAllocate
  ? `Analyze the portfolio and suggest optimal allocation based on:
- Risk/reward analysis of each token
- Liquidity depth and confidence scores
- Market trends and token quality (verified vs unverified)
- Diversification principles
- Portfolio optimization best practices

Provide specific trade recommendations with EXACT amounts.`
  : targets.map(t => `${t.symbol}: ${t.targetPercentage}%`).join('\n')
}

RISK APPETITE: ${riskAppetite.toUpperCase()}
${riskAppetite === 'low' 
  ? '- Conservative approach: Only trade verified tokens with confidence >= 97%\n- Minimize trade frequency and amounts\n- Prefer stable allocations and avoid speculative tokens' 
  : riskAppetite === 'high'
  ? '- Aggressive approach: Consider higher-risk tokens for potential gains\n- Larger trade amounts acceptable\n- More frequent rebalancing for optimization'
  : '- Balanced approach: Mix of verified and promising tokens\n- Moderate trade sizes\n- Standard rebalancing thresholds'
}

TRADING PARAMETERS:
1. **PRECISE AMOUNTS**: Specify exact token quantities (e.g., "1.5", "0.0025", "100") - no percentages
2. **TOKEN-BASED ANALYSIS**: Focus on token balances, allocations, and exchange rates
3. **THRESHOLD-AGNOSTIC**: Consider any trade that enhances portfolio optimization (adjusted for risk appetite)
4. **CONTRACT PRECISION**: Use exact token contract addresses from asset inventory
5. **BALANCE CONSTRAINTS**: Ensure proposed amounts remain within available token balances
6. **RISK ALIGNMENT**: Align trade recommendations with ${riskAppetite} risk appetite

ANALYSIS GUIDELINES:
SAFETY RULES:
1. NEVER trade or recommend FAKE tokens
2. Prioritize tokens with confidence >= 97% (HIGH confidence)
3. Consider liquidity depth for trade execution
4. Balance risk across verified assets

OPTIMIZATION GOALS:
1. Maximize portfolio stability and diversification
2. Improve allocation balance with precise amounts
3. Consider all available tokens for potential trades
4. Make strategic decisions based on token quality and market data

CRITICAL REQUIREMENTS:
1. **EXACT TOKEN AMOUNTS**: Provide precise decimal numbers (e.g., "1.5", "0.0025", "100.0") - no percentages
2. **BALANCE VALIDATION**: NEVER exceed available token balances - check each token's balance before suggesting trades
3. **CONFIDENCE SCORE**: Rate your analysis confidence (1-100) based on data quality and market conditions  
4. **RISK ASSESSMENT**: Classify portfolio risk level as "Low", "Medium", or "High"
5. **REALISTIC AMOUNTS**: Ensure amounts don't exceed available balances (leave small buffer for gas/fees)
6. **PRECISION**: Round to appropriate decimal places (6 decimals max)
7. **BALANCE CHECK**: For each trade, verify: amount <= available_balance * 0.95 (5% buffer)

REQUIRED JSON FORMAT (NO MARKDOWN, NO CODE BLOCKS):
{
  "trades": [
    {
      "fromToken": "0xcontract_address",
      "toToken": "0xcontract_address", 
      "fromSymbol": "TOKEN1",
      "toSymbol": "TOKEN2",
      "amount": "1.5",
      "reason": "Specific explanation for this exact trade amount"
    }
  ],
  "rationale": "Detailed analysis explaining portfolio health, risks, and strategic reasoning for these exact trades",
  "confidenceScore": 85,
  "riskLevel": "Medium",
  "estimatedGas": "0.02 MON"
}

MAKE STRATEGIC TRADES WITH EXACT AMOUNTS TO OPTIMIZE THE PORTFOLIO.`;

    const analysisRequest = {
      prompt: prompt,
      maxTokens: 2000,
      temperature: 0.3,
    };

    try {
      // Call Crestal AI Agent API for portfolio analysis
      // Reference: Based on popup.js - Crestal uses a chat-based API

      // Step 1: Create a chat thread
      console.log('[CRESTAL] Creating chat thread...');
      const chatResponse = await axios.post(
        `${this.apiUrl}/chats`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      const chatId = chatResponse.data.id;
      console.log('[CRESTAL] Chat thread created:', chatId);

      // Step 2: Send the analysis prompt as a message
      console.log('[CRESTAL] Sending portfolio analysis request...');
      const messageResponse = await axios.post(
        `${this.apiUrl}/chats/${chatId}/messages`,
        {
          message: prompt,
          stream: false, // Non-streaming for simpler parsing
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 second timeout for AI analysis
        }
      );

      console.log('[CRESTAL] AI analysis completed');

      // Parse Crestal response - it returns an array: [{ "message": "actual AI response" }]
      let aiContent = '';

      if (Array.isArray(messageResponse.data) && messageResponse.data.length > 0) {
        // Crestal returns array format
        aiContent = messageResponse.data[0].message || '';
        console.log('[CRESTAL] Extracted message from array response');
      } else if (messageResponse.data.message) {
        aiContent = messageResponse.data.message;
      } else if (messageResponse.data.content) {
        aiContent = messageResponse.data.content;
      } else if (typeof messageResponse.data === 'string') {
        aiContent = messageResponse.data;
      }

      console.log('[CRESTAL] AI Response Content (first 500 chars):', aiContent.substring(0, 500));

      // Try to extract JSON from the AI response - handle markdown code blocks
      let parsedData: any = {};

      // Remove markdown code blocks if present
      let cleanContent = aiContent.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
      }

      // Extract JSON
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
          console.log('[CRESTAL] Successfully parsed JSON from AI response');
          console.log('[CRESTAL] Parsed trades count:', parsedData.trades?.length || 0);
        } catch (e) {
          console.error('[CRESTAL] Failed to parse AI JSON response:', e);
          console.log('[CRESTAL] JSON match was:', jsonMatch[0].substring(0, 200));
        }
      } else {
        console.error('[CRESTAL] No JSON found in AI response');
      }

      // Parse into our strategy format - ALWAYS show AI agent's analysis!
      const strategy: RebalanceStrategy = {
        trades: parsedData.trades || [],
        rationale: parsedData.rationale || aiContent || 'AI-generated rebalancing strategy',
        confidenceScore: parsedData.confidenceScore || 80,
        riskLevel: parsedData.riskLevel || 'Medium',
        estimatedGas: parsedData.estimatedGas || '0.001 MON',
      };

      console.log('[CRESTAL] Final strategy:', {
        tradesCount: strategy.trades.length,
        rationaleLength: strategy.rationale.length,
        rationalePreview: strategy.rationale.substring(0, 200),
      });

      return strategy;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[CRESTAL] API Error:', {
          status: error.response?.status,
          message: error.response?.data?.message || error.message,
          endpoint: error.config?.url,
          fullResponse: error.response?.data,
        });
      } else {
        console.error('[CRESTAL] Error calling Crestal AI:', error);
      }

      // NO FALLBACK - throw error so user sees what went wrong
      throw new Error(`Crestal AI API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * REMOVED FALLBACK - Crestal AI must work or fail visibly
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
      confidenceScore: 75,
      riskLevel: 'Medium' as const,
      estimatedGas: '0.001 MON',
    };
  }
}

/**
 * Factory function to create Crestal rebalancer - NO FALLBACKS!
 */
export function createRebalancer(): CrestalRebalancer {
  const crestalKey = process.env.CRESTAL_API_KEY;

  if (!crestalKey) {
    throw new Error('CRESTAL_API_KEY not configured in environment variables');
  }

  console.log('[AI] Using Crestal AI for portfolio rebalancing');
  return new CrestalRebalancer();
}
