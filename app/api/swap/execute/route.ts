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

    // Monorail expects human-readable amounts (e.g., "1.5" not wei)
    console.log('Executing swap:', {
      from: fromToken,
      to: toToken,
      amount: amount, // Keep as human-readable
      slippage: slippage || '0.5',
    });

    // Use MINIMAL parameters - only sender for executable transaction
    // Extra parameters might be causing different (failing) transaction data
    const quote = await monorailClient.getQuote({
      from: fromToken as Address,
      to: toToken as Address,
      amount: amount, // Use human-readable amount
      sender: fromAddress as Address, // Only required parameter for executable transaction
      // Let Monorail handle defaults for slippage, deadline, destination
    });

    console.log('Swap quote received:', quote);

    // DEBUG: Check the exact value from Monorail
    console.log('DEBUG - Transaction value analysis:', {
      hasValue: quote.transaction.hasOwnProperty('value'),
      value: quote.transaction.value,
      valueType: typeof quote.transaction.value,
      isFalsy: !quote.transaction.value,
      isEmptyString: quote.transaction.value === '',
      isNull: quote.transaction.value === null,
      isUndefined: quote.transaction.value === undefined,
      fallbackTriggers: !quote.transaction.value ? 'YES - THIS IS THE BUG' : 'NO'
    });

    // Use transaction data directly from Monorail quote
    console.log('Transaction from Monorail:', {
      to: quote.transaction.to,
      dataLength: quote.transaction.data.length,
      value: quote.transaction.value,
      gasLimit: quote.estimatedGas,
    });

    // Convert values for JSON serialization
    const serializedTransaction = {
      to: quote.transaction.to,
      data: quote.transaction.data,
      value: quote.transaction.value || '0',
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
