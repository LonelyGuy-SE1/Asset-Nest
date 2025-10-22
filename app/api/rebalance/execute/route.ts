import { NextRequest, NextResponse } from 'next/server';
import { executeDelegatedTrades } from '@/lib/smart-account/delegation';
import { type RebalanceTrade } from '@/lib/ai/rebalancer';
import { type Address, type Hex } from 'viem';

/**
 * API Route: Execute Rebalancing Trades via Smart Account Delegation
 * POST /api/rebalance/execute
 *
 * Executes rebalancing trades using MetaMask Smart Account with proper delegation
 * and Pimlico bundler for gasless transactions
 * 
 * Reference: https://testnet-preview.monorail.xyz/developers/documentation
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/send-gasless-transaction/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      trades, 
      smartAccountAddress, 
      delegatePrivateKey,
      executionMode = 'batch' // 'batch' or 'individual'
    } = body;

    // Validation
    if (!trades || !Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty trades array' },
        { status: 400 }
      );
    }

    if (!smartAccountAddress) {
      return NextResponse.json(
        { error: 'Missing smartAccountAddress' },
        { status: 400 }
      );
    }

    if (!delegatePrivateKey) {
      return NextResponse.json(
        { error: 'Missing delegatePrivateKey for agent execution' },
        { status: 400 }
      );
    }

    console.log('🚀 Executing rebalancing trades via smart account delegation...');
    console.log('Smart Account Address:', smartAccountAddress);
    console.log('Number of trades:', trades.length);
    console.log('Execution mode:', executionMode);

    // Log trade details
    trades.forEach((trade: RebalanceTrade, index: number) => {
      console.log(`Trade ${index + 1}: ${trade.amount} ${trade.fromSymbol} → ${trade.toSymbol}`);
      console.log(`  Reason: ${trade.reason}`);
    });

    // Execute trades via smart account delegation
    console.log('⚡ Starting delegation-based execution...');
    
    const result = await executeDelegatedTrades(
      trades,
      smartAccountAddress as Address,
      delegatePrivateKey as Hex
    );

    if (result.success) {
      console.log('✅ Rebalancing trades executed successfully!');
      console.log('User Operation Hash:', result.userOpHash);
      console.log('Transaction Hash:', result.transactionHash);

      return NextResponse.json({
        success: true,
        message: 'Rebalancing trades executed successfully via smart account',
        userOpHash: result.userOpHash,
        transactionHash: result.transactionHash,
        tradesCount: trades.length,
        smartAccountAddress,
        executionTimestamp: new Date().toISOString(),
      });
    } else {
      throw new Error('Delegation execution failed without specific error');
    }

  } catch (error: any) {
    console.error('❌ Error executing rebalancing trades:', error);
    
    // Provide user-friendly error messages based on error type
    let userMessage = 'Failed to execute rebalancing trades';
    let statusCode = 500;

    if (error.message?.includes('insufficient funds')) {
      userMessage = 'Smart account has insufficient funds. Please ensure it has enough MON tokens for gas fees.';
      statusCode = 400;
    } else if (error.message?.includes('bundler')) {
      userMessage = 'Bundler service error. Please check your Pimlico API configuration.';
      statusCode = 503;
    } else if (error.message?.includes('execution reverted')) {
      userMessage = 'Trade execution failed. This may be due to insufficient token balance or slippage.';
      statusCode = 400;
    } else if (error.message?.includes('delegation')) {
      userMessage = 'Delegation error. Please ensure the smart account is properly set up for delegation.';
      statusCode = 400;
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
        details: error.message,
        code: error.code || 'EXECUTION_FAILED',
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}
