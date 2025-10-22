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
    const sender = searchParams.get('sender'); // Optional sender for complete transaction data
    const slippage = searchParams.get('slippage');
    if (!fromToken || !toToken || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromToken, toToken, amount' },
        { status: 400 }
      );
    }

    // Monorail expects human-readable amounts (e.g., "1.5" not wei)
    console.log('Getting swap quote:', {
      from: fromToken,
      to: toToken,
      amount: amount, // Keep as human-readable
      sender,
      slippage,
    });

    // Use MINIMAL parameters for quote - let Monorail handle defaults
    const quote = await monorailClient.getQuote({
      from: fromToken as Address,
      to: toToken as Address,
      amount: amount, // Use human-readable amount
      sender: sender as Address, // Include sender for complete transaction data if provided
      // Let Monorail handle defaults for slippage, deadline, destination
    });

    console.log('[QUOTE API] Quote received from Monorail client:', {
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      fromAmountType: typeof quote.fromAmount,
      toAmountType: typeof quote.toAmount,
    });

    const exchangeRate = parseFloat(quote.toAmount) / parseFloat(quote.fromAmount);

    console.log('[QUOTE API] Calculated exchange rate:', {
      toAmountFloat: parseFloat(quote.toAmount),
      fromAmountFloat: parseFloat(quote.fromAmount),
      exchangeRate,
    });

    return NextResponse.json({
      success: true,
      quote,
      fromAmount: quote.fromAmount,
      toAmount: quote.toAmount,
      exchangeRate,
      priceImpact: `${quote.priceImpact}%`,
      estimatedGas: quote.estimatedGas,
      hasTransactionData: !!(quote.transaction.to &&
                            quote.transaction.data &&
                            quote.transaction.data !== '0x'),
      hasSender: !!sender,
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
