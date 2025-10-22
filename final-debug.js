/**
 * Final Debug - Check Contract and Allowance Issues
 */

async function finalDebug() {
  console.log("🔍 Final Debug - Contract & Allowance Check...\n");

  if (typeof window === "undefined" || !window.ethereum) {
    console.log("❌ Run this in browser console with MetaMask connected");
    return;
  }

  try {
    // Get user account
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const userAddress = accounts[0];
    console.log("👤 User address:", userAddress);

    // Check MON balance
    const balanceHex = await window.ethereum.request({
      method: "eth_getBalance",
      params: [userAddress, "latest"],
    });
    const balanceMON = parseInt(balanceHex, 16) / 1e18;
    console.log("💰 MON balance:", balanceMON.toFixed(4));

    // Get a fresh quote
    console.log("\n📡 Getting fresh quote...");
    const response = await fetch("/api/swap/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromToken: "0x0000000000000000000000000000000000000000", // MON
        toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
        amount: "0.05",
        fromAddress: userAddress,
        slippage: "0.5",
      }),
    });

    const data = await response.json();
    if (!data.success) {
      console.error("❌ API Error:", data);
      return;
    }

    console.log("✅ Quote received");
    const tx = data.transaction;

    // Prepare transaction with exact same format as working examples
    const txParams = {
      from: userAddress,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gas: `0x${Math.floor(parseInt(data.quote.estimatedGas) * 1.1).toString(
        16
      )}`, // 10% buffer
    };

    console.log("\n🧪 Pre-execution checks:");
    console.log("  - Balance sufficient:", balanceMON >= 0.05 ? "✅" : "❌");
    console.log("  - Transaction target:", txParams.to);
    console.log(
      "  - Transaction value (MON):",
      parseInt(txParams.value, 16) / 1e18
    );
    console.log("  - Gas limit:", parseInt(txParams.gas, 16));

    // CRITICAL: Test with eth_estimateGas FIRST
    console.log("\n⚡ Testing transaction with eth_estimateGas...");
    try {
      const estimatedGasHex = await window.ethereum.request({
        method: "eth_estimateGas",
        params: [txParams],
      });

      const estimatedGas = parseInt(estimatedGasHex, 16);
      console.log("✅ Gas estimation successful:", estimatedGas);

      // If gas estimation works, the transaction should work
      console.log("💡 Transaction should execute successfully");

      // Now try the actual transaction
      console.log("\n🚀 Sending transaction...");
      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      console.log("✅ Transaction sent:", txHash);
      console.log("🔗 View: https://testnet.monadexplorer.com/tx/" + txHash);

      // Monitor for success/failure
      let attempts = 0;
      const checkReceipt = async () => {
        if (attempts++ > 30) return; // timeout after 60 seconds

        try {
          const receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });

          if (receipt) {
            if (receipt.status === "0x1") {
              console.log("🎉 TRANSACTION SUCCESSFUL!");
              console.log("   Gas used:", parseInt(receipt.gasUsed, 16));
              console.log("   Block:", parseInt(receipt.blockNumber, 16));
            } else {
              console.log("❌ Transaction failed on blockchain");
              console.log("   Status:", receipt.status);
              console.log("   Gas used:", parseInt(receipt.gasUsed, 16));
            }
          } else {
            setTimeout(checkReceipt, 2000);
          }
        } catch (e) {
          setTimeout(checkReceipt, 2000);
        }
      };

      checkReceipt();
    } catch (gasError) {
      console.error("❌ Gas estimation failed (transaction would revert):");
      console.error("   Error message:", gasError.message);
      console.error("   Full error:", gasError);

      // Parse specific error reasons
      const errorMsg = gasError.message.toLowerCase();

      if (errorMsg.includes("insufficient funds")) {
        console.log("\n💡 DIAGNOSIS: Insufficient funds");
        console.log("   - Check MON balance vs required amount + gas");
      } else if (errorMsg.includes("execution reverted")) {
        console.log("\n💡 DIAGNOSIS: Contract execution reverted");
        console.log("   - Possible causes:");
        console.log("     • Slippage too high (price moved)");
        console.log("     • Route no longer available");
        console.log("     • Contract paused/disabled");
        console.log("     • MEV protection triggered");
      } else if (
        errorMsg.includes("invalid opcode") ||
        errorMsg.includes("out of gas")
      ) {
        console.log("\n💡 DIAGNOSIS: Gas or execution issue");
        console.log("   - Try increasing gas limit");
        console.log("   - Contract might have a bug");
      } else {
        console.log("\n💡 DIAGNOSIS: Unknown error");
        console.log("   - Check Monorail Discord for known issues");
        console.log("   - Try different token pair");
        console.log("   - Check network status");
      }
    }
  } catch (error) {
    console.error("❌ Final debug error:", error);
  }
}

// Instructions
console.log("📋 To run final debug:");
console.log("1. Open browser console on your app");
console.log("2. Paste this script");
console.log("3. Run: finalDebug()");
console.log("4. This will test the EXACT transaction flow");

if (typeof window !== "undefined") {
  window.finalDebug = finalDebug;
}
