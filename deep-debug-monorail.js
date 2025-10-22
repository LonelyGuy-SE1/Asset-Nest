/**
 * Deep Debug - Compare Working vs Our Implementation
 * Let's see exactly what successful integrations are doing differently
 */

const axios = require("axios");

async function deepDebugMonorail() {
  console.log("🔍 Deep Debug: Finding the Root Cause...\n");

  const testParams = {
    appId: "0",
    tokenIn: "0x0000000000000000000000000000000000000000", // MON
    tokenOut: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.05", // Even smaller amount
    sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
  };

  try {
    console.log("📋 Testing Multiple Parameter Combinations...\n");

    // Test 1: Minimal parameters (as in original docs)
    console.log("1️⃣ MINIMAL PARAMETERS (original docs example):");
    const minimalUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    minimalUrl.searchParams.set("source", testParams.appId);
    minimalUrl.searchParams.set("from", testParams.tokenIn);
    minimalUrl.searchParams.set("to", testParams.tokenOut);
    minimalUrl.searchParams.set("amount", testParams.amount);
    // NO sender, slippage, deadline, destination

    console.log("URL:", minimalUrl.toString());
    const minimalResponse = await axios.get(minimalUrl.toString());
    console.log("✅ Response received");
    console.log("  - Has transaction:", !!minimalResponse.data.transaction);
    console.log(
      "  - Transaction to:",
      minimalResponse.data.transaction?.to || "N/A"
    );
    console.log(
      "  - Data length:",
      minimalResponse.data.transaction?.data?.length || 0
    );
    console.log("  - Value:", minimalResponse.data.transaction?.value || "N/A");

    // Test 2: With sender only
    console.log("\n2️⃣ WITH SENDER ONLY:");
    const senderUrl = new URL(
      "https://testnet-pathfinder.monorail.xyz/v4/quote"
    );
    senderUrl.searchParams.set("source", testParams.appId);
    senderUrl.searchParams.set("from", testParams.tokenIn);
    senderUrl.searchParams.set("to", testParams.tokenOut);
    senderUrl.searchParams.set("amount", testParams.amount);
    senderUrl.searchParams.set("sender", testParams.sender);

    console.log("URL:", senderUrl.toString());
    const senderResponse = await axios.get(senderUrl.toString());
    console.log("✅ Response received");
    console.log("  - Has transaction:", !!senderResponse.data.transaction);
    console.log("  - Transaction to:", senderResponse.data.transaction?.to);
    console.log(
      "  - Data length:",
      senderResponse.data.transaction?.data?.length
    );
    console.log(
      "  - Value matches:",
      senderResponse.data.transaction?.value ===
        minimalResponse.data.transaction?.value
    );

    // Test 3: Check ALL response fields for clues
    console.log("\n3️⃣ RESPONSE FIELD ANALYSIS:");
    const fullResponse = senderResponse.data;
    console.log("Available fields:", Object.keys(fullResponse));

    console.log("\nImportant fields:");
    console.log("  - quote_id:", fullResponse.quote_id);
    console.log("  - block:", fullResponse.block);
    console.log("  - generated_at:", fullResponse.generated_at);
    console.log("  - compound_impact:", fullResponse.compound_impact);
    console.log("  - optimisation:", fullResponse.optimisation);
    console.log("  - hops:", fullResponse.hops);
    console.log("  - routes count:", fullResponse.routes?.length || 0);

    if (fullResponse.fees) {
      console.log("  - protocol_bps:", fullResponse.fees.protocol_bps);
      console.log("  - protocol_amount:", fullResponse.fees.protocol_amount);
    }

    // Test 4: Analyze the transaction structure in detail
    console.log("\n4️⃣ TRANSACTION STRUCTURE DEEP DIVE:");
    const tx = fullResponse.transaction;
    if (tx) {
      console.log("Transaction object keys:", Object.keys(tx));
      console.log("  - to (contract):", tx.to);
      console.log("  - value (wei):", tx.value);
      console.log("  - value (MON):", parseInt(tx.value, 16) / 1e18);
      console.log("  - data preview:", tx.data.substring(0, 50) + "...");
      console.log("  - data full length:", tx.data.length);

      // Decode the function selector
      const selector = tx.data.substring(0, 10);
      console.log("  - function selector:", selector);

      // Common function selectors for DEX operations
      const knownSelectors = {
        "0xa9059cbb": "transfer(address,uint256)",
        "0x23b872dd": "transferFrom(address,address,uint256)",
        "0x095ea7b3": "approve(address,uint256)",
        "0x38ed1739": "swapExactTokensForTokens(...)",
        "0x7ff36ab5": "swapExactETHForTokens(...)",
        "0x18cbafe5": "swapExactTokensForETH(...)",
        "0xf99cae99": "Custom Monorail function",
      };

      console.log(
        "  - function type:",
        knownSelectors[selector] || "Unknown function"
      );
    }

    // Test 5: Check if there are any missing required fields
    console.log("\n5️⃣ VALIDATION CHECKS:");

    // Check transaction completeness
    const txValid =
      tx && tx.to && tx.data && tx.data !== "0x" && tx.value !== undefined;
    console.log("  - Transaction valid:", txValid ? "✅" : "❌");

    // Check amounts match
    const inputAmount = parseFloat(testParams.amount);
    const expectedValueWei = inputAmount * 1e18;
    const actualValueWei = parseInt(tx.value, 16);
    console.log("  - Amount matching:");
    console.log("    Input amount:", inputAmount, "MON");
    console.log("    Expected wei:", expectedValueWei);
    console.log("    Actual wei:", actualValueWei);
    console.log(
      "    Matches:",
      expectedValueWei === actualValueWei ? "✅" : "❌"
    );

    // Check gas estimate reasonableness
    const gasEstimate = fullResponse.gas_estimate;
    console.log("  - Gas estimate:", gasEstimate);
    console.log(
      "  - Gas reasonable:",
      gasEstimate > 0 && gasEstimate < 2000000 ? "✅" : "❌"
    );

    // Test 6: Try the exact transaction format Monorail expects
    console.log("\n6️⃣ WALLET TRANSACTION FORMAT:");
    const walletTx = {
      from: testParams.sender,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: `0x${gasEstimate.toString(16)}`,
    };

    console.log("Wallet transaction object:");
    console.log(JSON.stringify(walletTx, null, 2));

    // Test 7: Check for any differences with max parameters
    console.log("\n7️⃣ COMPARING WITH MAX PARAMETERS:");
    const maxUrl = new URL("https://testnet-pathfinder.monorail.xyz/v4/quote");
    maxUrl.searchParams.set("source", testParams.appId);
    maxUrl.searchParams.set("from", testParams.tokenIn);
    maxUrl.searchParams.set("to", testParams.tokenOut);
    maxUrl.searchParams.set("amount", testParams.amount);
    maxUrl.searchParams.set("sender", testParams.sender);
    maxUrl.searchParams.set("max_slippage", "50");
    maxUrl.searchParams.set("deadline", "300");
    maxUrl.searchParams.set("destination", testParams.sender);

    const maxResponse = await axios.get(maxUrl.toString());
    console.log("Max params response:");
    console.log(
      "  - Same transaction to:",
      maxResponse.data.transaction?.to === tx.to ? "✅" : "❌"
    );
    console.log(
      "  - Same data length:",
      maxResponse.data.transaction?.data?.length === tx.data?.length
        ? "✅"
        : "❌"
    );
    console.log(
      "  - Same value:",
      maxResponse.data.transaction?.value === tx.value ? "✅" : "❌"
    );

    if (maxResponse.data.transaction?.data !== tx.data) {
      console.log("⚠️ TRANSACTION DATA DIFFERS WITH MAX PARAMS!");
      console.log("Sender-only data length:", tx.data?.length);
      console.log(
        "Max params data length:",
        maxResponse.data.transaction?.data?.length
      );
    }
  } catch (error) {
    console.error(
      "❌ Deep debug error:",
      error.response?.data || error.message
    );
  }
}

deepDebugMonorail();
