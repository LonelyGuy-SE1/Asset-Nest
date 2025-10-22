/**
 * Debug Transaction Format - Check for execution revert issues
 */

const axios = require("axios");

async function debugTransactionFormat() {
  console.log("🔍 Debugging Transaction Format Issues...\n");

  const appId = "0";
  const tokenIn = "0x0000000000000000000000000000000000000000"; // MON
  const tokenOut = "0xf817257fed379853cde0fa4f97ab987181b1e5ea"; // USDC
  const amountToSwap = "0.1"; // Small amount for testing
  const testSender = "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5";

  try {
    // Get quote with sender
    console.log("📝 Getting Monorail quote...");
    const quoteUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    quoteUrl.searchParams.set("source", appId);
    quoteUrl.searchParams.set("from", tokenIn);
    quoteUrl.searchParams.set("to", tokenOut);
    quoteUrl.searchParams.set("amount", amountToSwap);
    quoteUrl.searchParams.set("sender", testSender);

    const response = await axios.get(quoteUrl.toString());
    const result = response.data;

    console.log("✅ Quote received successfully\n");

    // Analyze transaction details
    console.log("🔎 Transaction Analysis:");
    console.log(
      "Raw transaction object:",
      JSON.stringify(result.transaction, null, 2)
    );

    console.log("\n📋 Transaction Fields:");
    console.log("  - to:", result.transaction.to);
    console.log("  - data length:", result.transaction.data.length);
    console.log(
      "  - data preview:",
      result.transaction.data.substring(0, 42) + "..."
    );
    console.log("  - value:", result.transaction.value);
    console.log("  - value (decimal):", parseInt(result.transaction.value, 16));
    console.log(
      "  - value (MON):",
      parseInt(result.transaction.value, 16) / 1e18
    );

    // Check for common issues
    console.log("\n🚨 Common Revert Causes:");

    // 1. Check transaction value matches input amount
    const expectedValueWei = parseFloat(amountToSwap) * 1e18;
    const actualValueWei = parseInt(result.transaction.value, 16);
    console.log("  1. Value Check:");
    console.log("     Expected:", expectedValueWei, "wei");
    console.log("     Actual:", actualValueWei, "wei");
    console.log(
      "     Match:",
      expectedValueWei === actualValueWei ? "✅" : "❌"
    );

    // 2. Check if transaction is for MON (native token)
    const isNativeToken =
      tokenIn === "0x0000000000000000000000000000000000000000";
    console.log("  2. Native Token Check:");
    console.log("     Is MON:", isNativeToken ? "✅" : "❌");
    console.log(
      "     Should have value:",
      isNativeToken && actualValueWei > 0 ? "✅" : "❌"
    );

    // 3. Check gas estimate reasonableness
    console.log("  3. Gas Estimate:");
    console.log("     Gas:", result.gas_estimate);
    console.log(
      "     Reasonable (<1M):",
      result.gas_estimate < 1000000 ? "✅" : "❌"
    );

    // 4. Check route and hops
    console.log("  4. Route Check:");
    console.log("     Hops:", result.hops);
    console.log(
      "     Has routes:",
      result.routes && result.routes.length > 0 ? "✅" : "❌"
    );

    // Create proper transaction object
    console.log("\n💻 Wallet Transaction Format:");
    const walletTx = {
      from: testSender,
      to: result.transaction.to,
      data: result.transaction.data,
      value: result.transaction.value,
      gas: `0x${result.gas_estimate.toString(16)}`,
    };

    console.log("Wallet transaction:", JSON.stringify(walletTx, null, 2));

    // Test our API endpoint format
    console.log("\n🔄 Testing API Endpoint...");
    try {
      const apiResponse = await axios.post(
        "http://localhost:3000/api/swap/execute",
        {
          fromToken: tokenIn,
          toToken: tokenOut,
          amount: amountToSwap,
          fromAddress: testSender,
        }
      );

      console.log("✅ API Response received:");
      console.log("  - Success:", apiResponse.data.success);
      console.log("  - Transaction to:", apiResponse.data.transaction.to);
      console.log("  - Transaction value:", apiResponse.data.transaction.value);
      console.log(
        "  - Matches Monorail:",
        apiResponse.data.transaction.to === result.transaction.to &&
          apiResponse.data.transaction.value === result.transaction.value
          ? "✅"
          : "❌"
      );
    } catch (apiError) {
      console.error(
        "❌ API Error:",
        apiError.response?.data || apiError.message
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

debugTransactionFormat();
