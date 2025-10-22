/**
 * Debug Monorail API - Check transaction data quality
 */

const axios = require("axios");

async function debugMonorailTransaction() {
  console.log("🔍 Debugging Monorail Transaction Data...");

  // Test parameters
  const appId = "0";
  const tokenIn = "0x0000000000000000000000000000000000000000"; // MON
  const tokenOut = "0xf817257fed379853cde0fa4f97ab987181b1e5ea"; // USDC
  const amountToSwap = "1.5";
  const testSender = "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5";

  try {
    // Test 1: Quote WITHOUT sender (should have limited transaction data)
    console.log("\n📝 Test 1: Quote without sender");
    const quoteUrl1 = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    quoteUrl1.searchParams.set("source", appId);
    quoteUrl1.searchParams.set("from", tokenIn);
    quoteUrl1.searchParams.set("to", tokenOut);
    quoteUrl1.searchParams.set("amount", amountToSwap);

    const response1 = await axios.get(quoteUrl1.toString());
    console.log("Without sender:");
    console.log("  - Has transaction:", !!response1.data.transaction);
    console.log("  - Transaction to:", response1.data.transaction?.to);
    console.log(
      "  - Data length:",
      response1.data.transaction?.data?.length || 0
    );
    console.log("  - Gas estimate:", response1.data.gas_estimate);

    // Test 2: Quote WITH sender (should have complete transaction data)
    console.log("\n📝 Test 2: Quote with sender");
    const quoteUrl2 = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    quoteUrl2.searchParams.set("source", appId);
    quoteUrl2.searchParams.set("from", tokenIn);
    quoteUrl2.searchParams.set("to", tokenOut);
    quoteUrl2.searchParams.set("amount", amountToSwap);
    quoteUrl2.searchParams.set("sender", testSender);

    const response2 = await axios.get(quoteUrl2.toString());
    console.log("With sender:");
    console.log("  - Has transaction:", !!response2.data.transaction);
    console.log("  - Transaction to:", response2.data.transaction?.to);
    console.log(
      "  - Data length:",
      response2.data.transaction?.data?.length || 0
    );
    console.log(
      "  - Data preview:",
      response2.data.transaction?.data?.substring(0, 20) + "..."
    );
    console.log("  - Gas estimate:", response2.data.gas_estimate);
    console.log("  - Transaction value:", response2.data.transaction?.value);

    // Test 3: Full response analysis
    console.log("\n📝 Test 3: Full response structure");
    console.log("Response keys:", Object.keys(response2.data));
    console.log(
      "Transaction keys:",
      Object.keys(response2.data.transaction || {})
    );

    // Test 4: Gas cost estimation
    const gasEstimate = response2.data.gas_estimate || 200000;
    const estimatedCostMON = gasEstimate * 1e-9; // Rough estimate assuming 1 gwei
    console.log("\n💰 Gas Cost Analysis:");
    console.log("  - Gas estimate:", gasEstimate);
    console.log(
      "  - Estimated MON cost (~1 gwei):",
      estimatedCostMON.toFixed(4)
    );
    console.log("  - Is cost reasonable (<0.1 MON)?", estimatedCostMON < 0.1);

    // Test 5: Check if transaction is executable
    const transaction = response2.data.transaction;
    const isExecutable =
      transaction &&
      transaction.to &&
      transaction.data &&
      transaction.data !== "0x";
    console.log("\n✅ Transaction Executability:");
    console.log("  - Has target address:", !!transaction?.to);
    console.log(
      "  - Has calldata:",
      !!(transaction?.data && transaction.data !== "0x")
    );
    console.log("  - Is executable:", isExecutable);

    if (!isExecutable) {
      console.log(
        "❌ Transaction is NOT executable - this will cause blockchain failures"
      );
    } else {
      console.log("✅ Transaction appears executable");
    }
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

debugMonorailTransaction();
