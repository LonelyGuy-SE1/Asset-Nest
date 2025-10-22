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

    // Always try Monorail Data API FIRST - it auto-discovers ALL tokens
    try {
      console.log('Attempting to fetch all tokens via Monorail Data API...');
      const monorailPortfolio = await monorailDataClient.getPortfolio(address as Address);

      if (monorailPortfolio.tokens && monorailPortfolio.tokens.length > 0) {
        console.log(`[PORTFOLIO] Monorail found ${monorailPortfolio.tokens.length} tokens with balances`);
        
        // Debug: Log first token's data structure
        console.log('First token data structure:', JSON.stringify(monorailPortfolio.tokens[0], null, 2));

        const holdingsWithPercentages = monorailPortfolio.tokens.map((token) => {
          console.log(`[PORTFOLIO] Token ${token.symbol}:`, {
            address: token.address,
            balance: token.balance,
            balanceUSD: token.balanceUSD,
            price: token.price,
            logo: token.logo,
            pconf: token.pconf,
            categories: token.categories,
          });

          return {
            token: token.address,
            symbol: token.symbol,
            name: token.name,
            balance: token.balance,
            decimals: parseInt(token.decimals.toString()),
            valueUSD: token.balanceUSD,
            price: token.price,
            logo: token.logo || undefined,
            categories: token.categories || [],
            pconf: token.pconf || '0',
            monValue: token.monValue || '0',
            monPerToken: token.monPerToken || '0',
            percentage:
              monorailPortfolio.totalValueUSD > 0
                ? (token.balanceUSD / monorailPortfolio.totalValueUSD) * 100
                : 0,
          };
        });

        console.log('Tokens found:', holdingsWithPercentages.map(h => `${h.symbol}: ${h.balance}`));

        return NextResponse.json({
          success: true,
          address,
          holdings: holdingsWithPercentages,
          totalValueUSD: monorailPortfolio.totalValueUSD,
          source: 'monorail',
          tokenCount: holdingsWithPercentages.length,
        });
      } else {
        console.log('[PORTFOLIO] Monorail returned empty portfolio, trying RPC fallback...');
      }
    } catch (monorailError) {
      console.warn('[PORTFOLIO] Monorail Data API failed, falling back to RPC:', monorailError);
    }

    console.log('Fetching portfolio balances via RPC for:', address);

    // Get native MON balance
    const monBalance = await publicClient.getBalance({
      address: address as Address,
    });

    console.log('MON balance:', monBalance.toString());

    // Extended list of potential token addresses on Monad Testnet
    // You should update this with actual token addresses from your wallet
    const knownTokenAddresses = [
      MONAD_TOKENS.USDC,
      MONAD_TOKENS.USDT, 
      MONAD_TOKENS.WETH,
      // Add more token addresses here that you actually hold
      '0x4200000000000000000000000000000000000006', // Common WETH address pattern
      '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Common USDC address pattern
      '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // Common USDT address pattern
      // You can add more specific addresses here
    ];

    console.log('Checking balances for', knownTokenAddresses.length, 'tokens...');

    const tokenBalances = await Promise.all(
      knownTokenAddresses.map(async (tokenAddress) => {
        try {
          // Skip invalid addresses (placeholders)
          if (tokenAddress.includes('0x000000000000000000000000000000000000000')) {
            return null;
          }

          const balance = await publicClient.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [address as Address],
          });

          // Only return if balance > 0
          if (balance > 0n) {
            console.log(`Found balance for ${tokenAddress}: ${balance.toString()}`);
            return {
              token: tokenAddress,
              balance: balance.toString(),
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching balance for ${tokenAddress}:`, error);
          return null;
        }
      })
    );

    // Filter out null results (zero balances or errors)
    const validTokenBalances = tokenBalances.filter(Boolean) as Array<{
      token: string;
      balance: string;
    }>;

    // TODO: Implement price fetching via Monorail or external API
    // For now, using mock prices for demo purposes
    const prices = [1.0, 1.0, 1.0, 2500.0]; // MON, USDC, USDT, WETH mock prices

    // Helper function to safely handle large numbers
    const calculateValueUSD = (balance: string, decimals: number, price: number): number => {
      try {
        if (balance === '0' || !balance) return 0;
        
        // Use BigInt for precision but cap extremely large values
        const balanceBigInt = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        
        // Check if the balance is impossibly large (likely test data)
        const maxReasonableBalance = BigInt('1000000000000000000000000'); // 1M tokens max
        if (balanceBigInt > maxReasonableBalance) {
          console.warn(`Capping extremely large balance ${balance} to reasonable amount`);
          const cappedAmount = Number(maxReasonableBalance) / Number(divisor);
          return cappedAmount * price;
        }
        
        // Convert to actual token amount using string division for precision
        const balanceStr = balanceBigInt.toString();
        let tokenAmount: number;
        
        if (balanceStr.length <= decimals) {
          // Small balance - less than 1 token
          tokenAmount = Number(balanceBigInt) / Number(divisor);
        } else {
          // Large balance - use string manipulation to avoid scientific notation
          const integerPart = balanceStr.slice(0, balanceStr.length - decimals);
          const decimalPart = balanceStr.slice(balanceStr.length - decimals);
          const tokenAmountStr = integerPart + '.' + decimalPart.slice(0, 6); // Limit decimal precision
          tokenAmount = parseFloat(tokenAmountStr);
        }
        
        // Simple calculation: token amount * price
        const valueUSD = tokenAmount * price;
        
        // Handle overflow/invalid results
        if (!isFinite(valueUSD) || isNaN(valueUSD) || valueUSD > 1e12) {
          console.warn(`Capping large USD value for balance ${balance}: ${valueUSD} -> 1000000`);
          return 1000000; // Cap at $1M for display
        }
        
        return valueUSD;
      } catch (error) {
        console.error(`Error calculating USD value for balance ${balance}:`, error);
        return 0;
      }
    };

    // Format balances with metadata and USD values
    const holdings = [
      {
        token: MONAD_TOKENS.MON,
        symbol: 'MON',
        balance: monBalance.toString(),
        decimals: 18,
        valueUSD: calculateValueUSD(monBalance.toString(), 18, prices[0]),
      },
      ...validTokenBalances.map((tb, index) => {
        const metadata = TOKEN_METADATA[tb.token];
        const decimals = metadata?.decimals || 18;
        // For unknown tokens, try to fetch metadata dynamically
        const symbol = metadata?.symbol || `TOKEN_${tb.token.slice(0, 6)}`;
        return {
          token: tb.token,
          symbol,
          balance: tb.balance,
          decimals,
          valueUSD: calculateValueUSD(tb.balance, decimals, index < prices.length - 1 ? prices[index + 1] : 1),
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
