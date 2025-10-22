/**
 * Check aprMON Balance and Approval
 */

const { ethers } = require("ethers");

// ERC20 ABI for balanceOf and allowance
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

async function checkBalance() {
  console.log("💰 Checking aprMON Balance and Approval...\n");

  try {
    // Connect to Monad testnet
    const provider = new ethers.JsonRpcProvider(
      "https://testnet-rpc.monad.xyz"
    );

    const userAddress = "0x0f610d3473c92Ebd52E22F84be0F743ED938952a";
    const aprMONAddress = "0xb2f82d0f38dc453d596ad40a37799446cc89274a";
    const monorailContract = "0x525b929fcd6a64aff834f4eecc6e860486ced700"; // From transaction logs

    // Create contract instance
    const aprMONContract = new ethers.Contract(
      aprMONAddress,
      ERC20_ABI,
      provider
    );

    // Get token info
    const symbol = await aprMONContract.symbol();
    const decimals = await aprMONContract.decimals();

    // Get balance
    const balanceWei = await aprMONContract.balanceOf(userAddress);
    const balanceFormatted = ethers.formatUnits(balanceWei, decimals);

    // Get allowance for Monorail contract
    const allowanceWei = await aprMONContract.allowance(
      userAddress,
      monorailContract
    );
    const allowanceFormatted = ethers.formatUnits(allowanceWei, decimals);

    // Calculate required amount in wei
    const requiredAmount = "0.1";
    const requiredAmountWei = ethers.parseUnits(requiredAmount, decimals);

    console.log("📊 Token Analysis:");
    console.log(`  - Token: ${symbol}`);
    console.log(`  - Contract: ${aprMONAddress}`);
    console.log(`  - Decimals: ${decimals}`);
    console.log();

    console.log("💰 Balance Check:");
    console.log(`  - Your balance: ${balanceFormatted} ${symbol}`);
    console.log(`  - Required: ${requiredAmount} ${symbol}`);
    console.log(
      `  - Sufficient: ${
        parseFloat(balanceFormatted) >= parseFloat(requiredAmount) ? "✅" : "❌"
      }`
    );
    console.log();

    console.log("🔐 Approval Check:");
    console.log(`  - Monorail contract: ${monorailContract}`);
    console.log(`  - Current allowance: ${allowanceFormatted} ${symbol}`);
    console.log(`  - Required allowance: ${requiredAmount} ${symbol}`);
    console.log(
      `  - Approved: ${
        parseFloat(allowanceFormatted) >= parseFloat(requiredAmount)
          ? "✅"
          : "❌"
      }`
    );
    console.log();

    // Diagnosis
    console.log("🔍 Diagnosis:");
    if (parseFloat(balanceFormatted) < parseFloat(requiredAmount)) {
      console.log("❌ INSUFFICIENT BALANCE - You need more aprMON tokens");
      console.log(`   - You have: ${balanceFormatted} aprMON`);
      console.log(`   - You need: ${requiredAmount} aprMON`);
    } else if (parseFloat(allowanceFormatted) < parseFloat(requiredAmount)) {
      console.log(
        "❌ INSUFFICIENT APPROVAL - You need to approve the Monorail contract"
      );
      console.log("   - Solution: Call approve() function on aprMON contract");
      console.log(`   - Approve address: ${monorailContract}`);
      console.log(
        `   - Approve amount: ${requiredAmountWei.toString()} (${requiredAmount} ${symbol})`
      );
    } else {
      console.log("✅ Balance and approval are sufficient");
      console.log(
        "🔍 The issue must be in the smart contract logic or Monorail routing"
      );
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

checkBalance();
