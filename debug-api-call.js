/**
 * Debug Exact API Call - Check what we're actually sending
 */

const axios = require("axios");

async function debugApiCall() {
  console.log("🔍 Debugging Exact API Call...\n");

  // Test the EXACT payload our frontend is sending
  const frontendPayload = {
    fromToken: "0x0000000000000000000000000000000000000000",
    toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
    amount: "0.05",
    fromAddress: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
    slippage: "0.5",
    decimals: 18, // This is still being sent!
  };

  console.log("📤 Frontend payload:", JSON.stringify(frontendPayload, null, 2));

  try {
    console.log("\n📡 Calling our API endpoint...");
    const response = await axios.post(
      "http://localhost:3000/api/swap/execute",
      frontendPayload
    );

    if (response.data.success) {
      console.log("✅ API Response successful");
      console.log("  - Transaction to:", response.data.transaction.to);
      console.log(
        "  - Transaction data length:",
        response.data.transaction.data?.length
      );
      console.log("  - Transaction value:", response.data.transaction.value);

      // Check if the transaction matches a direct Monorail call
      console.log("\n🔄 Comparing with direct Monorail call...");
      const directUrl = new URL(
        "https://testnet-pathfinder.monorail.xyz/v4/quote"
      );
      directUrl.searchParams.set("source", "0");
      directUrl.searchParams.set("from", frontendPayload.fromToken);
      directUrl.searchParams.set("to", frontendPayload.toToken);
      directUrl.searchParams.set("amount", frontendPayload.amount);
      directUrl.searchParams.set("sender", frontendPayload.fromAddress);
      directUrl.searchParams.set("max_slippage", "50"); // 0.5%
      directUrl.searchParams.set("deadline", "300"); // 5 minutes
      directUrl.searchParams.set("destination", frontendPayload.fromAddress);

      const directResponse = await axios.get(directUrl.toString());

      console.log("Direct Monorail response:");
      console.log("  - Transaction to:", directResponse.data.transaction?.to);
      console.log(
        "  - Transaction data length:",
        directResponse.data.transaction?.data?.length
      );
      console.log(
        "  - Transaction value:",
        directResponse.data.transaction?.value
      );

      // Compare
      const match =
        response.data.transaction.to === directResponse.data.transaction?.to &&
        response.data.transaction.value ===
          directResponse.data.transaction?.value;

      console.log("  - Transactions match:", match ? "✅" : "❌");

      if (!match) {
        console.log("\n⚠️ TRANSACTION MISMATCH DETECTED!");
        console.log("Our API transaction:");
        console.log(JSON.stringify(response.data.transaction, null, 2));
        console.log("\nDirect Monorail transaction:");
        console.log(JSON.stringify(directResponse.data.transaction, null, 2));
      }
    } else {
      console.error("❌ API Error:", response.data);
    }
  } catch (error) {
    console.error("❌ Error:", error.response?.data || error.message);

    if (error.code === "ECONNREFUSED") {
      console.log("💡 Start your Next.js server: npm run dev");
    }
  }
}

debugApiCall();
