/**
 * Analyze Failed Transaction
 */

const axios = require("axios");

async function analyzeFailedTx() {
  const txHash =
    "0x3330e1171fbbc8ae8c33cd20a7d1d202500855918bf9487babf939c4a351b570";

  console.log("🔍 Analyzing failed transaction:", txHash);
  console.log("🔗 Explorer:", `https://testnet.monadexplorer.com/tx/${txHash}`);

  // For now, just provide manual analysis guidance since we can't directly query Monad RPC
  console.log("\n📋 Manual Analysis Steps:");
  console.log("1. Open the explorer link above");
  console.log("2. Check transaction status (Success/Failed)");
  console.log("3. Look at gas usage vs gas limit");
  console.log("4. Check if it was a revert or out-of-gas");
  console.log(
    "5. Look at the input data to see if it matches expected swap calldata"
  );

  console.log("\n💡 Common Monad Testnet Issues:");
  console.log(
    "- High gas prices cause excessive burning (0.2 MON burned from 0.22 MON)"
  );
  console.log("- Legacy gasPrice parameter forces inefficient pricing");
  console.log("- Network congestion can cause price spikes");
  console.log("- Swap routes might be suboptimal");

  console.log("\n🔧 Fixes Applied:");
  console.log("✅ Removed manual gasPrice setting");
  console.log("✅ Let MetaMask handle EIP-1559 pricing");
  console.log("✅ Use exact Monorail gas estimates");
  console.log("✅ Added transaction validation");

  console.log("\n🧪 Next Test:");
  console.log(
    "Try a small swap (0.1 MON) and check if gas cost is now reasonable (<0.05 MON)"
  );
}

analyzeFailedTx();
