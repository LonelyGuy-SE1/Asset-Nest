/**
 * Debug Transaction Execution Format
 * Check exactly how we're sending the transaction to MetaMask
 */

async function debugTransactionExecution() {
  console.log("🔍 Debugging Transaction Execution Format...\n");

  if (typeof window === "undefined" || !window.ethereum) {
    console.log("❌ Run this in browser console with MetaMask");
    return;
  }

  try {
    // Get user address
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const userAddress = accounts[0];
    console.log("👤 User address:", userAddress);

    // Get a fresh quote from our API
    console.log("\n📡 Getting quote from our API...");
    const response = await fetch("/api/swap/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromToken: "0x0000000000000000000000000000000000000000", // MON
        toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
        amount: "0.01", // Small amount
        fromAddress: userAddress,
        slippage: "0.5",
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error("❌ API Error:", data);
      return;
    }

    const transaction = data.transaction;
    console.log("✅ Transaction received from API");

    // Analyze the transaction object
    console.log("\n🔍 Transaction Analysis:");
    console.log("Raw transaction object:", transaction);
    console.log("Object keys:", Object.keys(transaction));
    console.log("Value type:", typeof transaction.value);
    console.log("Value:", transaction.value);
    console.log("Data type:", typeof transaction.data);
    console.log("Data length:", transaction.data?.length);

    // Check value formatting
    const valueWei = parseInt(transaction.value, 16);
    const valueMON = valueWei / 1e18;
    console.log("\nValue analysis:");
    console.log("  - Raw value:", transaction.value);
    console.log("  - Parsed wei:", valueWei);
    console.log("  - MON amount:", valueMON);
    console.log("  - Expected MON:", 0.01);
    console.log(
      "  - Values match:",
      Math.abs(valueMON - 0.01) < 0.0001 ? "✅" : "❌"
    );

    // Create transaction exactly like our frontend does
    const gasEstimate = parseInt(data.quote.estimatedGas);
    const gasWithBuffer = Math.floor(gasEstimate * 1.1);

    const txParams = {
      from: userAddress,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      gas: `0x${gasWithBuffer.toString(16)}`,
    };

    console.log("\n🚀 Transaction Parameters:");
    console.log("Complete txParams object:", JSON.stringify(txParams, null, 2));

    // Validate all fields
    console.log("\n✅ Validation:");
    console.log("  - from (user):", txParams.from ? "✅" : "❌");
    console.log("  - to (contract):", txParams.to ? "✅" : "❌");
    console.log(
      "  - data (calldata):",
      txParams.data && txParams.data !== "0x" ? "✅" : "❌"
    );
    console.log(
      "  - value (hex):",
      txParams.value && txParams.value.startsWith("0x") ? "✅" : "❌"
    );
    console.log(
      "  - gas (hex):",
      txParams.gas && txParams.gas.startsWith("0x") ? "✅" : "❌"
    );

    // Check for common formatting issues
    console.log("\n🔍 Format Checks:");

    // Check if value is properly hex encoded
    try {
      const testValue = parseInt(txParams.value, 16);
      console.log("  - Value hex valid:", !isNaN(testValue) ? "✅" : "❌");
    } catch (e) {
      console.log("  - Value hex valid: ❌");
    }

    // Check if gas is properly hex encoded
    try {
      const testGas = parseInt(txParams.gas, 16);
      console.log(
        "  - Gas hex valid:",
        !isNaN(testGas) && testGas > 0 ? "✅" : "❌"
      );
    } catch (e) {
      console.log("  - Gas hex valid: ❌");
    }

    // Check data format
    console.log(
      "  - Data hex format:",
      txParams.data.startsWith("0x") ? "✅" : "❌"
    );
    console.log(
      "  - Data length reasonable:",
      txParams.data.length > 10 && txParams.data.length < 10000 ? "✅" : "❌"
    );

    // Test gas estimation before sending
    console.log("\n⚡ Testing gas estimation...");
    try {
      const estimatedGasHex = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [txParams],
      });

      const estimatedGas = parseInt(estimatedGasHex, 16);
      console.log("✅ Gas estimation successful:", estimatedGas);
      console.log("  - Our gas limit:", parseInt(txParams.gas, 16));
      console.log("  - Network estimate:", estimatedGas);
      console.log(
        "  - Sufficient gas:",
        parseInt(txParams.gas, 16) >= estimatedGas ? "✅" : "❌"
      );

      // If gas estimation succeeds, transaction should work
      console.log("\n💡 Gas estimation passed - transaction should succeed");
      console.log("🚀 Ready to send transaction? (check MetaMask carefully)");

      // Optionally send the transaction
      const proceed = confirm("Send the transaction now?");
      if (proceed) {
        console.log("📤 Sending transaction...");
        const txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [txParams],
        });

        console.log("✅ Transaction sent:", txHash);
        console.log("🔗 View: https://testnet.monadexplorer.com/tx/" + txHash);

        // Monitor result
        setTimeout(async () => {
          try {
            const receipt = await window.ethereum.request({
              method: "eth_getTransactionReceipt",
              params: [txHash],
            });

            if (receipt) {
              if (receipt.status === "0x1") {
                console.log("🎉 TRANSACTION SUCCESSFUL!");
              } else {
                console.log("❌ Transaction failed on blockchain");
                console.log("Status:", receipt.status);
              }
            }
          } catch (e) {
            console.log("⏳ Transaction still pending...");
          }
        }, 5000);
      }
    } catch (gasError) {
      console.error("❌ Gas estimation failed:", gasError);
      console.log("\n🔍 Analyzing gas estimation error...");

      const errorMsg = gasError.message.toLowerCase();
      if (errorMsg.includes("insufficient funds")) {
        console.log(
          "💡 Issue: Insufficient balance (need more MON for gas + swap)"
        );
      } else if (errorMsg.includes("execution reverted")) {
        console.log("💡 Issue: Contract execution would revert");
        console.log("   Possible causes:");
        console.log("   - Wrong transaction data format");
        console.log("   - Contract state changed");
        console.log("   - Invalid function parameters");
      } else {
        console.log("💡 Issue: Unknown gas estimation error");
        console.log("   Raw error:", gasError);
      }
    }
  } catch (error) {
    console.error("❌ Debug error:", error);
  }
}

// Instructions
console.log("📋 Transaction Execution Debug");
console.log("1. Open browser console on your app");
console.log("2. Paste this script");
console.log("3. Run: debugTransactionExecution()");
console.log("4. This will test the exact transaction format");

if (typeof window !== "undefined") {
  window.debugTransactionExecution = debugTransactionExecution;
}
