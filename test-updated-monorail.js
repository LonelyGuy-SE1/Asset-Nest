/**
 * Test Updated Monorail Integration with All Parameters
 */

const axios = require("axios");

async function testUpdatedMonorailIntegration() {
  console.log("🔍 Testing Updated Monorail Integration...\n");

  const testParams = {
    appId: "0",
    tokenIn: "0x0000000000000000000000000000000000000000", // MON
    tokenOut: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.1", // Small test amount
    sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
    maxSlippage: 50, // 0.5%
    deadline: 300, // 5 minutes
  };

  try {
    // Test 1: Direct Monorail API with ALL parameters
    console.log("📝 Test 1: Direct Monorail API with ALL parameters");
    const quoteUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    quoteUrl.searchParams.set("source", testParams.appId);
    quoteUrl.searchParams.set("from", testParams.tokenIn);
    quoteUrl.searchParams.set("to", testParams.tokenOut);
    quoteUrl.searchParams.set("amount", testParams.amount);
    quoteUrl.searchParams.set("sender", testParams.sender);
    quoteUrl.searchParams.set(
      "max_slippage",
      testParams.maxSlippage.toString()
    );
    quoteUrl.searchParams.set("deadline", testParams.deadline.toString());
    quoteUrl.searchParams.set("destination", testParams.sender);

    console.log("🔗 Full Request URL:", quoteUrl.toString());

    const response = await axios.get(quoteUrl.toString());
    console.log("✅ Direct API Response:");
    console.log("  - Status:", response.status);
    console.log("  - Output:", response.data.output_formatted);
    console.log("  - Min output:", response.data.min_output_formatted);
    console.log("  - Gas estimate:", response.data.gas_estimate);
    console.log("  - Transaction to:", response.data.transaction?.to);
    console.log(
      "  - Transaction data length:",
      response.data.transaction?.data?.length || 0
    );
    console.log("  - Transaction value:", response.data.transaction?.value);

    // Test 2: Our updated API endpoint
    console.log("\n📝 Test 2: Our updated API endpoint");
    try {
      const apiResponse = await axios.post(
        "http://localhost:3000/api/swap/execute",
        {
          fromToken: testParams.tokenIn,
          toToken: testParams.tokenOut,
          amount: testParams.amount,
          fromAddress: testParams.sender,
          slippage: "0.5", // 0.5%
        }
      );

      console.log("✅ API Response:");
      console.log("  - Success:", apiResponse.data.success);
      console.log(
        "  - Transaction matches:",
        apiResponse.data.transaction.to === response.data.transaction?.to &&
          apiResponse.data.transaction.value ===
            response.data.transaction?.value
      );
    } catch (apiError) {
      console.error(
        "❌ API Error:",
        apiError.response?.data || apiError.message
      );
    }

    // Test 3: Check response structure
    console.log("\n📝 Test 3: Response structure analysis");
    const result = response.data;

    console.log("Key fields present:");
    console.log("  - min_output_formatted:", !!result.min_output_formatted);
    console.log("  - compound_impact:", result.compound_impact);
    console.log("  - deadline handling:", "Should be baked into transaction");
    console.log("  - slippage protection:", "Should be baked into min_output");

    // Check if min_output is reasonable
    const outputAmount = parseFloat(result.output_formatted);
    const minOutputAmount = parseFloat(result.min_output_formatted);
    const actualSlippage =
      ((outputAmount - minOutputAmount) / outputAmount) * 100;

    console.log("\n💡 Slippage Analysis:");
    console.log("  - Expected output:", outputAmount.toFixed(6));
    console.log("  - Minimum output:", minOutputAmount.toFixed(6));
    console.log("  - Slippage protection:", actualSlippage.toFixed(2) + "%");
    console.log("  - Reasonable:", actualSlippage <= 1 ? "✅" : "⚠️");
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);
  }
}

testUpdatedMonorailIntegration();
