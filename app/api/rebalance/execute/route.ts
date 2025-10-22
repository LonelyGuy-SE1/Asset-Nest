import { NextRequest, NextResponse } from 'next/server';
import { monorailClient, type MonorailQuoteParams } from '@/lib/monorail/swap';
import { bundlerClient } from '@/lib/config/viem-clients';
import { createMetaMaskSmartAccount } from '@/lib/smart-account/create-account';
import { type RebalanceTrade } from '@/lib/ai/rebalancer';
import { type Address, type Hex } from 'viem';
import { toWei } from '@/lib/utils/monorail-utils';

/**
 * API Route: Execute Rebalancing Trades
 * POST /api/rebalance/execute
 *
 * Executes the rebalancing trades using Monorail swap API and MetaMask Smart Account
 * Reference: https://testnet-preview.monorail.xyz/developers/documentation
 * Reference: https://docs.metamask.io/delegation-toolkit/guides/smart-accounts/send-gasless-transaction/
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trades, smartAccountPrivateKey } = body;

    if (!trades || !smartAccountPrivateKey) {
      return NextResponse.json(
        { error: 'Missing trades or smartAccountPrivateKey' },
        { status: 400 }
      );
    }

    console.log('Executing rebalancing trades via API...');
    console.log('Number of trades:', trades.length);

    // Create smart account
    const { smartAccount } = await createMetaMaskSmartAccount(smartAccountPrivateKey as Hex);

    console.log('Smart account:', smartAccount.address);

    // Get quotes for all trades (slippage handled during execution)
    const quotePromises = trades.map((trade: RebalanceTrade) => {
      // Monorail expects amounts in WEI format (based on test-monorail-api.js)
      // The AI rebalancer provides amounts in human-readable format, so we need to convert to WEI
      // TODO: Get decimals from token metadata instead of assuming 18
      const decimals = 18; // Most tokens use 18 decimals
      const amountInWei = toWei(trade.amount, decimals);

      console.log(`Converting ${trade.amount} ${trade.fromSymbol} to WEI: ${amountInWei}`);
      console.log(`Getting quote from ${trade.fromToken} to ${trade.toToken}`);

      const quoteParams: MonorailQuoteParams = {
        from: trade.fromToken as Address,
        to: trade.toToken as Address,
        amount: amountInWei, // Convert to WEI format - Monorail expects this
        sender: smartAccount.address, // Add sender for complete transaction data
        // slippage not used in Monorail quote API
      };
      return monorailClient.getQuote(quoteParams);
    });

    const quotes = await Promise.all(quotePromises);
    console.log('All quotes fetched:', quotes.length);

    // Prepare swap transactions
    const swapCalls = quotes.map((quote) => {
      const swapTx = monorailClient.prepareSwapTransaction(quote);
      return {
        to: swapTx.to,
        data: swapTx.data,
        value: swapTx.value,
      };
    });

    console.log('Prepared swap calls:', swapCalls.length);

    // Send user operation with all swap calls batched
    console.log('Sending user operation...');

    const userOpHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: swapCalls,
    });

    console.log('User operation sent:', userOpHash);

    // Wait for user operation receipt
    console.log('Waiting for user operation receipt...');
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    console.log('User operation confirmed:', receipt);

    return NextResponse.json({
      success: true,
      userOpHash,
      receipt,
      tradesExecuted: trades.length,
      message: 'Rebalancing trades executed successfully',
    });
  } catch (error: any) {
    console.error('Error executing rebalancing trades:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute rebalancing trades',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
