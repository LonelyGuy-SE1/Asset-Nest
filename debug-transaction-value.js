/**
 * Debug Transaction Value Issue
 * The value is 0x0 when it should be 0x16345785d8a0000 (0.1 MON)
 */

const axios = require("axios");

async function debugTransactionValue() {
  console.log("🔍 Debugging Transaction Value Issue...\n");

  const testParams = {
    fromToken: "0x0000000000000000000000000000000000000000", // MON (native)
    toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.1",
    sender: "0x0f610d3473c92Ebd52E22F84be0F743ED938952a", // Your actual address
  };

  console.log("Expected value for 0.1 MON:");
  const expectedValueWei = BigInt(parseFloat(testParams.amount) * 1e18);
  console.log("  - Wei:", expectedValueWei.toString());
  console.log("  - Hex:", "0x" + expectedValueWei.toString(16));
  console.log();

  try {
    // Test 1: Direct Monorail API call
    console.log("📡 Test 1: Direct Monorail API call");
    const directUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    directUrl.searchParams.set("source", "0");
    directUrl.searchParams.set("from", testParams.fromToken);
    directUrl.searchParams.set("to", testParams.toToken);
    directUrl.searchParams.set("amount", testParams.amount);
    directUrl.searchParams.set("sender", testParams.sender);

    console.log("URL:", directUrl.toString());
    const directResponse = await axios.get(directUrl.toString());

    console.log("Direct Monorail response:");
    console.log(
      "  - Transaction value:",
      directResponse.data.transaction?.value
    );
    console.log("  - Expected value:", "0x" + expectedValueWei.toString(16));
    console.log(
      "  - Values match:",
      directResponse.data.transaction?.value ===
        "0x" + expectedValueWei.toString(16)
        ? "✅"
        : "❌"
    );

    if (directResponse.data.transaction?.value === "0x0") {
      console.log("⚠️ MONORAIL RETURNING ZERO VALUE FOR NATIVE TOKEN SWAP!");
    }

    // Test 2: Our API endpoint
    console.log("\n📡 Test 2: Our API endpoint");
    try {
      const apiResponse = await axios.post(
        "http://localhost:3000/api/swap/execute",
        {
          fromToken: testParams.fromToken,
          toToken: testParams.toToken,
          amount: testParams.amount,
          fromAddress: testParams.sender,
          slippage: "0.5",
        }
      );

      if (apiResponse.data.success) {
        console.log("Our API response:");
        console.log(
          "  - Transaction value:",
          apiResponse.data.transaction.value
        );
        console.log(
          "  - Expected value:",
          "0x" + expectedValueWei.toString(16)
        );
        console.log(
          "  - Values match:",
          apiResponse.data.transaction.value ===
            "0x" + expectedValueWei.toString(16)
            ? "✅"
            : "❌"
        );

        // Compare with direct call
        console.log(
          "  - Matches Monorail:",
          apiResponse.data.transaction.value ===
            directResponse.data.transaction?.value
            ? "✅"
            : "❌"
        );

        if (apiResponse.data.transaction.value === "0x0") {
          console.log("❌ OUR API ALSO RETURNING ZERO VALUE!");
          console.log("💡 This is why the swap fails - no MON is being sent");
        }
      } else {
        console.error("❌ API Error:", apiResponse.data);
      }
    } catch (apiError) {
      if (apiError.code === "ECONNREFUSED") {
        console.log("⚠️ API server not running");
      } else {
        console.error("❌ API error:", apiError.message);
      }
    }

    // Test 3: Check if this is a Monorail API issue or our handling
    console.log("\n🔍 Test 3: Analyzing the issue");

    const monorailValue = directResponse.data.transaction?.value;
    if (monorailValue === "0x0") {
      console.log("📋 Issue Analysis:");
      console.log("  ❌ Monorail API is returning value: 0x0");
      console.log("  ❌ This is incorrect for native token swaps");
      console.log("  ❌ MON swaps require transaction value = swap amount");
      console.log();
      console.log("💡 Possible causes:");
      console.log("  1. Monorail API bug with native token handling");
      console.log("  2. Missing parameter causing incorrect routing");
      console.log("  3. API expects different format for native tokens");
      console.log("  4. We need to manually set value for native swaps");
      console.log();
      console.log("🔧 Fix needed:");
      console.log("  - Detect native token swaps (address = 0x0...)");
      console.log("  - Override transaction.value with swap amount");
      console.log("  - Convert amount to wei format");
    } else {
      console.log("✅ Monorail value is correct, issue is in our handling");
    }
  } catch (error) {
    console.error("❌ Debug error:", error.response?.data || error.message);
  }
}

debugTransactionValue();
