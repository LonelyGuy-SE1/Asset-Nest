/**
 * Simulate Exact Transaction Execution
 * This helps debug the "Aggregate execution reverted" error
 */

async function simulateTransactionExecution() {
  console.log("🔍 Simulating Transaction Execution...\n");

  if (typeof window === "undefined" || !window.ethereum) {
    console.log("❌ This must be run in browser console with MetaMask");
    return;
  }

  // Test parameters - adjust these to match your failing transaction
  const testParams = {
    tokenIn: "0x0000000000000000000000000000000000000000", // MON
    tokenOut: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.1", // Small test amount
  };

  try {
    // Step 1: Get user address
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const userAddress = accounts[0];
    console.log("👤 User address:", userAddress);

    // Step 2: Check balance
    const balanceHex = await window.ethereum.request({
      method: "eth_getBalance",
      params: [userAddress, "latest"],
    });
    const balanceMON = parseInt(balanceHex, 16) / 1e18;
    console.log("💰 Current MON balance:", balanceMON.toFixed(4), "MON");

    if (balanceMON < parseFloat(testParams.amount)) {
      console.log("❌ Insufficient balance for test");
      return;
    }

    // Step 3: Get fresh quote from API
    console.log("\n📡 Getting fresh quote from API...");
    const response = await fetch("/api/swap/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromToken: testParams.tokenIn,
        toToken: testParams.tokenOut,
        amount: testParams.amount,
        fromAddress: userAddress,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error("❌ API Error:", data.error);
      return;
    }

    console.log("✅ Quote received");
    console.log("  - From:", testParams.amount, "MON");
    console.log("  - To:", data.toAmount, "USDC (estimated)");

    // Step 4: Prepare transaction with small gas buffer
    const transaction = data.transaction;
    const gasEstimate = parseInt(data.quote.estimatedGas);
    const gasWithBuffer = Math.floor(gasEstimate * 1.1); // 10% buffer

    const txParams = {
      from: userAddress,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
      gas: `0x${gasWithBuffer.toString(16)}`,
    };

    console.log("\n🚀 Transaction details:");
    console.log("  - Target contract:", txParams.to);
    console.log("  - Value (MON):", parseInt(transaction.value, 16) / 1e18);
    console.log("  - Gas limit:", gasWithBuffer);
    console.log("  - Calldata length:", transaction.data.length);

    // Step 5: Estimate gas first (to catch reverts before sending)
    console.log("\n🧪 Testing transaction with eth_estimateGas...");
    try {
      const estimatedGasHex = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [txParams],
      });
      const estimatedGas = parseInt(estimatedGasHex, 16);
      console.log("✅ Gas estimation successful:", estimatedGas);

      if (estimatedGas > gasWithBuffer) {
        console.log("⚠️ Estimated gas higher than limit, adjusting...");
        txParams.gas = `0x${Math.floor(estimatedGas * 1.1).toString(16)}`;
      }
    } catch (estimateError) {
      console.error("❌ Gas estimation failed (transaction would revert):");
      console.error("   Error:", estimateError.message);

      // Common revert reasons
      if (estimateError.message.includes("insufficient funds")) {
        console.log("💡 Likely cause: Insufficient MON balance");
      } else if (estimateError.message.includes("execution reverted")) {
        console.log("💡 Likely causes:");
        console.log("   - Slippage too high (price changed)");
        console.log("   - Swap route no longer available");
        console.log("   - Token allowance issues (shouldn't affect MON)");
        console.log("   - MEV protection triggered");
      }

      return;
    }

    // Step 6: Send transaction
    console.log("\n🎯 Sending transaction to MetaMask...");
    console.log(
      "Review the transaction carefully in MetaMask before confirming."
    );

    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });

    console.log("✅ Transaction sent:", txHash);
    console.log(
      "🔗 View on explorer: https://testnet.monadexplorer.com/tx/" + txHash
    );

    // Monitor transaction
    console.log("\n⏳ Monitoring transaction...");
    let attempts = 0;
    const maxAttempts = 30;

    const checkReceipt = async () => {
      if (attempts >= maxAttempts) {
        console.log("⏰ Timeout waiting for transaction");
        return;
      }

      try {
        const receipt = await window.ethereum.request({
          method: "eth_getTransactionReceipt",
          params: [txHash],
        });

        if (receipt) {
          if (receipt.status === "0x1") {
            console.log("🎉 Transaction successful!");
            console.log("   Gas used:", parseInt(receipt.gasUsed, 16));
            console.log("   Block:", parseInt(receipt.blockNumber, 16));
          } else {
            console.log("❌ Transaction failed on blockchain");
            console.log('   This confirms the "execution reverted" error');
            console.log("   Check the explorer link for more details");
          }
        } else {
          attempts++;
          setTimeout(checkReceipt, 2000);
        }
      } catch (error) {
        console.error("Error checking receipt:", error);
      }
    };

    checkReceipt();
  } catch (error) {
    console.error("❌ Simulation error:", error);
  }
}

// Instructions for use
console.log("📋 To run this simulation:");
console.log("1. Open browser console on your app");
console.log("2. Paste this entire script");
console.log("3. Run: simulateTransactionExecution()");
console.log("4. Follow the prompts and check MetaMask");

// Export for manual use
if (typeof window !== "undefined") {
  window.simulateTransactionExecution = simulateTransactionExecution;
}
