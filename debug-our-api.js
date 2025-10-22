/**
 * Debug Our API Response
 * Check what OUR API is returning vs what Monorail returns
 */

const axios = require("axios");

async function debugOurAPI() {
  console.log("🔍 Debugging OUR API Response vs Monorail...\n");

  try {
    // Test our API endpoint
    console.log("📡 Testing our API endpoint...");
    const apiResponse = await axios.post(
      "http://localhost:3000/api/swap/execute",
      {
        fromToken: "0x0000000000000000000000000000000000000000", // MON
        toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
        amount: "0.1",
        fromAddress: "0x0f610d3473c92Ebd52E22F84be0F743ED938952a",
        slippage: "0.5",
      }
    );

    if (apiResponse.data.success) {
      console.log("✅ Our API Response:");
      console.log("  - success:", apiResponse.data.success);
      console.log("  - transaction.value:", apiResponse.data.transaction.value);
      console.log(
        "  - quote.transaction.value:",
        apiResponse.data.quote?.transaction?.value
      );

      console.log("\n🔍 Full Transaction Object:");
      console.log(JSON.stringify(apiResponse.data.transaction, null, 2));

      if (
        apiResponse.data.transaction.value === "0x0" ||
        apiResponse.data.transaction.value === "0"
      ) {
        console.log("\n❌ FOUND THE BUG! Our API is returning wrong value");
        console.log(
          "🔧 Need to check our API code in /api/swap/execute/route.ts"
        );
      } else {
        console.log("\n✅ Our API value is correct");
        console.log("🔍 The issue might be in frontend processing");
      }
    } else {
      console.error("❌ API Error:", apiResponse.data);
    }
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log("⚠️ API server not running. Please run: npm run dev");
      console.log("\n📋 To test manually:");
      console.log("1. Start the dev server: npm run dev");
      console.log("2. Run this script again");
    } else {
      console.error("❌ API error:", error.response?.data || error.message);
    }
  }
}

debugOurAPI();
