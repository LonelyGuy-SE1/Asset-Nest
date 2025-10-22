/**
 * Browser Console Test
 * Paste this into browser console while on the swap page
 */

console.log("🔍 Testing API Response in Browser...");

// Test the API directly from browser
fetch("/api/swap/execute", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    fromToken: "0x0000000000000000000000000000000000000000", // MON
    toToken: "0xf817257fed379853cde0fa4f97ab987181b1e5ea", // USDC
    amount: "0.1",
    fromAddress: "0x0f610d3473c92ebd52e22f84be0f743ed938952a",
    slippage: "0.5",
  }),
})
  .then((response) => response.json())
  .then((data) => {
    console.log("📡 Browser API Response:");
    console.log("  - success:", data.success);
    console.log("  - transaction.value:", data.transaction?.value);
    console.log("  - transaction.value type:", typeof data.transaction?.value);

    console.log("\n🔍 Full Response:");
    console.log(JSON.stringify(data, null, 2));

    if (data.transaction?.value === "0x0" || data.transaction?.value === "0") {
      console.log("\n❌ BROWSER API SHOWS WRONG VALUE!");
    } else {
      console.log("\n✅ Browser API value is correct");
    }

    // Test the exact destructuring that the frontend does
    const { transaction } = data;
    console.log("\n🔍 After Destructuring:");
    console.log("  - transaction.value:", transaction?.value);

    return data;
  })
  .catch((error) => {
    console.error("❌ Browser API Error:", error);
  });
