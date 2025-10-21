import { NextRequest, NextResponse } from 'next/server';
import { monorailDataClient } from '@/lib/monorail/data-api';
import { type Address } from 'viem';

/**
 * API Route: Discover All Tokens
 * GET /api/portfolio/discover-tokens?address=0x...
 *
 * Fetches ALL available tokens from Monorail Data API for complete swap token list
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    console.log('[TOKEN_DISCOVERY] Fetching all available tokens from Monorail...');

    // First, get ALL tokens available on Monorail DEX
    const allTokens = await monorailDataClient.getAllTokens();
    console.log(`[TOKEN_DISCOVERY] Found ${allTokens.length} total tokens on Monorail`);

    // If address provided, also get user's portfolio to show balances
    let userPortfolio = null;
    if (address) {
      try {
        userPortfolio = await monorailDataClient.getPortfolio(address as Address);
        console.log(`[TOKEN_DISCOVERY] User portfolio has ${userPortfolio.tokens.length} tokens`);
      } catch (error) {
        console.warn('[TOKEN_DISCOVERY] Could not fetch user portfolio:', error);
      }
    }

    // Create a map of user balances for quick lookup
    const userBalances = new Map();
    if (userPortfolio) {
      userPortfolio.tokens.forEach(token => {
        userBalances.set(token.address.toLowerCase(), token);
      });
    }

    // Transform all tokens with user balance info
    const enhancedTokens = allTokens.map((token: any) => {
      const userToken = userBalances.get(token.address?.toLowerCase());
      
      return {
        address: token.address,
        symbol: token.symbol,
        name: token.name || token.symbol,
        decimals: token.decimals || 18,
        balance: userToken?.balance || '0',
        balanceUSD: userToken?.balanceUSD || 0,
        price: parseFloat(token.usd_per_token || '0'),
        logo: token.logo,
        categories: token.categories || [],
        pconf: token.pconf || '100', // Default confidence for listed tokens
        monValue: token.mon_value || '0',
        monPerToken: token.mon_per_token || '0',
        isUserHolding: !!userToken,
      };
    });

    // Sort tokens: user holdings first, then by market cap/liquidity
    const sortedTokens = enhancedTokens.sort((a: any, b: any) => {
      // User holdings first
      if (a.isUserHolding && !b.isUserHolding) return -1;
      if (!a.isUserHolding && b.isUserHolding) return 1;
      
      // Then by USD value for user holdings
      if (a.isUserHolding && b.isUserHolding) {
        return b.balanceUSD - a.balanceUSD;
      }
      
      // For non-holdings, sort by liquidity/market cap approximation
      const aLiquidity = parseFloat(a.monValue) * a.price;
      const bLiquidity = parseFloat(b.monValue) * b.price;
      return bLiquidity - aLiquidity;
    });

    return NextResponse.json({
      success: true,
      address: address || null,
      tokens: sortedTokens,
      totalValueUSD: userPortfolio?.totalValueUSD || 0,
      tokenCount: sortedTokens.length,
      userHoldingsCount: userPortfolio?.tokens.length || 0,
      source: 'monorail-discovery',
    });
  } catch (error: any) {
    console.error('[TOKEN_DISCOVERY] Error:', error);
    
    // Fallback to user portfolio only if all tokens discovery fails
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    
    if (address) {
      try {
        console.log('[TOKEN_DISCOVERY] Falling back to user portfolio only...');
        const portfolio = await monorailDataClient.getPortfolio(address as Address);
        
        return NextResponse.json({
          success: true,
          address,
          tokens: portfolio.tokens,
          totalValueUSD: portfolio.totalValueUSD,
          tokenCount: portfolio.tokens.length,
          userHoldingsCount: portfolio.tokens.length,
          source: 'monorail-portfolio-fallback',
          warning: 'Full token discovery failed, showing user holdings only'
        });
      } catch (fallbackError) {
        console.error('[TOKEN_DISCOVERY] Fallback also failed:', fallbackError);
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to discover tokens',
        details: error.message,
      },
      { status: 500 }
    );
  }
}