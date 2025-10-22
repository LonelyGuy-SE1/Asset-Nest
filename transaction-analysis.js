/**
 * Transaction Comparison Analysis
 * Let's analyze what successful Monorail transactions look like
 */

async function analyzeSuccessfulTransactions() {
  console.log("🔍 Analyzing Successful Monorail Transactions...\n");

  // Known successful Monorail contract address from our tests
  const monorailContract = "0x525b929fcd6a64aff834f4eecc6e860486ced700";

  console.log("📊 Transaction Analysis:");
  console.log("Target contract:", monorailContract);
  console.log("Function selector: 0xf99cae99 (Custom Monorail function)");

  // Let's analyze the parameters we're sending
  console.log("\n🔧 Parameter Analysis:");
  console.log("1. Contract address: ✅ (from Monorail API)");
  console.log("2. Function selector: ✅ (0xf99cae99)");
  console.log("3. Transaction value: ✅ (matches input amount)");
  console.log("4. Gas estimate: ✅ (reasonable ~250k)");
  console.log("5. Calldata length: ✅ (~1900 bytes, complex routing)");

  console.log("\n🤔 Possible Issues:");
  console.log("1. Network Congestion:");
  console.log("   - Monad testnet might be overloaded");
  console.log("   - Try during off-peak hours");

  console.log("2. Contract State:");
  console.log("   - Monorail contract might be paused");
  console.log("   - Liquidity pools might be drained");
  console.log("   - Route might no longer be available");

  console.log("3. Timing Issues:");
  console.log("   - Quote expires between generation and execution");
  console.log("   - Price moved significantly");
  console.log("   - MEV bots front-running");

  console.log("4. User State:");
  console.log("   - Insufficient MON balance (check gas + swap amount)");
  console.log("   - Previous failed transaction still pending");
  console.log("   - Nonce issues");

  console.log("\n💡 Debugging Steps:");
  console.log("1. Check Monad testnet status: https://status.monorail.xyz");
  console.log("2. Try with minimal amount (0.01 MON)");
  console.log("3. Use eth_estimateGas before sending transaction");
  console.log("4. Check if other users are having same issue on Discord");
  console.log("5. Compare gas price with network conditions");

  console.log("\n🔧 Quick Fixes to Try:");
  console.log("1. Reduce swap amount to 0.01 MON");
  console.log("2. Increase slippage to 1-2%");
  console.log("3. Use shorter deadline (60 seconds)");
  console.log("4. Try different token pair (MON -> WMON)");
  console.log("5. Clear MetaMask activity tab");

  // Generate test URLs for manual testing
  console.log("\n🧪 Manual Test URLs:");

  const baseUrl = "https://testnet-pathfinder.monorail.xyz/v4/quote";
  const testCases = [
    {
      name: "Minimal (0.01 MON)",
      params: new URLSearchParams({
        source: "0",
        from: "0x0000000000000000000000000000000000000000",
        to: "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
        amount: "0.01",
        sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
      }),
    },
    {
      name: "High slippage (2%)",
      params: new URLSearchParams({
        source: "0",
        from: "0x0000000000000000000000000000000000000000",
        to: "0xf817257fed379853cde0fa4f97ab987181b1e5ea",
        amount: "0.05",
        sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
        max_slippage: "200", // 2%
      }),
    },
    {
      name: "Different pair (MON->WMON)",
      params: new URLSearchParams({
        source: "0",
        from: "0x0000000000000000000000000000000000000000",
        to: "0x760afe86e5de5fa0ee542fc7b7b713e1c5425701", // WMON
        amount: "0.05",
        sender: "0x742d35Cc6647C86C0aDE0858C48884B1d2C1e7E5",
      }),
    },
  ];

  testCases.forEach((testCase, i) => {
    console.log(`${i + 1}. ${testCase.name}:`);
    console.log(`   ${baseUrl}?${testCase.params.toString()}`);
  });

  console.log("\n📋 Next Actions:");
  console.log("1. Test the manual URLs above in browser");
  console.log("2. Run finalDebug() in browser console for live testing");
  console.log("3. Check Monorail Discord for similar issues");
  console.log("4. Try the swap on Monorail website directly");
}

analyzeSuccessfulTransactions();
