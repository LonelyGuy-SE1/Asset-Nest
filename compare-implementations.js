/**
 * Compare Our Implementation vs Working Implementation
 * Check if we're missing a step that working integrations use
 */

const axios = require("axios");

async function compareImplementations() {
  console.log("🔍 Comparing Our Implementation vs Working Ones...\n");

  const testParams = {
    fromToken: "0x0000000000000000000000000000000000000000", // MON
    toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.01", // Very small amount
    sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
  };

  try {
    console.log("🧪 Test 1: Minimal Implementation (like docs)");

    // Exactly what the docs show
    const docUrl = new URL("https://testnet-pathfinder.monorail.xyz/v4/quote");
    docUrl.searchParams.set("source", "0");
    docUrl.searchParams.set("from", testParams.fromToken);
    docUrl.searchParams.set("to", testParams.toToken);
    docUrl.searchParams.set("amount", testParams.amount);
    // NO other parameters like the original docs example

    console.log("📤 Docs example URL:", docUrl.toString());
    const docResponse = await axios.get(docUrl.toString());
    console.log("✅ Docs example works");
    console.log("  - Has transaction:", !!docResponse.data.transaction);
    console.log(
      "  - Transaction complete:",
      docResponse.data.transaction?.to && docResponse.data.transaction?.data
    );

    console.log("\n🧪 Test 2: With sender (for executable tx)");

    const senderUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    senderUrl.searchParams.set("source", "0");
    senderUrl.searchParams.set("from", testParams.fromToken);
    senderUrl.searchParams.set("to", testParams.toToken);
    senderUrl.searchParams.set("amount", testParams.amount);
    senderUrl.searchParams.set("sender", testParams.sender); // Only add sender

    console.log("📤 With sender URL:", senderUrl.toString());
    const senderResponse = await axios.get(senderUrl.toString());
    console.log("✅ Sender version works");
    console.log("  - Transaction to:", senderResponse.data.transaction?.to);
    console.log(
      "  - Data length:",
      senderResponse.data.transaction?.data?.length
    );
    console.log(
      "  - Value (MON):",
      parseInt(senderResponse.data.transaction?.value || "0", 16) / 1e18
    );

    console.log("\n🧪 Test 3: Our current implementation");

    const ourUrl = new URL("https://testnet-pathfinder.monorail.xyz/v4/quote");
    ourUrl.searchParams.set("source", "0");
    ourUrl.searchParams.set("from", testParams.fromToken);
    ourUrl.searchParams.set("to", testParams.toToken);
    ourUrl.searchParams.set("amount", testParams.amount);
    ourUrl.searchParams.set("sender", testParams.sender);
    ourUrl.searchParams.set("max_slippage", "50"); // 0.5%
    ourUrl.searchParams.set("deadline", "300"); // 5 minutes
    ourUrl.searchParams.set("destination", testParams.sender);

    console.log("📤 Our implementation URL:", ourUrl.toString());
    const ourResponse = await axios.get(ourUrl.toString());
    console.log("✅ Our implementation works");

    // Compare the transaction data
    console.log("\n🔍 Transaction Comparison:");
    const senderTx = senderResponse.data.transaction;
    const ourTx = ourResponse.data.transaction;

    console.log("Sender-only vs Our implementation:");
    console.log(
      "  - Same target contract:",
      senderTx?.to === ourTx?.to ? "✅" : "❌"
    );
    console.log(
      "  - Same data length:",
      senderTx?.data?.length === ourTx?.data?.length ? "✅" : "❌"
    );
    console.log(
      "  - Same value:",
      senderTx?.value === ourTx?.value ? "✅" : "❌"
    );

    if (senderTx?.data !== ourTx?.data) {
      console.log("⚠️ CALLDATA DIFFERS!");
      console.log("  Sender-only calldata length:", senderTx?.data?.length);
      console.log("  Our implementation calldata length:", ourTx?.data?.length);
      console.log("  This might be the issue!");
    }

    console.log("\n💡 Analysis:");
    if (senderTx && ourTx && senderTx.data === ourTx.data) {
      console.log("✅ Transaction data is identical");
      console.log("📝 Issue is likely:");
      console.log("  1. Gas estimation too low");
      console.log("  2. Network timing issues");
      console.log("  3. User balance/state issues");
      console.log("  4. MetaMask configuration");
    } else {
      console.log("❌ Transaction data differs between implementations");
      console.log("📝 Issue is likely:");
      console.log("  1. Extra parameters changing the transaction");
      console.log("  2. Different routing due to slippage/deadline");
      console.log("  3. API version mismatch");
    }

    // Test with our API endpoint
    console.log("\n🧪 Test 4: Our API endpoint");
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
        console.log("✅ Our API works");
        const apiTx = apiResponse.data.transaction;
        console.log(
          "  - Matches sender-only:",
          apiTx.to === senderTx?.to && apiTx.value === senderTx?.value
            ? "✅"
            : "❌"
        );
        console.log(
          "  - Matches our implementation:",
          apiTx.to === ourTx?.to && apiTx.value === ourTx?.value ? "✅" : "❌"
        );
      } else {
        console.error("❌ Our API failed:", apiResponse.data);
      }
    } catch (apiError) {
      if (apiError.code === "ECONNREFUSED") {
        console.log("⚠️ API server not running (start with npm run dev)");
      } else {
        console.error("❌ API error:", apiError.message);
      }
    }
  } catch (error) {
    console.error(
      "❌ Comparison error:",
      error.response?.data || error.message
    );
  }
}

compareImplementations();
