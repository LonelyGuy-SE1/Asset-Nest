/**
 * Test Monorail API Integration
 * This tests the fixed implementation with correct amount formatting
 */

const axios = require("axios");

async function testMonorailQuote() {
  console.log("🔵 Testing Monorail API Integration...");

  // Define test parameters (matching documentation example)
  const appId = "0";
  const tokenIn = "0x0000000000000000000000000000000000000000"; // MON
  const tokenOut = "0xf817257fed379853cde0fa4f97ab987181b1e5ea"; // USDC
  const amountToSwap = "1.5"; // Human-readable format as per docs

  try {
    // Test 1: Direct API call (as shown in documentation)
    console.log("\n📝 Test 1: Direct Monorail API call");
    const quoteUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    quoteUrl.searchParams.set("source", appId);
    quoteUrl.searchParams.set("from", tokenIn);
    quoteUrl.searchParams.set("to", tokenOut);
    quoteUrl.searchParams.set("amount", amountToSwap);

    console.log("🔗 Request URL:", quoteUrl.toString());

    const response = await axios.get(quoteUrl.toString(), {
      timeout: 10000,
    });

    console.log("✅ Direct API Response:");
    console.log("  - Status:", response.status);
    console.log("  - Output formatted:", response.data.output_formatted);
    console.log("  - Has transaction:", !!response.data.transaction);
    console.log("  - Gas estimate:", response.data.gas_estimate);

    // Test 2: Our API endpoints
    console.log("\n📝 Test 2: Our Quote API endpoint");
    const quoteResponse = await axios.get(
      "http://localhost:3000/api/swap/quote",
      {
        params: {
          fromToken: tokenIn,
          toToken: tokenOut,
          amount: amountToSwap,
        },
        timeout: 10000,
      }
    );

    console.log("✅ Quote API Response:");
    console.log("  - Success:", quoteResponse.data.success);
    console.log("  - From amount:", quoteResponse.data.fromAmount);
    console.log("  - To amount:", quoteResponse.data.toAmount);
    console.log("  - Exchange rate:", quoteResponse.data.exchangeRate);

    // Test 3: Execute API with sender
    console.log("\n📝 Test 3: Execute API endpoint");
    const executeResponse = await axios.post(
      "http://localhost:3000/api/swap/execute",
      {
        fromToken: tokenIn,
        toToken: tokenOut,
        amount: amountToSwap,
        fromAddress: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
      },
      {
        timeout: 10000,
      }
    );

    console.log("✅ Execute API Response:");
    console.log("  - Success:", executeResponse.data.success);
    console.log("  - Transaction to:", executeResponse.data.transaction.to);
    console.log(
      "  - Has calldata:",
      executeResponse.data.transaction.data !== "0x"
    );
    console.log(
      "  - Transaction value:",
      executeResponse.data.transaction.value
    );
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("💡 Make sure your Next.js server is running: npm run dev");
    }
  }
}

// Run the test
if (require.main === module) {
  testMonorailQuote();
}

module.exports = { testMonorailQuote };
