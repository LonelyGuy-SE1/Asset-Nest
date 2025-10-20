import { NextRequest, NextResponse } from 'next/server';
import { publicClient } from '@/lib/config/viem-clients';
import { MONAD_TOKENS, TOKEN_METADATA } from '@/lib/config/monad-chain';
import { monorailClient } from '@/lib/monorail/swap';
import { monorailDataClient } from '@/lib/monorail/data-api';
import { type Address } from 'viem';
import { erc20Abi } from 'viem';

/**
 * API Route: Get Portfolio Balances
 * GET /api/portfolio/balances?address=0x...&source=monorail
 *
 * Fetches token balances for a smart account on Monad
 * Can use either direct RPC calls or Monorail Data API
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');
    const source = searchParams.get('source') || 'rpc'; // 'rpc' or 'monorail'

    if (!address) {
      return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
    }

    console.log('Fetching portfolio balances for:', address, 'using source:', source);

    // Try Monorail Data API first if specified or as fallback
    if (source === 'monorail') {
      try {
        const monorailPortfolio = await monorailDataClient.getPortfolio(address as Address);

        if (monorailPortfolio.tokens.length > 0) {
          console.log('Using Monorail Data API for portfolio');

          const holdingsWithPercentages = monorailPortfolio.tokens.map((token) => ({
            token: token.address,
            symbol: token.symbol,
            balance: token.balance,
            decimals: token.decimals,
            valueUSD: token.balanceUSD,
            percentage:
              monorailPortfolio.totalValueUSD > 0
                ? (token.balanceUSD / monorailPortfolio.totalValueUSD) * 100
                : 0,
          }));

          return NextResponse.json({
            success: true,
            address,
            holdings: holdingsWithPercentages,
            totalValueUSD: monorailPortfolio.totalValueUSD,
            source: 'monorail',
          });
        }
      } catch (monorailError) {
        console.warn('Monorail Data API failed, falling back to RPC:', monorailError);
      }
    }

    console.log('Fetching portfolio balances via RPC for:', address);

    // Get native MON balance
    const monBalance = await publicClient.getBalance({
      address: address as Address,
    });

    console.log('MON balance:', monBalance.toString());

    // Get ERC20 token balances
    const tokenAddresses = [MONAD_TOKENS.USDC, MONAD_TOKENS.USDT, MONAD_TOKENS.WETH];

    const tokenBalances = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        try {
          const balance = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Address],
          });

          return {
            token: tokenAddress,
            balance: balance.toString(),
          };
        } catch (error) {
          console.error(`Error fetching balance for ${tokenAddress}:`, error);
          return {
            token: tokenAddress,
            balance: '0',
          };
        }
      })
    );

    // Get token prices
    const prices = await Promise.all([
      monorailClient.getTokenPrice(MONAD_TOKENS.MON as Address),
      monorailClient.getTokenPrice(MONAD_TOKENS.USDC as Address),
      monorailClient.getTokenPrice(MONAD_TOKENS.USDT as Address),
      monorailClient.getTokenPrice(MONAD_TOKENS.WETH as Address),
    ]);

    // Format balances with metadata and USD values
    const holdings = [
      {
        token: MONAD_TOKENS.MON,
        symbol: 'MON',
        balance: monBalance.toString(),
        decimals: 18,
        valueUSD:
          (Number(monBalance) / 10 ** 18) *
          prices[0],
      },
      ...tokenBalances.map((tb, index) => {
        const metadata = TOKEN_METADATA[tb.token];
        const decimals = metadata?.decimals || 18;
        return {
          token: tb.token,
          symbol: metadata?.symbol || 'UNKNOWN',
          balance: tb.balance,
          decimals,
          valueUSD:
            (Number(tb.balance) / 10 ** decimals) *
            prices[index + 1],
        };
      }),
    ];

    // Calculate total portfolio value
    const totalValueUSD = holdings.reduce((sum, h) => sum + h.valueUSD, 0);

    // Calculate percentages
    const holdingsWithPercentages = holdings.map((h) => ({
      ...h,
      percentage: totalValueUSD > 0 ? (h.valueUSD / totalValueUSD) * 100 : 0,
    }));

    console.log('Portfolio fetched:', holdingsWithPercentages);

    return NextResponse.json({
      success: true,
      address,
      holdings: holdingsWithPercentages,
      totalValueUSD,
      source: 'rpc',
    });
  } catch (error: any) {
    console.error('Error fetching portfolio balances:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch portfolio balances',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
