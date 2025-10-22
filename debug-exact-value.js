/**
 * Debug Exact Issue
 * Check what Monorail is ACTUALLY returning for transaction.value
 */

const axios = require("axios");

async function debugExactValue() {
  console.log("🔍 Debugging EXACT Monorail Response...\n");

  try {
    const url = new URL("https://testnet-pathfinder.monorail.xyz/v4/quote");
    url.searchParams.set("source", "0");
    url.searchParams.set("from", "0x0000000000000000000000000000000000000000"); // MON
    url.searchParams.set("to", "0xf817257fed379853cde0fa4f97ab987181b1e5ea"); // USDC
    url.searchParams.set("amount", "0.1");
    url.searchParams.set(
      "sender",
      "0x0f610d3473c92Ebd52E22F84be0F743ED938952a"
    );

    console.log("📡 Raw Monorail API Call...");
    const response = await axios.get(url.toString());
    const result = response.data;

    console.log("🔍 Detailed Response Analysis:");
    console.log(
      "  Full transaction object:",
      JSON.stringify(result.transaction, null, 2)
    );

    console.log("\n🔍 Value Analysis:");
    console.log("  - result.transaction exists:", !!result.transaction);
    console.log(
      "  - result.transaction.value exists:",
      result.transaction.hasOwnProperty("value")
    );
    console.log(
      "  - result.transaction.value type:",
      typeof result.transaction?.value
    );
    console.log(
      "  - result.transaction.value value:",
      result.transaction?.value
    );
    console.log("  - Is falsy:", !result.transaction?.value);
    console.log("  - Is empty string:", result.transaction?.value === "");
    console.log("  - Is null:", result.transaction?.value === null);
    console.log("  - Is undefined:", result.transaction?.value === undefined);

    console.log("\n💡 Fix Analysis:");
    if (result.transaction?.value === "") {
      console.log(
        "❌ Monorail is returning empty string - need to handle this case"
      );
    } else if (
      result.transaction?.value === null ||
      result.transaction?.value === undefined
    ) {
      console.log(
        "❌ Monorail is returning null/undefined - need to calculate value"
      );
    } else if (result.transaction?.value === "0x0") {
      console.log(
        "❌ Monorail is returning 0x0 - need to override for native swaps"
      );
    } else {
      console.log("✅ Monorail value is correct:", result.transaction?.value);
    }

    // Test our || '0' logic
    const currentLogic = result.transaction?.value || "0";
    console.log("\n🔧 Current Logic Test:");
    console.log('  - result.transaction?.value || "0" =', currentLogic);

    if (currentLogic === "0") {
      console.log('❌ THIS IS THE BUG! Our || "0" is triggering');

      // Calculate correct value
      const expectedValueWei = BigInt(parseFloat("0.1") * 1e18);
      const expectedValueHex = "0x" + expectedValueWei.toString(16);

      console.log("\n🔧 Fix needed:");
      console.log("  - Expected value:", expectedValueHex);
      console.log("  - Need to detect native token swaps");
      console.log("  - Override empty/null values with swap amount");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

debugExactValue();
