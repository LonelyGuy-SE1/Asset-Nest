/**
 * Envio Event Handler for Swap Events (Monorail)
 * Reference: https://docs.envio.dev/docs/HyperIndex/tutorial-op-bridge-deposits
 */

import { Trade, SmartAccount } from '../generated/schema';
import { updateGlobalStats } from './smartAccountHandler';

/**
 * Handler for Swap event from Monorail Router
 * Triggered when a swap is executed
 */
export async function handleSwap(event: any, context: any) {
  const { sender, recipient, tokenIn, tokenOut, amountIn, amountOut } = event.params;
  const { timestamp, transactionHash, blockNumber, logIndex } = event;

  console.log('Processing Swap event:', transactionHash);

  // Check if sender is a smart account
  const smartAccount = await context.SmartAccount.get(sender.toLowerCase());

  if (!smartAccount) {
    console.log('Swap not from tracked smart account, skipping:', sender);
    return;
  }

  // Create unique ID for trade
  const tradeId = `${transactionHash}-${logIndex}`;

  // Calculate value in USD (simplified - in production, use price oracles)
  const amountInDecimal = parseFloat(amountIn.toString()) / 1e18;
  const amountOutDecimal = parseFloat(amountOut.toString()) / 1e18;

  // Mock price calculation (replace with actual price feed)
  const tokenInPriceUSD = getTokenPriceUSD(tokenIn);
  const tokenOutPriceUSD = getTokenPriceUSD(tokenOut);

  const tradeValueUSD = amountInDecimal * tokenInPriceUSD;

  // Create Trade entity
  const trade = new Trade({
    id: tradeId,
    smartAccount,
    smartAccountAddress: sender.toLowerCase(),
    sender: sender.toLowerCase(),
    recipient: recipient.toLowerCase(),
    tokenIn: tokenIn.toLowerCase(),
    tokenOut: tokenOut.toLowerCase(),
    amountIn: amountInDecimal,
    amountOut: amountOutDecimal,
    priceImpact: 0, // Calculate based on reserves if available
    executedAt: BigInt(timestamp),
    txHash: transactionHash,
    blockNumber: BigInt(blockNumber),
  });

  await context.Trade.set(trade);

  // Update smart account stats
  smartAccount.totalTrades += 1;
  smartAccount.totalVolume += tradeValueUSD;
  await context.SmartAccount.set(smartAccount);

  // Update global stats
  await updateGlobalStats(context, {
    incrementTrades: 1,
    addVolume: tradeValueUSD,
    timestamp,
  });

  console.log('Trade indexed:', tradeId);
}

/**
 * Helper function to get token price in USD
 * In production, integrate with price oracle or Monorail price API
 */
function getTokenPriceUSD(tokenAddress: string): number {
  // Mock prices for testnet tokens
  const prices: Record<string, number> = {
    '0x0000000000000000000000000000000000000000': 1000, // MON = $1000
    '0x0000000000000000000000000000000000000001': 1, // USDC = $1
    '0x0000000000000000000000000000000000000002': 1, // USDT = $1
    '0x0000000000000000000000000000000000000003': 2500, // WETH = $2500
  };

  return prices[tokenAddress.toLowerCase()] || 1;
}

/**
 * Handler for batch swaps (if supported by Monorail)
 * Can be used to track rebalancing events that execute multiple swaps
 */
export async function handleBatchSwap(event: any, context: any) {
  // Implementation for batch swap events
  // This would create a RebalancingEvent entity
  console.log('Processing BatchSwap event');

  const { sender, swaps, timestamp } = event.params;
  const { transactionHash } = event;

  // Check if sender is a smart account
  const smartAccount = await context.SmartAccount.get(sender.toLowerCase());

  if (!smartAccount) {
    console.log('BatchSwap not from tracked smart account, skipping:', sender);
    return;
  }

  // Process each swap in the batch
  for (let i = 0; i < swaps.length; i++) {
    // Create individual trade records
    // Link them to a RebalancingEvent entity
  }

  console.log('BatchSwap indexed:', transactionHash);
}
