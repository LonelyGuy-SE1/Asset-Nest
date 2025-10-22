/**
 * Check Current Network Gas Conditions
 */

async function checkGasConditions() {
  console.log("🔍 Checking Monad Testnet Gas Conditions...\n");

  if (typeof window !== "undefined" && window.ethereum) {
    try {
      // Get current gas price
      const gasPriceHex = await window.ethereum.request({
        method: "eth_gasPrice",
      });
      const gasPriceWei = parseInt(gasPriceHex, 16);
      const gasPriceGwei = gasPriceWei / 1e9;

      console.log("💰 Current Gas Price:");
      console.log(`  - ${gasPriceWei} wei`);
      console.log(`  - ${gasPriceGwei.toFixed(2)} gwei`);

      // Estimate cost for typical swap
      const typicalSwapGas = 250000; // Typical Monorail estimate
      const costWei = typicalSwapGas * gasPriceWei;
      const costMON = costWei / 1e18;

      console.log("\n💸 Estimated Swap Cost:");
      console.log(`  - Gas: ${typicalSwapGas} units`);
      console.log(`  - Cost: ${costMON.toFixed(6)} MON`);
      console.log(`  - Expensive: ${costMON > 0.1 ? "YES ⚠️" : "NO ✅"}`);

      // Recommendations
      if (costMON > 0.1) {
        console.log("\n⚠️ High Gas Alert:");
        console.log("- Network is congested");
        console.log("- Consider waiting for lower gas prices");
        console.log("- Use smaller amounts for testing");
      } else {
        console.log("\n✅ Gas looks reasonable");
      }
    } catch (error) {
      console.error("❌ Could not check gas conditions:", error);
    }
  } else {
    console.log("❌ No web3 provider found. Run this in browser console.");
  }
}

// Auto-run if in browser
if (typeof window !== "undefined") {
  checkGasConditions();
}

// Export for manual use
if (typeof module !== "undefined") {
  module.exports = { checkGasConditions };
}
