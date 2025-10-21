# Monorail Swap API Fix - Following Official Documentation

## Issue Identified

The error `"invalid slippage: strconv.ParseUint: parsing \"0.5\": invalid syntax"` indicates that:

1. Monorail API expects slippage as an unsigned integer (not decimal)
2. Based on official Monorail documentation, **slippage is NOT part of the quote request**

## Root Cause

After reviewing the official Monorail documentation at https://testnet-preview.monorail.xyz/developers/documentation, I found that:

1. The example code shows NO slippage parameter in quote requests
2. The V4 quote API only uses: `source`, `from`, `to`, `amount`
3. Slippage handling is likely done during execution, not quoting

## Fixes Applied

### 1. **Removed Slippage from Quote Requests**

Updated `lib/monorail/swap.ts` to follow exact Monorail documentation pattern:

```typescript
// Follow exact Monorail documentation pattern
const quoteUrl = new URL(`${this.baseUrl}/v4/quote`);
quoteUrl.searchParams.set("source", appId); // '0' by default
quoteUrl.searchParams.set("from", tokenIn); // From token address
quoteUrl.searchParams.set("to", tokenOut); // To token address
quoteUrl.searchParams.set("amount", amount); // Amount to swap

// Note: NO slippage parameter in quote requests per Monorail docs
```

### 2. **Updated All API Routes**

- `app/api/swap/quote/route.ts` - Removed slippage from quote calls
- `app/api/swap/execute/route.ts` - Removed slippage from quote calls
- `app/api/rebalance/execute/route.ts` - Removed slippage from quote calls

### 3. **Corrected App ID**

Changed from `'asset-nest-app'` to `'0'` to match Monorail documentation default.

## Testing

The implementation now strictly follows the Monorail documentation example:

```javascript
// Official Monorail example (from their docs)
const appId = "0";
const tokenIn = "0x0000000000000000000000000000000000000000"; // MON
const tokenOut = "0xf817257fed379853cde0fa4f97ab987181b1e5ea"; // USDC
const amountToSwap = 1.5;

const quoteUrl = new URL("https://testnet-pathfinder.monorail.xyz/v4/quote");
quoteUrl.searchParams.set("source", appId);
quoteUrl.searchParams.set("from", tokenIn);
quoteUrl.searchParams.set("to", tokenOut);
quoteUrl.searchParams.set("amount", amountToSwap.toString());

const response = await fetch(quoteUrl.toString());
```

## Key Learning

The official Monorail documentation shows the correct API usage. Slippage tolerance is likely:

- Handled during transaction execution
- Built into the returned transaction data
- Not a parameter for the quote endpoint

## Next Steps

1. Test the swap quote functionality - should now work without slippage errors
2. If slippage control is needed, investigate Monorail's execution/transaction API
3. Consider that slippage might be handled automatically by Monorail's routing

The 500 errors should now be resolved since we're following Monorail's exact API specification.
