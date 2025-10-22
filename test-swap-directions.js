/**
 * Test Both Swap Directions
 * Compare MON→USDC (should have value) vs aprMON→MON (should be 0x0)
 */

const axios = require("axios");

async function testSwapDirections() {
  console.log("🔄 Testing Both Swap Directions...\n");

  try {
    // Test 1: MON → USDC (Native to ERC20 - should have value)
    console.log("📡 Test 1: MON → USDC (Native to ERC20)");
    const monToUSDC = await axios.post(
      "http://localhost:3000/api/swap/execute",
      {
        fromToken: "0x0000000000000000000000000000000000000000", // MON (native)
        toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC (ERC20)
        amount: "0.1",
        fromAddress: "0x0f610d3473c92Ebd52E22F84be0F743ED938952a",
        slippage: "0.5",
      }
    );

    console.log("  Result:");
    console.log("    - value:", monToUSDC.data.transaction?.value);
    console.log("    - expected: 0x16345785d8a0000 (0.1 MON in hex)");
    console.log(
      "    - correct:",
      monToUSDC.data.transaction?.value === "0x16345785d8a0000" ? "✅" : "❌"
    );

    // Test 2: aprMON → MON (ERC20 to Native - should be 0x0)
    console.log("\n📡 Test 2: aprMON → MON (ERC20 to Native)");
    const aprMONToMON = await axios.post(
      "http://localhost:3000/api/swap/execute",
      {
        fromToken: "0xb2f82d0f38dc453d596ad40a37799446cc89274a", // aprMON (ERC20)
        toToken: "0x0000000000000000000000000000000000000000", // MON (native)
        amount: "0.1",
        fromAddress: "0x0f610d3473c92Ebd52E22F84be0F743ED938952a",
        slippage: "0.5",
      }
    );

    console.log("  Result:");
    console.log("    - value:", aprMONToMON.data.transaction?.value);
    console.log("    - expected: 0x0 (no native tokens being sent)");
    console.log(
      "    - correct:",
      aprMONToMON.data.transaction?.value === "0x0" ? "✅" : "❌"
    );

    console.log("\n📋 Analysis:");
    if (monToUSDC.data.transaction?.value === "0x16345785d8a0000") {
      console.log("✅ Native→ERC20 swaps work correctly (value set properly)");
    } else {
      console.log("❌ Native→ERC20 swaps broken (value should not be 0x0)");
    }

    if (aprMONToMON.data.transaction?.value === "0x0") {
      console.log("✅ ERC20→Native swaps have correct value (0x0)");
      console.log("💡 The issue is NOT the transaction value!");
      console.log("🔍 Problem must be in:");
      console.log("   - ERC20 token approval");
      console.log("   - Insufficient aprMON balance");
      console.log("   - Smart contract logic error");
      console.log("   - Monorail routing issue");
    } else {
      console.log("❌ ERC20→Native swaps have wrong value (should be 0x0)");
    }
  } catch (error) {
    console.error("❌ Test error:", error.response?.data || error.message);
  }
}

testSwapDirections();
