import { NextRequest, NextResponse } from 'next/server';
import { createRebalancer, type PortfolioHolding, type PortfolioTarget } from '@/lib/ai/rebalancer';

/**
 * API Route: Compute Rebalancing Strategy
 * POST /api/rebalance/strategy
 *
 * Uses AI to compute optimal rebalancing trades for a portfolio
 * Reference: https://open.service.crestal.network/v1/redoc
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { holdings, targets, autoAllocate, riskAppetite } = body;

    if (!holdings) {
      return NextResponse.json(
        { error: 'Missing holdings' },
        { status: 400 }
      );
    }

    console.log('Computing rebalancing strategy via API...');
    console.log('Holdings:', holdings);
    console.log('Auto-allocate mode:', autoAllocate);
    console.log('Targets:', targets);

    // Validate holdings with full Monorail data
    const validatedHoldings: PortfolioHolding[] = holdings.map((h: any) => ({
      token: h.token,
      symbol: h.symbol,
      balance: h.balance,
      valueUSD: parseFloat(h.valueUSD),
      // Include Monorail-specific data
      pconf: h.pconf,
      categories: h.categories || [],
      logo: h.logo,
      monValue: h.monValue,
      monPerToken: h.monPerToken,
      price: h.price,
      decimals: h.decimals,
      name: h.name,
    }));

    // If auto-allocate, let AI decide targets; otherwise validate provided targets
    let validatedTargets: PortfolioTarget[] = [];

    if (!autoAllocate && targets) {
      validatedTargets = targets.map((t: any) => ({
        symbol: t.symbol,
        targetPercentage: parseFloat(t.targetPercentage),
      }));

      // Check that targets sum to 100%
      const targetSum = validatedTargets.reduce((sum, t) => sum + t.targetPercentage, 0);
      if (Math.abs(targetSum - 100) > 0.1) {
        return NextResponse.json(
          { error: `Target percentages must sum to 100%, got ${targetSum}%` },
          { status: 400 }
        );
      }
    }

    // Create AI rebalancer
    const rebalancer = createRebalancer();

    // Compute rebalancing strategy (AI will auto-allocate if no targets)
    const strategy = await rebalancer.computeRebalancingTrades(
      validatedHoldings,
      validatedTargets, // Empty array if autoAllocate = true
      riskAppetite || 'medium' // Default to medium risk
    );

    console.log('Rebalancing strategy computed:', strategy);

    return NextResponse.json({
      success: true,
      strategy,
      tradesCount: strategy.trades.length,
    });
  } catch (error: any) {
    console.error('Error computing rebalancing strategy:', error);
    return NextResponse.json(
      {
        error: 'Failed to compute rebalancing strategy',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
