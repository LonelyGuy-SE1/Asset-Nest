import { NextRequest, NextResponse } from 'next/server';
import { monorailClient } from '@/lib/monorail/swap';
import { type Address } from 'viem';

/**
 * API Route: Get Swap Quote
 * GET /api/swap/quote?fromToken=0x...&toToken=0x...&amount=1000
 *
 * Gets a swap quote from Monorail for pricing information
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fromToken = searchParams.get('fromToken');
    const toToken = searchParams.get('toToken');
    const amount = searchParams.get('amount');
    const slippage = searchParams.get('slippage');

    if (!fromToken || !toToken || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromToken, toToken, amount' },
        { status: 400 }
      );
    }

    console.log('Getting swap quote:', {
      from: fromToken,
      to: toToken,
      amount,
      slippage,
    });

    // Get quote from Monorail (slippage not used in quote, only in execution)
    const quote = await monorailClient.getQuote({
      from: fromToken as Address,
      to: toToken as Address,
      amount,
      // slippage is handled during execution, not quoting
    });

    console.log('Quote received:', quote);

    return NextResponse.json({
      success: true,
      quote,
      fromAmount: amount,
      toAmount: quote.toAmount,
      exchangeRate: parseFloat(quote.toAmount) / parseFloat(amount),
      priceImpact: quote.priceImpact || '< 0.1%',
      estimatedGas: quote.estimatedGas || '0.001 ETH',
    });
  } catch (error: any) {
    console.error('Quote error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get swap quote',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
