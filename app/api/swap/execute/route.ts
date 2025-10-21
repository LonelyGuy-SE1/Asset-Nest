import { NextRequest, NextResponse } from 'next/server';
import { monorailClient } from '@/lib/monorail/swap';
import { type Address } from 'viem';

/**
 * API Route: Execute Manual Swap
 * POST /api/swap/execute
 *
 * Executes a single token swap via Monorail
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromToken, toToken, amount, fromAddress, slippage } = body;

    if (!fromToken || !toToken || !amount || !fromAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters: fromToken, toToken, amount, fromAddress' },
        { status: 400 }
      );
    }

    console.log('Executing swap:', {
      from: fromToken,
      to: toToken,
      amount,
      slippage: slippage || '0.5',
    });

    // Get quote from Monorail (slippage handled separately)
    const quote = await monorailClient.getQuote({
      from: fromToken as Address,
      to: toToken as Address,
      amount,
      // Note: slippage is not part of Monorail quote API based on their docs
    });

    console.log('Swap quote received:', quote);

    // Prepare the swap transaction
    const swapTransaction = monorailClient.prepareSwapTransaction(quote);
    
    console.log('Swap transaction prepared:', swapTransaction);

    // Convert BigInt values to strings for JSON serialization
    const serializedTransaction = {
      to: swapTransaction.to,
      data: swapTransaction.data,
      value: swapTransaction.value.toString(),
    };

    return NextResponse.json({
      success: true,
      transaction: serializedTransaction,
      fromAmount: amount,
      toAmount: quote.toAmount,
      quote: {
        ...quote,
        // Ensure no BigInt values in quote
        transaction: {
          ...quote.transaction,
          value: quote.transaction.value || '0',
        }
      },
    });
  } catch (error: any) {
    console.error('Swap execution error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute swap',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
