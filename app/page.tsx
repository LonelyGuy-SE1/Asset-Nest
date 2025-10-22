"use client";

import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignTypedData,
  useChainId,
} from "wagmi";
import { useState, useEffect } from "react";
import axios from "axios";
import { privateKeyToAccount } from "viem/accounts";
import {
  getDeterministicAgentAddress,
  getDeterministicAgentPrivateKey,
} from "@/lib/utils/agent";
import {
  formatNumber,
  formatUSD,
  formatPercentage,
  formatTokenBalance,
} from "@/lib/utils/format";
import { formatTokenAmount } from "@/lib/monorail/swap";
import { activityLogger } from "@/lib/utils/activity-logger";
import { swapHistory } from "@/lib/utils/swap-history";
import { formatGasEstimate } from "@/lib/utils/gas-utils";
import { Modal, ConfirmModal, CopyButton } from "@/components/Modal";
import { getStoredDelegation } from "@/lib/smart-account/delegation";

// Extend Window interface for Ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

// Rebalance Timer Component
function RebalanceTimer({
  intervalHours,
  lastRebalanceTime,
  autoRebalanceEnabled,
  onAutoRebalance,
  isAutoRebalancing,
}: {
  intervalHours: number;
  lastRebalanceTime: Date | null;
  autoRebalanceEnabled: boolean;
  onAutoRebalance: () => Promise<void>;
  isAutoRebalancing: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isOverdue, setIsOverdue] = useState(false);
  const [hasTriggeredAutoRebalance, setHasTriggeredAutoRebalance] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      if (!lastRebalanceTime) {
        setTimeLeft("Manual trigger required");
        setIsOverdue(false);
        setHasTriggeredAutoRebalance(false);
        return;
      }

      const nextRebalance = new Date(
        lastRebalanceTime.getTime() + intervalHours * 60 * 60 * 1000
      );
      const now = new Date();
      const diff = nextRebalance.getTime() - now.getTime();

      if (diff <= 0) {
        setIsOverdue(true);
        
        if (autoRebalanceEnabled && !hasTriggeredAutoRebalance && !isAutoRebalancing) {
          setTimeLeft("Triggering auto-rebalance...");
          setHasTriggeredAutoRebalance(true);
          // Trigger auto rebalance
          onAutoRebalance().catch(console.error);
        } else if (isAutoRebalancing) {
          setTimeLeft("Auto-rebalancing in progress...");
        } else {
          setTimeLeft(autoRebalanceEnabled ? "Auto-rebalance ready" : "Manual rebalance needed");
        }
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      setIsOverdue(false);
      setHasTriggeredAutoRebalance(false);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [intervalHours, lastRebalanceTime, autoRebalanceEnabled, hasTriggeredAutoRebalance, isAutoRebalancing, onAutoRebalance]);

  return (
    <div>
      <p className={`font-mono ${isOverdue ? "text-red-400" : "text-cyan-400"}`}>
        Next rebalance: {timeLeft}
      </p>
      {autoRebalanceEnabled && (
        <p className="text-xs text-green-400 mt-1">
          🤖 Auto-rebalance enabled {isAutoRebalancing && "(running...)"}
        </p>
      )}
    </div>
  );
}

interface Holding {
  token: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  valueUSD: number;
  percentage: number;
  price: number;
  logo?: string;
  categories?: string[];
  pconf?: string;
  monValue?: string;
  monPerToken?: string;
}

interface Target {
  symbol: string;
  targetPercentage: number;
}

interface Trade {
  fromToken: string;
  toToken: string;
  fromSymbol: string;
  toSymbol: string;
  amount: string;
  reason: string;
}

interface Strategy {
  trades: Trade[];
  rationale: string;
  estimatedGas: string;
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { signTypedDataAsync } = useSignTypedData();
  const chainId = useChainId();

  const [mounted, setMounted] = useState(false);
  const [showHero, setShowHero] = useState(true);
  const [step, setStep] = useState<
    "delegation" | "portfolio" | "rebalance" | "swap" | "logs"
  >("delegation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lastRebalanceTime, setLastRebalanceTime] = useState<Date | null>(null);
  const [autoRebalanceEnabled, setAutoRebalanceEnabled] = useState(false);
  const [isAutoRebalancing, setIsAutoRebalancing] = useState(false);

  // Notification system
  const [notifications, setNotifications] = useState<
    Array<{
      id: string;
      type: "error" | "warning" | "info";
      title: string;
      message: string;
      timestamp: number;
    }>
  >([]);

  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [agentAddress, setAgentAddress] = useState("");
  const [delegationCreated, setDelegationCreated] = useState(false);
  const [delegationTimestamp, setDelegationTimestamp] = useState<number | null>(
    null
  );
  const [showDelegationDetails, setShowDelegationDetails] = useState(false);
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // Delegation parameters
  const [delegationParams, setDelegationParams] = useState({
    riskLevel: "medium", // "low", "medium", "high"
    rebalanceInterval: 24, // hours: 1, 4, 12, 24, 168 (week)
  });

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValueUSD, setTotalValueUSD] = useState(0);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);

  const [targets, setTargets] = useState<Target[]>([
    { symbol: "MON", targetPercentage: 40 },
    { symbol: "USDC", targetPercentage: 30 },
    { symbol: "USDT", targetPercentage: 20 },
    { symbol: "WETH", targetPercentage: 10 },
  ]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [selectedTrades, setSelectedTrades] = useState<number[]>([]);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<{
    isAnalyzing: boolean;
    result: any;
    showWindow: boolean;
  }>({
    isAnalyzing: false,
    result: null,
    showWindow: false,
  });

  // Swap state
  const [swapState, setSwapState] = useState<{
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    slippage: string;
    deadline: string;
    priority: string;
    quote: any;
    loadingQuote: boolean;
    allTokens: any[];
    loadingTokens: boolean;
    fromTokenSearch: string;
    toTokenSearch: string;
  }>({
    fromToken: "",
    toToken: "",
    fromAmount: "",
    toAmount: "",
    slippage: "0.5",
    deadline: "10",
    priority: "normal",
    quote: null,
    loadingQuote: false,
    allTokens: [],
    loadingTokens: false,
    fromTokenSearch: "",
    toTokenSearch: "",
  });

  // Portfolio search
  const [portfolioSearch, setPortfolioSearch] = useState("");

  // Notification management functions
  const addNotification = (
    type: "error" | "warning" | "info",
    title: string,
    message: string
  ) => {
    const id = Date.now().toString();
    setNotifications((prev) => [
      ...prev,
      {
        id,
        type,
        title,
        message,
        timestamp: Date.now(),
      },
    ]);

    // Auto-remove after 8 seconds for non-error notifications
    if (type !== "error") {
      setTimeout(() => {
        removeNotification(id);
      }, 8000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Fix hydration by only rendering after mount
  useEffect(() => {
    setMounted(true);
    // Load persisted smart account on mount
    if (address) {
      const persistedSmartAccount = localStorage.getItem(
        `smartAccount_${address}`
      );
      if (persistedSmartAccount) {
        setSmartAccountAddress(persistedSmartAccount);
      }
    }
  }, [address]);

  // Auto-proceed when wallet connects and set deterministic agent address
  useEffect(() => {
    if (isConnected && address && !smartAccountAddress && mounted) {
      activityLogger.success("WALLET", `Wallet connected: ${address}`);
      setShowHero(false);
      setStep("portfolio");
      addNotification(
        "info",
        "Wallet Connected",
        `${address.slice(0, 10)}...${address.slice(-6)}`
      );

      // Auto-fetch portfolio when wallet connects
      fetchPortfolio();

      // Set deterministic agent address immediately on connection
      const deterministicAgentAddr = getDeterministicAgentAddress(address);
      setAgentAddress(deterministicAgentAddr);
      activityLogger.info(
        "AGENT",
        `Agent address generated: ${deterministicAgentAddr}`
      );
    }
  }, [isConnected, address, mounted]);

  // Save smart account to localStorage when it changes
  useEffect(() => {
    if (smartAccountAddress && address) {
      localStorage.setItem(`smartAccount_${address}`, smartAccountAddress);
    }
  }, [smartAccountAddress, address]);

  // Check for existing delegation when agent address is set
  useEffect(() => {
    if (agentAddress && mounted) {
      const existingDelegation = getStoredDelegation(
        agentAddress as `0x${string}`
      );
      if (existingDelegation) {
        activityLogger.success(
          "DELEGATION",
          "Found existing delegation - skipping creation"
        );
        setDelegationCreated(true);
        setSuccess("Existing delegation found! Ready to rebalance.");
      }
    }
  }, [agentAddress, mounted]);

  // Handle disconnect - reset to hero page
  const handleDisconnect = () => {
    activityLogger.warning(
      "WALLET",
      "Disconnecting wallet and resetting app state"
    );
    disconnect();
    setShowHero(true);
    setStep("delegation");
    setSmartAccountAddress("");
    setAgentAddress("");
    setDelegationCreated(false);
    setDelegationTimestamp(null);
    setHoldings([]);
    setTotalValueUSD(0);
    setStrategy(null);
    setError("");
    setSuccess("");
  };

  // Handle revoke delegation
  const handleRevokeDelegation = async () => {
    if (!smartAccountAddress || !agentAddress) return;

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const response = await axios.post("/api/delegation/revoke", {
        smartAccountAddress,
        agentAddress,
      });

      setDelegationCreated(false);
      setDelegationTimestamp(null);
      setSuccess("Delegation revoked successfully! You can create a new one.");
    } catch (err: any) {
      console.error("Delegation revoke error:", err);
      setError(err.response?.data?.error || "Failed to revoke delegation");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSmartAccount = async () => {
    if (!address) return;

    activityLogger.info("SMART_ACCOUNT", "Creating MetaMask Smart Account...");
    setLoading(true);
    setError("");
    try {
      // Generate a deterministic private key from wallet address for demo
      // In production, use proper MetaMask SDK or hardware wallets
      // This creates a valid 32-byte private key by hashing the address
      const addressBytes = address.slice(2).toLowerCase();
      const paddedAddress = addressBytes.padEnd(64, "0");
      const demoPrivateKey = `0x${paddedAddress}`;

      // Validate the private key format
      if (demoPrivateKey.length !== 66) {
        throw new Error("Invalid private key format generated");
      }

      const response = await axios.post("/api/smart-account/create", {
        signerPrivateKey: demoPrivateKey,
      });

      setSmartAccountAddress(response.data.smartAccountAddress);
      activityLogger.success(
        "SMART_ACCOUNT",
        `Smart Account created: ${response.data.smartAccountAddress}`
      );
      setSuccess(
        `Smart Account created: ${response.data.smartAccountAddress.slice(
          0,
          10
        )}...`
      );

      // Generate deterministic agent address based on wallet address
      // This ensures the same wallet always gets the same agent address
      const deterministicAgentAddr = getDeterministicAgentAddress(address);
      setAgentAddress(deterministicAgentAddr);
    } catch (err: any) {
      console.error("Smart account creation error:", err);
      activityLogger.error(
        "SMART_ACCOUNT",
        "Failed to create smart account",
        err.message
      );
      setError(err.response?.data?.error || "Failed to create smart account");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDelegation = async () => {
    if (!smartAccountAddress || !agentAddress || !address) return;

    activityLogger.info(
      "DELEGATION",
      "Starting delegation creation process..."
    );
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Get the provider that was used for connection to avoid wallet conflicts
      const provider = connectors.find((c) => c.id === "injected")?.getProvider
        ? await connectors.find((c) => c.id === "injected")?.getProvider()
        : window.ethereum;

      if (!provider) {
        throw new Error("No wallet provider found");
      }

      // Validate chainId - must be on Monad testnet
      if (!chainId || chainId !== 10143) {
        activityLogger.warning(
          "NETWORK",
          `Wrong network detected (Chain ID: ${chainId}). Switching to Monad Testnet...`
        );
        setError(
          `Wrong network detected. Attempting to switch to Monad Testnet...`
        );

        try {
          // Try to switch to Monad Testnet using the same provider
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x279F" }], // 10143 in hex
          });
          activityLogger.success(
            "NETWORK",
            "Successfully switched to Monad Testnet"
          );

          // Wait a brief moment for the switch to complete
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Check if switch was successful
          const newChainId = await provider.request({
            method: "eth_chainId",
          });
          if (parseInt(newChainId, 16) === 10143) {
            // Continue with delegation creation
            setError("");
            setSuccess("Network switched successfully! Creating delegation...");
          } else {
            window.location.reload();
          }
        } catch (switchError: any) {
          if (switchError.code === 4902) {
            // Chain doesn't exist, add it
            try {
              await provider.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0x279F",
                    chainName: "Monad Testnet",
                    nativeCurrency: {
                      name: "MON",
                      symbol: "MON",
                      decimals: 18,
                    },
                    rpcUrls: ["https://testnet-rpc.monad.xyz"],
                    blockExplorerUrls: ["https://testnet.monadexplorer.com"],
                  },
                ],
              });
              setSuccess(
                "Monad Testnet added! Please try creating delegation again."
              );
            } catch (addError) {
              setError(
                "Failed to add Monad Testnet. Please add it manually in MetaMask."
              );
            }
          } else {
            setError("Please switch to Monad Testnet manually in MetaMask.");
          }
        }
        setLoading(false);
        return;
      }

      console.log("Creating delegation with MetaMask Delegation Toolkit...");
      console.log("Smart Account Address:", smartAccountAddress);
      console.log("Agent Address:", agentAddress);
      console.log("Chain ID:", chainId);

      setSuccess("Please sign the delegation in your wallet...");

      // Step 1: Create unsigned delegation with user parameters
      const delegationResponse = await axios.post("/api/delegation/create", {
        smartAccountAddress,
        agentAddress,
        userWalletAddress: address,
        type: "open",
        requestSignature: false, // Just create the delegation, don't sign yet
        // Include user-configured delegation parameters with proper type conversion
        riskLevel: String(delegationParams.riskLevel),
        rebalanceInterval: String(delegationParams.rebalanceInterval),
      });

      const unsignedDelegation = delegationResponse.data.delegation;

      setSuccess("Please sign the delegation message in MetaMask...");

      // Step 2: Ask user to sign the delegation via MetaMask
      if (!provider) {
        throw new Error("Wallet provider not found");
      }

      // Get the current chainId from the connected wallet to ensure it matches
      // Use the same provider that was used for connection
      const currentChainId = await provider.request({
        method: "eth_chainId",
      });
      const currentChainIdDecimal = parseInt(currentChainId, 16);

      console.log("Our chainId:", chainId);
      console.log("MetaMask chainId:", currentChainIdDecimal);

      if (currentChainIdDecimal !== chainId) {
        throw new Error(
          `Chain mismatch: Expected ${chainId}, got ${currentChainIdDecimal}. Please switch to Monad Testnet.`
        );
      }

      // Create the EIP-712 message for delegation signing
      const domain = {
        name: "MetaMask Delegation Toolkit",
        version: "1",
        chainId: currentChainIdDecimal, // Use the actual MetaMask chainId
        verifyingContract: "0x0000000000000000000000000000000000000000", // Delegation manager address
      };

      // Properly structured delegation authorization message
      const message = `ASSET NEST - Delegation Authorization

I hereby authorize the AI Agent to trade on my behalf with the following parameters:

DELEGATION DETAILS:
• Agent Address: ${unsignedDelegation.delegate}
• Smart Account: ${unsignedDelegation.delegator}
• Delegation Salt: ${unsignedDelegation.salt}

RESTRICTIONS:
• Risk Appetite: ${delegationParams.riskLevel.toUpperCase()}
• Rebalance Frequency: Every ${delegationParams.rebalanceInterval} hour${
        delegationParams.rebalanceInterval === 1 ? "" : "s"
      }
• Standard: ERC-7710 Delegation with Caveats

By signing this message, I grant permission for the AI agent to execute trades within these restrictions.`;

      console.log("Requesting signature for delegation authorization");

      // Use simple personal signature instead of typed data (more reliable)
      // Use the same provider that was used for connection
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });

      console.log("Signature received:", signature);

      // Step 3: Submit signed delegation
      const finalResponse = await axios.post("/api/delegation/sign", {
        delegation: unsignedDelegation,
        signature,
      });

      setDelegationCreated(true);
      setDelegationTimestamp(Date.now());
      activityLogger.success(
        "DELEGATION",
        "Delegation created! Agent is now authorized to trade."
      );
      addNotification(
        "info",
        "Delegation Created",
        "Agent is now authorized to trade from your wallet!"
      );

      // Auto-fetch portfolio
      await fetchPortfolio();
      setStep("portfolio");
    } catch (err: any) {
      console.error("Delegation creation error:", err);
      activityLogger.error(
        "DELEGATION",
        "Failed to create delegation",
        err.message
      );

      if (err.message?.includes("User rejected")) {
        setError("Signature rejected. Please approve in MetaMask to continue.");
      } else if (
        err.message?.includes("chainId") ||
        err.message?.includes("chain")
      ) {
        setError(
          "Chain ID mismatch. Please ensure you're connected to Monad Testnet (Chain ID: 10143) and try again."
        );
      } else if (err.code === 4902) {
        setError(
          "Monad Testnet not found in wallet. Please add it manually or try the 'Add Network' button."
        );
      } else if (err.code === -32002) {
        setError(
          "Please check MetaMask - there may be a pending request waiting for approval."
        );
      } else {
        setError(
          err.response?.data?.details ||
            err.response?.data?.error ||
            err.message ||
            "Failed to create delegation. Please check your wallet connection and network."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const [portfolioCache, setPortfolioCache] = useState<{
    address: string;
    data: any;
    timestamp: number;
  } | null>(null);

  // Background balance refresh after swaps
  const refreshBalancesInBackground = async (swapDetails?: {
    fromToken: string;
    toToken: string;
    amount: string;
  }) => {
    try {
      console.log("🔄 Refreshing balances in background...");

      // Don't show loading state - this runs silently
      const response = await axios.get(
        `/api/portfolio/balances?address=${address}&source=monorail`
      );

      if (response.data.success) {
        // Update holdings silently
        const freshHoldings = response.data.holdings;
        setHoldings(freshHoldings);
        setTotalValueUSD(response.data.totalValueUSD);

        // Update cache
        setPortfolioCache({
          address: address!,
          data: {
            holdings: freshHoldings,
            totalValueUSD: response.data.totalValueUSD,
          },
          timestamp: Date.now(),
        });

        // Log the refresh
        activityLogger.info(
          "PORTFOLIO",
          "Background refresh completed",
          `Updated balances for ${freshHoldings.length} tokens`
        );

        // If specific swap details provided, log the changes
        if (swapDetails) {
          const fromToken = freshHoldings.find(
            (h: any) =>
              h.address?.toLowerCase() === swapDetails.fromToken.toLowerCase()
          );
          const toToken = freshHoldings.find(
            (h: any) =>
              h.address?.toLowerCase() === swapDetails.toToken.toLowerCase()
          );

          if (fromToken || toToken) {
            console.log("📊 Post-swap balances updated:", {
              fromToken: fromToken
                ? `${fromToken.symbol}: ${fromToken.balance}`
                : "Not found",
              toToken: toToken
                ? `${toToken.symbol}: ${toToken.balance}`
                : "Not found",
            });
          }
        }
      }
    } catch (error) {
      console.warn("Background balance refresh failed:", error);
      // Don't show user error - this is background
    }
  };

  const fetchPortfolio = async (forceRefresh = false) => {
    // ALWAYS fetch from your wallet address (where your funds actually are)
    // The smart account is just for delegation, funds stay in your wallet
    const targetAddr = address; // Use wallet address, not smart account
    if (!targetAddr) return;

    // Check cache (valid for 30 seconds)
    const now = Date.now();
    if (
      !forceRefresh &&
      portfolioCache &&
      portfolioCache.address === targetAddr &&
      now - portfolioCache.timestamp < 30000
    ) {
      console.log("Using cached portfolio data");
      setHoldings(portfolioCache.data.holdings);
      setTotalValueUSD(portfolioCache.data.totalValueUSD);
      activityLogger.info("PORTFOLIO", "Loaded portfolio from cache");
      return;
    }

    activityLogger.info(
      "PORTFOLIO",
      `Fetching portfolio for wallet: ${targetAddr}`
    );
    setLoading(true);
    setError("");
    try {
      console.log("Fetching portfolio from wallet address:", targetAddr);
      console.log(
        "Smart account address (for delegation only):",
        smartAccountAddress
      );

      // Always try to fetch ALL tokens using Monorail auto-discovery
      const response = await axios.get(
        `/api/portfolio/balances?address=${targetAddr}&source=monorail`
      );

      setHoldings(response.data.holdings);
      setTotalValueUSD(response.data.totalValueUSD);

      // Cache the results
      setPortfolioCache({
        address: targetAddr,
        data: {
          holdings: response.data.holdings,
          totalValueUSD: response.data.totalValueUSD,
        },
        timestamp: now,
      });

      // Portfolio loaded successfully
      console.log(
        "Portfolio loaded with",
        response.data.holdings.length,
        "tokens"
      );

      const tokenCount =
        response.data.tokenCount || response.data.holdings?.length || 0;

      activityLogger.success(
        "PORTFOLIO",
        `Loaded ${tokenCount} tokens worth ${formatUSD(
          response.data.totalValueUSD
        )} via ${response.data.source}`
      );

      addNotification(
        "info",
        "Portfolio Loaded",
        `${tokenCount} tokens found in your wallet via ${
          response.data.source || "API"
        }`
      );

      console.log(
        `Portfolio loaded with ${tokenCount} tokens from wallet:`,
        response.data.holdings
      );
    } catch (err: any) {
      console.error("Portfolio fetch error:", err);
      activityLogger.error(
        "PORTFOLIO",
        "Failed to fetch portfolio",
        err.message
      );
      setError(err.response?.data?.error || "Failed to fetch portfolio");
    } finally {
      setLoading(false);
    }
  };

  const handleComputeStrategy = async () => {
    if (holdings.length === 0) {
      activityLogger.warning(
        "REBALANCE",
        "No holdings found - cannot compute strategy"
      );
      setError("No holdings found. Fund your wallet first.");
      return;
    }

    activityLogger.info("REBALANCE", "Getting AI portfolio analysis...");
    setLoading(true);
    setError("");

    // Start AI analysis window
    setAiAnalysis({ isAnalyzing: true, result: null, showWindow: true });
    try {
      const response = await axios.post("/api/rebalance/strategy", {
        holdings: holdings.map((h) => ({
          token: h.token,
          symbol: h.symbol,
          name: h.name,
          balance: h.balance,
          valueUSD: h.valueUSD,
          price: h.price,
          decimals: h.decimals,
          // Include full Monorail data
          pconf: h.pconf,
          categories: h.categories,
          logo: h.logo,
          monValue: h.monValue,
          monPerToken: h.monPerToken,
        })),
        // No targets - let AI decide optimal allocation
        autoAllocate: true,
        riskAppetite: delegationParams.riskLevel, // Pass user's risk appetite from delegation settings
      });

      setStrategy(response.data.strategy);

      // Initialize all trades as selected by default
      setSelectedTrades(
        Array.from(
          { length: response.data.strategy.trades.length },
          (_, i) => i
        )
      );

      // Update AI analysis with results
      setAiAnalysis({
        isAnalyzing: false,
        result: response.data.strategy,
        showWindow: true,
      });

      activityLogger.success(
        "REBALANCE",
        `AI analyzed portfolio and suggested ${response.data.strategy.trades.length} trades`
      );
      if (response.data.strategy.trades.length === 0) {
        addNotification(
          "info",
          "Portfolio Optimal",
          "AI analysis found your portfolio is already well-balanced. No trades needed."
        );
      } else {
        setSuccess(
          `AI suggested ${response.data.strategy.trades.length} optimal trades`
        );
      }
      setStep("rebalance");
    } catch (err: any) {
      console.error("Strategy error:", err);
      activityLogger.error(
        "REBALANCE",
        "Failed to get AI analysis",
        err.message
      );
      setError(err.response?.data?.error || "Failed to get AI analysis");

      // Update AI analysis with error
      setAiAnalysis({
        isAnalyzing: false,
        result: null,
        showWindow: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to execute individual swap from rebalancing
  const executeIndividualSwap = async (instruction: any) => {
    if (!address) throw new Error("Wallet not connected");

    console.log("Executing individual swap:", instruction);

    // Get quote using existing quote API
    const quoteResponse = await axios.get("/api/swap/quote", {
      params: {
        fromToken: instruction.fromToken,
        toToken: instruction.toToken,
        amount: instruction.amount,
        sender: address,
      },
    });

    if (!quoteResponse.data?.quote) {
      throw new Error("Failed to get swap quote");
    }

    const quote = quoteResponse.data.quote;

    // Execute using existing swap execute API
    const executeResponse = await axios.post("/api/swap/execute", {
      fromToken: instruction.fromToken,
      toToken: instruction.toToken,
      amount: instruction.amount,
      fromAddress: address,
      slippage: "0.5", // Use default slippage
    });

    if (!executeResponse.data?.transaction) {
      throw new Error("Failed to prepare swap transaction");
    }

    const transaction = executeResponse.data.transaction;

    // Send transaction via MetaMask
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from: address,
          to: transaction.to,
          data: transaction.data,
          value: transaction.value,
          gas: transaction.gasLimit,
        },
      ],
    });

    console.log(`Swap transaction sent: ${txHash}`);

    // Log the successful swap
    activityLogger.success(
      "REBALANCE",
      `Swapped ${instruction.amount} ${instruction.fromSymbol} → ${instruction.toSymbol}`
    );

    return txHash;
  };

  const handleExecuteRebalance = async () => {
    if (!strategy || !address || !smartAccountAddress) return;

    // Filter to only selected trades
    const tradesToExecute = strategy.trades.filter((_, index) =>
      selectedTrades.includes(index)
    );

    if (tradesToExecute.length === 0) {
      setError("No trades selected for execution");
      return;
    }

    activityLogger.info(
      "EXECUTE",
      `🚀 Executing ${tradesToExecute.length} selected trades via Smart Account Delegation...`
    );
    setLoading(true);
    setError("");

    try {
      // Generate deterministic agent private key for delegation
      const deterministicAgentPrivateKey =
        getDeterministicAgentPrivateKey(address);

      console.log("🤖 Using Smart Account Delegation for trade execution");
      console.log("Smart Account:", smartAccountAddress);
      console.log("Agent Address:", agentAddress);
      console.log("Trades to execute:", tradesToExecute.length);

      // Execute trades via smart account delegation
      const response = await axios.post("/api/rebalance/execute", {
        trades: tradesToExecute,
        smartAccountAddress: smartAccountAddress,
        delegatePrivateKey: deterministicAgentPrivateKey,
        executionMode: "batch", // Execute all trades in a single transaction
      });

      if (response.data.success) {
        console.log("✅ Smart Account execution successful!");
        console.log("User Operation Hash:", response.data.userOpHash);
        console.log("Transaction Hash:", response.data.transactionHash);

        activityLogger.success(
          "EXECUTE",
          `🎉 Rebalancing executed via Smart Account! User Op: ${response.data.userOpHash?.slice(
            0,
            10
          )}...`
        );

        let successMessage = `🎉 Successfully executed ${tradesToExecute.length} trades via Smart Account!`;
        if (response.data.transactionHash) {
          successMessage += ` TX: ${response.data.transactionHash.slice(
            0,
            10
          )}...`;
        } else if (response.data.userOpHash) {
          successMessage += ` UserOp: ${response.data.userOpHash.slice(
            0,
            10
          )}...`;
        }

        setSuccess(successMessage);

        // Log each trade for activity tracking
        tradesToExecute.forEach((trade, index) => {
          activityLogger.success(
            "REBALANCE",
            `✓ Trade ${index + 1}: ${trade.amount} ${trade.fromSymbol} → ${
              trade.toSymbol
            }`
          );
        });

        // Update last rebalance time
        setLastRebalanceTime(new Date());
        
        // Refresh portfolio after successful execution
        await fetchPortfolio();
      } else {
        throw new Error("Smart account execution failed");
      }
    } catch (err: any) {
      console.error("❌ Smart Account execution error:", err);

      // Provide user-friendly error messages
      let errorMessage = "Smart Account execution failed";

      if (err.response?.data?.details) {
        errorMessage = err.response.data.details;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Add helpful context for common issues
      if (errorMessage.includes("insufficient funds")) {
        errorMessage +=
          " Please ensure your Smart Account has enough MON tokens for gas fees.";
      } else if (errorMessage.includes("bundler")) {
        errorMessage += " Please check your Pimlico bundler configuration.";
      } else if (errorMessage.includes("delegation")) {
        errorMessage += " Please ensure delegation is properly set up.";
      }

      activityLogger.error(
        "EXECUTE",
        "❌ Smart Account execution failed",
        errorMessage
      );

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Auto-rebalance function that uses existing delegation
  const handleAutoRebalance = async () => {
    if (!delegationCreated || !address || !smartAccountAddress) {
      console.log("Auto-rebalance skipped: Missing delegation or account", {
        delegationCreated,
        hasAddress: !!address,
        hasSmartAccount: !!smartAccountAddress,
      });
      return;
    }

    // If no strategy exists, generate one first
    if (!strategy) {
      console.log("🤖 Auto-rebalance: Generating strategy first...");
      activityLogger.info(
        "AUTO_REBALANCE",
        "🤖 Generating rebalancing strategy for auto-execution..."
      );
      
      try {
        await handleComputeStrategy();
        // Wait a moment for strategy to be set
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if strategy was generated
        if (!strategy) {
          throw new Error("Failed to generate rebalancing strategy");
        }
      } catch (error) {
        console.error("Failed to generate strategy for auto-rebalance:", error);
        activityLogger.error(
          "AUTO_REBALANCE",
          "Failed to generate strategy for auto-rebalance",
          error instanceof Error ? error.message : "Unknown error"
        );
        return;
      }
    }

    console.log("🤖 Auto-rebalance triggered!");
    setIsAutoRebalancing(true);

    try {
      activityLogger.info(
        "AUTO_REBALANCE",
        "🤖 Auto-rebalance triggered - executing all suggested trades via delegation"
      );

      // Auto-select all trades for execution
      const allTradeIndexes = strategy.trades.map((_, index) => index);
      setSelectedTrades(allTradeIndexes);

      // Generate deterministic agent private key for delegation
      const deterministicAgentPrivateKey = getDeterministicAgentPrivateKey(address);

      console.log("🤖 Auto-executing all trades via Smart Account Delegation");
      console.log("Smart Account:", smartAccountAddress);
      console.log("Agent Address:", agentAddress);
      console.log("Total trades:", strategy.trades.length);

      // Execute ALL trades via smart account delegation (auto-mode)
      const response = await axios.post("/api/rebalance/execute", {
        trades: strategy.trades, // Execute ALL trades automatically
        smartAccountAddress: smartAccountAddress,
        delegatePrivateKey: deterministicAgentPrivateKey,
        executionMode: "batch",
      });

      if (response.data.success) {
        console.log("✅ Auto-rebalance execution successful!");

        activityLogger.success(
          "AUTO_REBALANCE",
          `🎉 Auto-rebalance completed! Executed ${strategy.trades.length} trades via Smart Account delegation`
        );

        let successMessage = `🤖 Auto-rebalance completed! Executed ${strategy.trades.length} trades.`;
        if (response.data.transactionHash) {
          successMessage += ` TX: ${response.data.transactionHash.slice(0, 10)}...`;
        }

        setSuccess(successMessage);

        // Update last rebalance time
        setLastRebalanceTime(new Date());

        // Refresh portfolio after successful execution
        await fetchPortfolio();

        // Clear the strategy since it's been executed
        setStrategy(null);
        setSelectedTrades([]);

      } else {
        throw new Error("Auto-rebalance execution failed");
      }

    } catch (err: any) {
      console.error("❌ Auto-rebalance error:", err);

      let errorMessage = "Auto-rebalance failed";
      if (err.response?.data?.details) {
        errorMessage = err.response.data.details;
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }

      activityLogger.error(
        "AUTO_REBALANCE",
        "❌ Auto-rebalance failed",
        errorMessage
      );

      setError(`Auto-rebalance failed: ${errorMessage}`);

    } finally {
      setIsAutoRebalancing(false);
    }
  };

  const updateTarget = (symbol: string, value: number) => {
    setTargets((prev) =>
      prev.map((t) =>
        t.symbol === symbol ? { ...t, targetPercentage: value } : t
      )
    );
  };

  // Load all available tokens for swapping
  const loadAllTokens = async () => {
    if (!address) return;

    setSwapState((prev) => ({ ...prev, loadingTokens: true }));
    try {
      const response = await axios.get(
        `/api/portfolio/discover-tokens?address=${address}`
      );

      activityLogger.success(
        "SWAP",
        `Loaded ${response.data.tokenCount} tokens for swapping (${response.data.userHoldingsCount} in your wallet)`
      );

      const tokens = response.data.tokens || [];
      console.log(`Received ${tokens.length} tokens from discover-tokens API`);

      setSwapState((prev) => ({
        ...prev,
        allTokens: tokens.length > 0 ? tokens : holdings, // Use holdings as fallback if no tokens returned
        loadingTokens: false,
      }));
    } catch (err: any) {
      console.error("Failed to load tokens:", err);
      activityLogger.error("SWAP", "Failed to load token list", err.message);
      setSwapState((prev) => ({
        ...prev,
        allTokens: holdings, // Fallback to user holdings only
        loadingTokens: false,
      }));
    }
  };

  // Load tokens when entering swap page
  useEffect(() => {
    if (step === "swap" && address && swapState.allTokens.length === 0) {
      loadAllTokens();
    }
  }, [step, address]);

  // Swap handlers
  const fetchSwapQuote = async (
    fromToken: string,
    toToken: string,
    amount: string
  ) => {
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) return;

    setSwapState((prev) => ({ ...prev, loadingQuote: true }));
    try {
      // Get from token decimals for WEI conversion
      const fromTokenData = swapState.allTokens.find(
        (t: any) => t.address === fromToken
      );
      const fromDecimals = fromTokenData?.decimals || 18;

      const response = await axios.get(
        `/api/swap/quote?fromToken=${fromToken}&toToken=${toToken}&amount=${amount}&slippage=${swapState.slippage}&sender=${address}&decimals=${fromDecimals}`
      );

      // Monorail returns output_formatted which is human-readable
      const toAmount = response.data.toAmount || "0";

      console.log("Quote received:", {
        fromAmount: amount,
        toAmount,
        exchangeRate: response.data.exchangeRate,
        priceImpact: response.data.priceImpact,
      });

      setSwapState((prev) => ({
        ...prev,
        quote: response.data.quote,
        toAmount: toAmount,
        loadingQuote: false,
      }));
    } catch (err: any) {
      console.error("Quote fetch error:", err);
      setError(err.response?.data?.error || "Failed to fetch quote");
      setSwapState((prev) => ({ ...prev, loadingQuote: false }));
    }
  };

  const handleExecuteSwap = async () => {
    if (
      !address ||
      !swapState.fromToken ||
      !swapState.toToken ||
      !swapState.fromAmount
    ) {
      setError("Please select tokens and enter amount");
      return;
    }

    let swapRecord: any = null;

    activityLogger.info(
      "SWAP",
      `Preparing swap: ${swapState.fromAmount} tokens...`
    );
    setLoading(true);
    setError("");

    try {
      // Get token decimals for proper conversion to WEI
      const fromTokenData = swapState.allTokens.find(
        (t: any) => t.address === swapState.fromToken
      );
      const fromTokenDecimals = fromTokenData?.decimals || 18;

      // Check if we need to approve ERC20 tokens (not needed for native MON)
      const isFromTokenNative =
        swapState.fromToken === "0x0000000000000000000000000000000000000000";

      if (!isFromTokenNative) {
        activityLogger.info("SWAP", "Checking token approval...");

        // Import approval functions
        const { checkTokenApproval, approveToken, waitForTransaction } =
          await import("@/lib/utils/token-approval");

        // Check if approval is needed
        const monorailContractAddress =
          "0x525b929fcd6a64aff834f4eecc6e860486ced700"; // From transaction logs

        const approvalCheck = await checkTokenApproval(
          swapState.fromToken as `0x${string}`,
          address as `0x${string}`,
          monorailContractAddress,
          swapState.fromAmount,
          fromTokenDecimals
        );

        if (approvalCheck.isApprovalNeeded) {
          activityLogger.info(
            "SWAP",
            `Requesting approval for ${swapState.fromAmount} tokens...`
          );
          setError("Please approve token spending in MetaMask...");

          const approveTxHash = await approveToken(
            swapState.fromToken as `0x${string}`,
            monorailContractAddress,
            approvalCheck.approvalAmountWei
          );

          activityLogger.info("SWAP", "Waiting for approval confirmation...");
          setError("Waiting for approval confirmation...");

          const approvalSuccess = await waitForTransaction(approveTxHash);
          if (!approvalSuccess) {
            throw new Error("Token approval failed");
          }

          activityLogger.info("SWAP", "✅ Token approval confirmed!");
          setError("");
        } else {
          activityLogger.info("SWAP", "✅ Token already approved");
        }
      }

      // Get the prepared transaction from API
      const response = await axios.post("/api/swap/execute", {
        fromToken: swapState.fromToken,
        toToken: swapState.toToken,
        amount: swapState.fromAmount,
        fromAddress: address,
        slippage: swapState.slippage,
        decimals: fromTokenDecimals, // Pass decimals for proper WEI conversion
      });

      const { transaction } = response.data;

      if (!transaction) {
        throw new Error("No transaction data received from API");
      }

      if (!transaction.to || !transaction.data || transaction.data === "0x") {
        throw new Error(
          "Invalid transaction data from Monorail. Missing calldata or target address."
        );
      }

      console.log("Transaction validation:", {
        to: transaction.to,
        dataLength: transaction.data?.length || 0,
        value: transaction.value,
        hasCalldata: transaction.data && transaction.data !== "0x",
      });

      // Get token symbols for logging
      const fromTokenSymbol =
        swapState.allTokens.find((t: any) => t.address === swapState.fromToken)
          ?.symbol || "Unknown";
      const toTokenSymbol =
        swapState.allTokens.find((t: any) => t.address === swapState.toToken)
          ?.symbol || "Unknown";

      activityLogger.info(
        "SWAP",
        "Sending transaction to wallet for approval..."
      );

      // Send transaction to user's wallet using window.ethereum
      if (!window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask.");
      }

      // Use Monorail's gas estimate directly - no buffer needed
      const gasEstimate = response.data.quote?.estimatedGas;
      const finalGasLimit = gasEstimate ? parseInt(gasEstimate) : 200000;

      // Get current gas price to calculate actual cost
      let actualGasPriceWei = 1e9; // Default 1 gwei
      try {
        const gasPriceHex = await window.ethereum.request({
          method: "eth_gasPrice",
        });
        actualGasPriceWei = parseInt(gasPriceHex, 16);
      } catch (e) {
        console.warn("Could not get gas price, using default 1 gwei");
      }

      const actualGasPriceGwei = actualGasPriceWei / 1e9;
      const estimatedCostWei = finalGasLimit * actualGasPriceWei;
      const estimatedCostMON = estimatedCostWei / 1e18;

      console.log("Gas estimate:", {
        gasLimit: finalGasLimit,
        gasPriceGwei: actualGasPriceGwei.toFixed(2),
        estimatedCostMON: estimatedCostMON.toFixed(4),
        isExpensive: estimatedCostMON > 0.1,
      });

      // Use Monorail's exact gas estimate - no buffer
      // Monorail provides accurate estimates, extra gas might cause issues
      const txParams: any = {
        from: address,
        to: transaction.to,
        data: transaction.data,
        value: transaction.value,
        gas: `0x${finalGasLimit.toString(16)}`,
        // Let MetaMask handle gas pricing (EIP-1559)
      };

      // Validate transaction format before sending
      if (!transaction.value.startsWith("0x")) {
        throw new Error(
          `Invalid transaction value format: ${transaction.value}`
        );
      }

      if (!transaction.data.startsWith("0x")) {
        throw new Error(`Invalid transaction data format: ${transaction.data}`);
      }

      console.log("Transaction params:", {
        to: txParams.to,
        value: txParams.value,
        valueWei: transaction.value,
        valueMON: parseInt(transaction.value, 16) / 1e18,
        gasLimit: finalGasLimit,
        exactGasFromMonorail: true,
        gasPricingModel: "EIP-1559 (MetaMask managed)",
        dataLength: transaction.data?.length || 0,
      });

      activityLogger.info(
        "SWAP",
        `Gas: ${formatGasEstimate(finalGasLimit)} (EIP-1559 pricing by wallet)`
      );

      // Check user balance before transaction
      try {
        const balanceHex = await window.ethereum.request({
          method: "eth_getBalance",
          params: [address, "latest"],
        });
        const balanceMON = parseInt(balanceHex, 16) / 1e18;
        const requiredMON = parseInt(transaction.value, 16) / 1e18;

        console.log("Balance check:", {
          userBalance: balanceMON.toFixed(4) + " MON",
          required: requiredMON.toFixed(4) + " MON",
          sufficient: balanceMON >= requiredMON,
        });

        if (balanceMON < requiredMON) {
          throw new Error(
            `Insufficient MON balance. Need ${requiredMON.toFixed(
              4
            )} MON, have ${balanceMON.toFixed(4)} MON`
          );
        }
      } catch (balanceError) {
        console.warn("Could not check balance:", balanceError);
      }

      // Record swap initiation
      swapRecord = swapHistory.addSwap({
        fromToken: swapState.fromToken,
        toToken: swapState.toToken,
        fromSymbol: fromTokenSymbol,
        toSymbol: toTokenSymbol,
        fromAmount: swapState.fromAmount,
        toAmount: response.data.toAmount || "0",
        status: "pending",
        type: "manual",
        notes: `Gas estimate: ${formatGasEstimate(finalGasLimit)}`,
      });

      // CRITICAL: Test transaction with eth_estimateGas before sending
      try {
        activityLogger.info(
          "SWAP",
          "Testing transaction with gas estimation..."
        );

        const estimatedGasHex = await window.ethereum.request({
          method: "eth_estimateGas",
          params: [txParams],
        });

        const networkEstimate = parseInt(estimatedGasHex, 16);
        console.log("Gas estimation result:", {
          monorailEstimate: finalGasLimit,
          networkEstimate: networkEstimate,
          estimationPassed: true,
        });

        // If network needs more gas, use that
        if (networkEstimate > finalGasLimit) {
          txParams.gas = `0x${networkEstimate.toString(16)}`;
          console.log(
            "Updated gas limit to network estimate:",
            networkEstimate
          );
        }
      } catch (gasError) {
        console.error(
          "Gas estimation failed - transaction would revert:",
          gasError
        );
        throw new Error(
          `Transaction would fail: ${
            (gasError as Error).message || "Gas estimation failed"
          }`
        );
      }

      const txHash = await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [txParams],
      });

      activityLogger.success(
        "SWAP",
        `Transaction submitted! ${swapState.fromAmount} ${fromTokenSymbol} → ${response.data.toAmount} ${toTokenSymbol}`,
        `TX: ${txHash}`
      );

      // Wait for transaction confirmation
      activityLogger.info("SWAP", "Waiting for transaction confirmation...");

      // Check transaction status after a delay
      setTimeout(async () => {
        try {
          const receipt = await window.ethereum.request({
            method: "eth_getTransactionReceipt",
            params: [txHash],
          });

          if (receipt) {
            if (receipt.status === "0x1") {
              activityLogger.success(
                "SWAP",
                "Transaction confirmed successfully!"
              );
            } else {
              activityLogger.error(
                "SWAP",
                "Transaction failed on blockchain",
                `TX: ${txHash}`
              );
            }
          }
        } catch (receiptError) {
          console.log("Could not check receipt:", receiptError);
        }
      }, 5000); // Check after 5 seconds

      // Transaction completed successfully
      if (txHash) {
        console.log("Swap transaction indexed:", txHash);
      }

      addNotification(
        "info",
        "Swap Executed",
        `${swapState.fromAmount} ${fromTokenSymbol} → ${
          response.data.toAmount
        } ${toTokenSymbol}${txHash ? ` | TX: ${txHash.slice(0, 10)}...` : ""}`
      );

      // Background refresh portfolio balances without affecting user flow
      refreshBalancesInBackground({
        fromToken: swapState.fromToken,
        toToken: swapState.toToken,
        amount: swapState.fromAmount,
      });

      // Update swap record with success and transaction hash
      swapHistory.updateSwap(swapRecord.id, {
        status: "success",
        txHash: txHash || undefined,
        notes: `Completed successfully. Gas used: ${formatGasEstimate(
          finalGasLimit
        )}`,
      });

      // Reset swap form
      setSwapState({
        fromToken: "",
        toToken: "",
        fromAmount: "",
        toAmount: "",
        slippage: "0.5",
        deadline: "10",
        priority: "normal",
        quote: null,
        loadingQuote: false,
        allTokens: swapState.allTokens, // Keep token list after swap
        loadingTokens: false,
        fromTokenSearch: "",
        toTokenSearch: "",
      });
    } catch (err: any) {
      console.error("Swap execution error:", err);

      // Update swap record with failure
      if (swapRecord) {
        swapHistory.updateSwap(swapRecord.id, {
          status: "failed",
          notes: `Failed: ${err.response?.data?.details || err.message}`,
        });
      }

      activityLogger.error(
        "SWAP",
        "Failed to execute swap",
        err.response?.data?.details || err.message
      );

      // Use notification instead of error state
      addNotification(
        "error",
        "Swap Failed",
        err.response?.data?.details ||
          err.response?.data?.error ||
          err.message ||
          "Swap execution failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch quote when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (swapState.fromToken && swapState.toToken && swapState.fromAmount) {
        fetchSwapQuote(
          swapState.fromToken,
          swapState.toToken,
          swapState.fromAmount
        );
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [
    swapState.fromToken,
    swapState.toToken,
    swapState.fromAmount,
    swapState.slippage,
  ]);

  // Use our improved formatting functions instead of the basic formatValue
  // These handle large numbers, scientific notation, and proper decimal places

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="card vscode-error fade-in">
          <div className="flex items-center">
            <span className="status-dot status-error"></span>
            <span className="text-white">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="card vscode-success fade-in">
          <div className="flex items-center">
            <span className="status-dot status-success"></span>
            <span className="text-white font-bold">{success}</span>
          </div>
        </div>
      )}

      {/* Notification Bars */}
      <div className="fixed top-20 right-4 space-y-2 z-50 max-w-md">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`p-4 rounded-lg border-2 shadow-lg backdrop-blur-sm transition-all duration-300 fade-in ${
              notification.type === "error"
                ? "bg-red-500/20 border-red-500 shadow-red-500/30"
                : notification.type === "warning"
                ? "bg-yellow-500/20 border-yellow-500 shadow-yellow-500/30"
                : "bg-green-500/20 border-green-500 shadow-green-500/30"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <h4
                  className={`font-bold font-mono text-sm ${
                    notification.type === "error"
                      ? "text-red-500"
                      : notification.type === "warning"
                      ? "text-yellow-500"
                      : "text-green-500"
                  }`}
                >
                  {notification.title}
                </h4>
                <p className="text-white text-sm mt-1 font-mono">
                  {notification.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className={`text-gray-300 hover:text-white transition-colors text-lg font-bold ${
                  notification.type === "error"
                    ? "hover:text-red-500"
                    : notification.type === "warning"
                    ? "hover:text-yellow-500"
                    : "hover:text-green-500"
                }`}
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Hero Landing Page */}
      {showHero && (
        <div className="min-h-[80vh] flex items-center justify-center fade-in">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Logo & Title */}
            <div className="space-y-4">
              <div className="flex justify-center mb-6">
                <img
                  src="/assetnestfinal.png"
                  alt="Asset Nest Logo"
                  className="h-24 w-auto"
                />
              </div>
              <h1
                className="text-7xl font-bold neon-text mb-4"
                style={{
                  textShadow:
                    "0 0 20px rgba(0,255,247,0.8), 0 0 40px rgba(0,255,247,0.5)",
                }}
              >
                ASSET NEST
              </h1>
              <p className="text-3xl font-bold text-white mb-2">
                AI-Powered Portfolio Rebalancer
              </p>
              <p className="text-xl text-gray-300">
                Autonomous portfolio management on Monad using MetaMask Smart
                Accounts
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
              <div className="bg-black border-2 border-cyan-400 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,247,0.3)]">
                <div className="mb-3 flex justify-center">
                  <img src="/agent.png" alt="AI Agent" className="w-12 h-12" />
                </div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">
                  AI Agent
                </h3>
                <p className="text-gray-300 text-sm">
                  Intelligent rebalancing strategies powered by advanced AI
                  algorithms
                </p>
              </div>

              <div className="bg-black border-2 border-orange-400 rounded-lg p-6 shadow-[0_0_20px_rgba(251,146,60,0.3)]">
                <div className="mb-3 flex justify-center">
                  <img
                    src="/MetaMask-icon-fox-developer.svg"
                    alt="MetaMask"
                    className="w-12 h-12"
                  />
                </div>
                <h3 className="text-xl font-bold text-orange-400 mb-2">
                  Smart Accounts
                </h3>
                <p className="text-gray-300 text-sm">
                  Gasless transactions with MetaMask Delegation Toolkit
                  (ERC-4337)
                </p>
              </div>

              <div className="bg-black border-2 border-purple-400 rounded-lg p-6 shadow-[0_0_20px_rgba(191,0,255,0.3)]">
                <div className="mb-3 flex justify-center">
                  <img
                    src="/66c3711574e166ac115bba8a_Logo Mark.svg"
                    alt="Monad Logo"
                    className="w-12 h-12 filter brightness-0 invert"
                    style={{
                      filter:
                        "brightness(0) saturate(100%) invert(56%) sepia(94%) saturate(6738%) hue-rotate(266deg) brightness(101%) contrast(101%)",
                    }}
                  />
                </div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">
                  Monad L1
                </h3>
                <p className="text-gray-300 text-sm">
                  Built on Monad's high-performance blockchain infrastructure
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <div className="mt-12">
              <button
                onClick={() => setShowHero(false)}
                className="btn btn-primary text-2xl px-12 py-6"
                style={{ boxShadow: "0 0 40px rgba(0,255,247,0.6)" }}
              >
                LAUNCH APP →
              </button>
            </div>

            {/* Info */}
            <p className="text-sm text-gray-400 mt-8">
              Chain ID: 10143 | Monad Testnet | ERC-7710 Delegations
            </p>
          </div>
        </div>
      )}

      {/* Header with Logo */}
      {!showHero && (
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/assetnestfinal.png"
                alt="Asset Nest"
                className="h-12 w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold neon-text">ASSET NEST</h1>
                <p className="text-xs text-gray-400">AI Portfolio Rebalancer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Chain Status */}
              <div className="flex items-center gap-2 bg-black border-2 border-green-400/50 px-3 py-2 rounded-lg">
                <div
                  className={`w-2 h-2 rounded-full ${
                    chainId === 10143 ? "bg-green-400" : "bg-red-400"
                  } animate-pulse`}
                ></div>
                <div>
                  <div className="text-sm font-bold text-white">
                    <img
                      src="/66c3711574e166ac115bba8a_Logo Mark.svg"
                      alt="Monad"
                      className="w-4 h-4 inline mr-2 filter brightness-0 invert"
                    />
                    Monad Testnet
                  </div>
                  <div className="text-xs font-mono text-cyan-400">
                    Chain ID: 10143
                  </div>
                </div>
              </div>

              {/* Wallet Info - Enhanced */}
              {isConnected && address ? (
                <div className="flex items-center gap-3 bg-black border-2 border-purple-400/50 px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                    <span className="text-xs text-gray-400 uppercase font-mono">
                      WALLET
                    </span>
                  </div>
                  <code className="text-sm font-mono text-purple-400 font-bold">
                    {address.slice(0, 8)}...{address.slice(-6)}
                  </code>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(address)}
                      className="text-purple-400 hover:text-purple-300 transition-colors p-1 hover:bg-purple-400/10 rounded"
                      title="Copy Address"
                    >
                      📋
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-400/10 rounded font-bold"
                      title="Disconnect Wallet"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {connectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => connect({ connector })}
                      disabled={loading}
                      className="bg-black border-2 border-cyan-400/50 px-4 py-2 rounded-lg text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(0,255,247,0.3)] transition-all font-bold text-sm disabled:opacity-50"
                    >
                      {loading
                        ? "CONNECTING..."
                        : `CONNECT ${connector.name.toUpperCase()}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      {!showHero && (
        <>
          <div className="card">
            <div className="space-y-4">
              {/* Main Navigation Steps */}
              <div className="grid grid-cols-4 gap-2">
                {["delegation", "portfolio", "rebalance", "swap"].map((s) => {
                  const stepName = s as
                    | "delegation"
                    | "portfolio"
                    | "rebalance"
                    | "swap";
                  const canNavigate =
                    (stepName === "delegation" && isConnected) ||
                    (stepName === "portfolio" &&
                      isConnected &&
                      smartAccountAddress) ||
                    (stepName === "rebalance" && holdings.length > 0) ||
                    (stepName === "swap" && holdings.length > 0);
                  return (
                    <button
                      key={s}
                      onClick={() => canNavigate && setStep(stepName)}
                      disabled={!canNavigate}
                      className={`text-center py-2 px-1 rounded-lg text-sm font-bold uppercase transition-all ${
                        step === s
                          ? "bg-black border-2 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(0,255,247,0.5)]"
                          : canNavigate
                          ? "bg-black border border-cyan-400/50 text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-400 cursor-pointer"
                          : "bg-black border border-gray-700 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>

              {/* Utility Navigation */}
              <div className="flex gap-2 border-t-2 border-cyan-400/30 pt-4">
                <button
                  onClick={() => setStep("logs")}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase transition-all ${
                    step === "logs"
                      ? "bg-purple-500/20 border-2 border-purple-400 text-purple-400"
                      : "bg-black border border-purple-400/50 text-purple-400/70 hover:border-purple-400 hover:text-purple-400"
                  }`}
                >
                  ACTIVITY LOGS
                </button>
                {delegationCreated && (
                  <button
                    onClick={() => setShowRevokeModal(true)}
                    disabled={loading}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase bg-black border border-red-400/50 text-red-400/70 hover:border-red-400 hover:text-red-400 transition-all disabled:opacity-50"
                  >
                    REVOKE DELEGATION
                  </button>
                )}
                {isConnected && (
                  <button
                    onClick={() => setStep("delegation")}
                    className="flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase bg-black border border-cyan-400/50 text-cyan-400/70 hover:border-cyan-400 hover:text-cyan-400 transition-all"
                  >
                    SETTINGS
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Setup Smart Account & Delegation */}
          {step === "delegation" && isConnected && (
            <div className="card fade-in">
              <h2 className="text-3xl font-bold mb-6 neon-text">
                DELEGATION SETUP
              </h2>
              <div className="space-y-6">
                {!smartAccountAddress ? (
                  <div>
                    <p className="mb-4 text-gray-300">
                      Create a MetaMask Smart Account with ERC-4337 capabilities
                    </p>
                    <button
                      onClick={handleCreateSmartAccount}
                      disabled={loading || chainId !== 10143}
                      className="btn btn-primary w-full text-lg"
                    >
                      {chainId !== 10143
                        ? "SWITCH TO MONAD TESTNET FIRST"
                        : loading
                        ? "CREATING..."
                        : "CREATE SMART ACCOUNT"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-6 bg-black rounded-lg border-2 border-cyan-400 shadow-[0_0_20px_rgba(0,255,247,0.2)]">
                      <div className="text-sm text-gray-400 uppercase mb-2">
                        Smart Account Address
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="mono text-cyan-400 font-bold text-sm break-all">
                          {smartAccountAddress}
                        </code>
                        <CopyButton
                          text={smartAccountAddress}
                          displayText="COPY"
                        />
                      </div>
                    </div>

                    {agentAddress && (
                      <div className="p-6 bg-black rounded-lg border-2 border-purple-400 shadow-[0_0_20px_rgba(147,51,234,0.2)]">
                        <div className="text-sm text-gray-400 uppercase mb-2">
                          AI Agent Address
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="mono text-purple-400 font-bold text-sm break-all">
                            {agentAddress}
                          </code>
                          <CopyButton text={agentAddress} displayText="COPY" />
                        </div>
                      </div>
                    )}

                    {!delegationCreated ? (
                      <div className="space-y-4">
                        <div className="p-6 bg-black rounded-lg border-2 border-green-400 shadow-[0_0_30px_rgba(57,255,20,0.3)]">
                          <h3 className="text-xl font-bold mb-4 text-green-400">
                            DELEGATION PERMISSIONS
                          </h3>

                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                              <div>
                                <div className="font-bold text-white">
                                  Execute Trades
                                </div>
                                <div className="text-sm text-gray-400">
                                  Agent can swap tokens on your behalf using
                                  Monorail
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                              <div>
                                <div className="font-bold text-white">
                                  Rebalance Portfolio
                                </div>
                                <div className="text-sm text-gray-400">
                                  Agent can adjust your token allocations to
                                  match target percentages
                                </div>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                              <div>
                                <div className="font-bold text-white">
                                  Gasless Transactions
                                </div>
                                <div className="text-sm text-gray-400">
                                  Execute trades without paying gas fees
                                  (ERC-4337)
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-6 pt-4 border-t-2 border-green-400/30">
                            <h4 className="font-bold text-yellow-400 mb-4 text-lg">
                              CONFIGURED RESTRICTIONS
                            </h4>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-purple-400/30">
                                  <div className="text-xs text-gray-400 uppercase mb-1">
                                    Risk Appetite
                                  </div>
                                  <div className="text-lg font-bold text-purple-400 capitalize">
                                    {delegationParams.riskLevel}
                                  </div>
                                </div>
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-blue-400/30">
                                  <div className="text-xs text-gray-400 uppercase mb-1">
                                    Rebalance Frequency
                                  </div>
                                  <div className="text-lg font-bold text-blue-400">
                                    Every {delegationParams.rebalanceInterval}h
                                  </div>
                                </div>
                              </div>

                              <div className="p-3 bg-gray-800/50 rounded-lg border border-cyan-400/30">
                                <div className="text-xs text-gray-400 uppercase mb-2">
                                  Standard
                                </div>
                                <div className="text-sm font-bold text-cyan-400">
                                  ERC-7710 Delegation with Caveats
                                </div>
                              </div>

                              <div className="p-3 bg-gray-800/50 rounded-lg border border-yellow-400/30">
                                <div className="text-xs text-gray-400 uppercase mb-2">
                                  Delegate Address
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <code className="text-xs font-mono text-yellow-400 break-all">
                                    {agentAddress}
                                  </code>
                                  <CopyButton
                                    text={agentAddress}
                                    displayText="COPY"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delegation Configuration */}
                        <div className="p-4 bg-black rounded-lg border-2 border-blue-400/50">
                          <h4 className="font-bold text-blue-400 mb-4">
                            DELEGATION SETTINGS
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">
                                Risk Appetite
                              </label>
                              <select
                                value={delegationParams.riskLevel}
                                onChange={(e) =>
                                  setDelegationParams((prev) => ({
                                    ...prev,
                                    riskLevel: e.target.value as
                                      | "low"
                                      | "medium"
                                      | "high",
                                  }))
                                }
                                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                              >
                                <option value="low">Conservative</option>
                                <option value="medium">Moderate</option>
                                <option value="high">Aggressive</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">
                                Rebalance Frequency
                              </label>
                              <select
                                value={
                                  delegationParams.rebalanceInterval || "24"
                                }
                                onChange={(e) =>
                                  setDelegationParams((prev) => ({
                                    ...prev,
                                    rebalanceInterval: parseInt(e.target.value),
                                  }))
                                }
                                className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
                              >
                                <option value="1">Every Hour</option>
                                <option value="4">Every 4 Hours</option>
                                <option value="12">Every 12 Hours</option>
                                <option value="24">Daily</option>
                                <option value="168">Weekly</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-black rounded-lg border-2 border-purple-400/50">
                          <p className="text-sm text-gray-300">
                            <span className="font-bold text-purple-400">
                              Note:
                            </span>{" "}
                            You will be prompted to sign this delegation in
                            MetaMask. This creates a cryptographic signature
                            proving you authorize the AI agent to trade on your
                            behalf.
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={handleCreateDelegation}
                            disabled={loading || chainId !== 10143}
                            className="btn btn-success text-lg"
                          >
                            {chainId !== 10143
                              ? "SWITCH NETWORK"
                              : loading
                              ? "SIGNING..."
                              : "SIGN DELEGATION"}
                          </button>
                          <button
                            onClick={() => {
                              activityLogger.info(
                                "DELEGATION",
                                "User skipped delegation setup"
                              );
                              fetchPortfolio();
                              setStep("portfolio");
                            }}
                            disabled={loading}
                            className="btn btn-secondary text-lg"
                          >
                            SKIP FOR NOW
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 text-center">
                          You can set up delegation later from Settings. Trades
                          require delegation.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-6 bg-black rounded-lg border-2 border-green-400 shadow-[0_0_30px_rgba(57,255,20,0.3)]">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
                              <span className="text-black text-xl font-bold">
                                OK
                              </span>
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-green-400">
                                DELEGATION ACTIVE
                              </h3>
                              <p className="text-sm text-gray-300">
                                AI agent is authorized to rebalance your
                                portfolio
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm border-t-2 border-green-400/30 pt-4 mt-4">
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                Agent Address:
                              </span>
                              <span className="mono text-green-400">
                                {agentAddress.slice(0, 10)}...
                                {agentAddress.slice(-8)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                Smart Account:
                              </span>
                              <span className="mono text-green-400">
                                {smartAccountAddress.slice(0, 10)}...
                                {smartAccountAddress.slice(-8)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Status:</span>
                              <span className="text-green-400 font-bold">
                                Active
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => setShowRevokeModal(true)}
                            disabled={loading}
                            className="btn btn-danger text-lg"
                          >
                            REVOKE DELEGATION
                          </button>
                          <button
                            onClick={() => fetchPortfolio()}
                            disabled={loading}
                            className="btn btn-primary text-lg"
                          >
                            CONTINUE TO PORTFOLIO →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Portfolio View */}
          {step === "portfolio" && (
            <div className="card fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold neon-text">YOUR PORTFOLIO</h2>
                <button
                  onClick={() => fetchPortfolio(true)}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? "LOADING..." : "REFRESH"}
                </button>
              </div>

              <div className="space-y-6">
                <div className="text-center p-6 bg-black rounded-lg border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,255,247,0.3)]">
                  <div className="text-5xl font-bold neon-text">
                    {formatUSD(totalValueUSD)}
                  </div>
                  <div className="text-gray-400 mt-2">TOTAL VALUE</div>
                </div>

                {/* AI Portfolio Analysis - Moved up for better UX */}
                {holdings.length > 0 && (
                  <div className="border-2 border-purple-400/50 p-6 bg-black rounded-lg shadow-[0_0_30px_rgba(147,51,234,0.3)]">
                    <h3 className="text-2xl font-bold mb-4 text-purple-400 text-center">
                      AI PORTFOLIO ANALYSIS
                    </h3>
                    <p className="text-gray-300 text-center mb-6">
                      Let our AI analyze your portfolio and suggest optimal
                      rebalancing trades
                    </p>
                    <button
                      onClick={handleComputeStrategy}
                      disabled={loading}
                      className="btn btn-success w-full text-lg"
                    >
                      {loading ? (
                        "ANALYZING..."
                      ) : (
                        <span className="flex items-center gap-2">
                          <img
                            src="/agent.png"
                            alt="AI Agent"
                            className="w-5 h-5"
                          />
                          GET AI ANALYSIS & SUGGESTIONS →
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {holdings.length > 0 ? (
                  <>
                    {/* Portfolio Search */}
                    <div className="mb-4">
                      <input
                        type="text"
                        placeholder="Search your portfolio..."
                        value={portfolioSearch || ""}
                        onChange={(e) => setPortfolioSearch(e.target.value)}
                        className="w-full p-3 bg-black border-2 border-cyan-400/50 rounded text-cyan-400 placeholder-cyan-400/50 hover:border-cyan-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                      />
                    </div>

                    <div className="space-y-3">
                      {holdings
                        .filter(
                          (h) =>
                            portfolioSearch === "" ||
                            h.symbol
                              .toLowerCase()
                              .includes(portfolioSearch.toLowerCase()) ||
                            h.name
                              .toLowerCase()
                              .includes(portfolioSearch.toLowerCase()) ||
                            h.token
                              .toLowerCase()
                              .includes(portfolioSearch.toLowerCase())
                        )
                        .map((h) => {
                          // Format balance
                          const balanceNum = parseFloat(h.balance || "0");
                          const displayBalance = isNaN(balanceNum)
                            ? "0.00"
                            : balanceNum.toFixed(6).replace(/\.?0+$/, "");

                          // Confidence color
                          const confidence = parseFloat(h.pconf || "0");
                          const confidenceColor =
                            confidence >= 97
                              ? "text-green-400"
                              : confidence >= 50
                              ? "text-yellow-400"
                              : "text-red-400";

                          // Check if token is expanded
                          const isExpanded = expandedToken === h.token;

                          // Check for warnings
                          const isFake = h.categories?.includes("fake");
                          const isLowConfidence = confidence < 50;

                          return (
                            <div
                              key={`${h.token}-${h.symbol}`}
                              className={`p-4 rounded-lg border-2 ${
                                isFake
                                  ? "bg-red-500/10 border-red-400/50"
                                  : isLowConfidence
                                  ? "bg-yellow-500/10 border-yellow-400/50"
                                  : "bg-black border-cyan-400/30"
                              } hover:border-cyan-400 transition-all`}
                            >
                              {/* Main Token Info - Enhanced Layout */}
                              <div className="grid grid-cols-12 gap-4 items-center">
                                {/* Logo - 1 column */}
                                <div className="col-span-1">
                                  <div className="w-14 h-14 rounded-full bg-black border-2 border-cyan-400/50 flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,255,247,0.3)]">
                                    {h.logo ? (
                                      <img
                                        src={h.logo}
                                        alt={h.symbol}
                                        className="w-full h-full object-cover rounded-full"
                                        onError={(e) => {
                                          console.log(
                                            `Logo failed to load for ${h.symbol}:`,
                                            h.logo
                                          );
                                          const target =
                                            e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = `<div class="w-14 h-14 rounded-full bg-black flex items-center justify-center border-2 border-cyan-400/50"><span class="text-lg font-bold text-cyan-400">${h.symbol.charAt(
                                              0
                                            )}</span></div>`;
                                          }
                                        }}
                                        onLoad={() => {
                                          console.log(
                                            `Logo loaded successfully for ${h.symbol}:`,
                                            h.logo
                                          );
                                        }}
                                      />
                                    ) : h.symbol === "MON" ? (
                                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                        <img
                                          src="/66c3711574e166ac115bba8a_Logo Mark.svg"
                                          alt="MON"
                                          className="w-6 h-6"
                                          style={{
                                            filter:
                                              "brightness(0) saturate(100%) invert(56%) sepia(94%) saturate(6738%) hue-rotate(266deg) brightness(101%) contrast(101%)",
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center border-2 border-cyan-400/50">
                                        <span className="text-lg font-bold text-cyan-400">
                                          {h.symbol.charAt(0)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Token Name & Symbol - 3 columns */}
                                <div className="col-span-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-xl font-bold text-cyan-400 font-mono">
                                        {h.symbol}
                                      </h3>
                                      {isFake && (
                                        <span className="text-xs font-bold px-2 py-1 rounded bg-red-500 text-white animate-pulse">
                                          FAKE
                                        </span>
                                      )}
                                      {h.categories?.includes("verified") && (
                                        <span className="text-xs font-bold px-2 py-1 rounded bg-green-500 text-black">
                                          VERIFIED
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-400 font-medium">
                                      {h.name || "Unknown Token"}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {h.categories?.slice(0, 2).map((cat) => (
                                        <span
                                          key={cat}
                                          className={`text-xs px-2 py-0.5 rounded font-bold border ${
                                            cat === "ecosystem"
                                              ? "bg-purple-500/20 border-purple-400 text-purple-400"
                                              : cat === "lst"
                                              ? "bg-blue-500/20 border-blue-400 text-blue-400"
                                              : cat === "verified"
                                              ? "bg-green-500/20 border-green-400 text-green-400"
                                              : "bg-gray-800 border-gray-600 text-gray-300"
                                          }`}
                                        >
                                          {cat.toUpperCase()}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Values - 3 columns */}
                                <div className="col-span-3 text-right">
                                  <div className="space-y-1">
                                    <div className="text-2xl font-bold text-white font-mono">
                                      {formatUSD(h.valueUSD)}
                                    </div>
                                    <div className="text-sm text-gray-400 font-mono">
                                      {displayBalance} {h.symbol}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono">
                                      @ {formatUSD(h.price)}
                                    </div>
                                  </div>
                                </div>

                                {/* Confidence & Allocation - 2 columns */}
                                <div className="col-span-2 space-y-2">
                                  <div className="text-center">
                                    <div
                                      className={`text-lg font-bold font-mono ${confidenceColor}`}
                                    >
                                      {confidence}%
                                    </div>
                                    <div className="text-xs text-gray-500 uppercase">
                                      Confidence
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-xs text-gray-400 text-center font-mono">
                                      {formatPercentage(h.percentage)}
                                    </div>
                                    <div className="bg-black border border-cyan-400/30 rounded-full h-2 overflow-hidden">
                                      <div
                                        className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(0,255,247,0.5)]"
                                        style={{
                                          width: `${Math.min(
                                            h.percentage,
                                            100
                                          )}%`,
                                        }}
                                      ></div>
                                    </div>
                                  </div>
                                </div>

                                {/* More Info Button - 1 column */}
                                <div className="col-span-1">
                                  <button
                                    onClick={() =>
                                      setExpandedToken(
                                        isExpanded ? null : h.token
                                      )
                                    }
                                    className="w-full px-3 py-2 rounded-lg bg-black border-2 border-cyan-400/50 hover:border-cyan-400 text-cyan-400 text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(0,255,247,0.3)]"
                                  >
                                    {isExpanded ? "▲" : "▼"}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded Details - Enhanced */}
                              {isExpanded && (
                                <div className="mt-6 pt-6 border-t-2 border-cyan-400/30 bg-black rounded-lg p-6 shadow-[0_0_30px_rgba(0,255,247,0.3)]">
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Contract Address */}
                                    <div className="space-y-2">
                                      <div className="text-cyan-400 font-bold text-sm uppercase tracking-wide">
                                        Contract Address
                                      </div>
                                      <div className="font-mono text-xs bg-black/50 p-3 rounded border border-cyan-400/30 break-all">
                                        {h.token ===
                                        "0x0000000000000000000000000000000000000000" ? (
                                          <span className="text-purple-400 font-bold">
                                            Native MON Token
                                          </span>
                                        ) : (
                                          <span className="text-cyan-400">
                                            {h.token}
                                          </span>
                                        )}
                                      </div>
                                      {h.token !==
                                        "0x0000000000000000000000000000000000000000" && (
                                        <a
                                          href={`https://testnet.monadexplorer.com/address/${h.token}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-block text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                        >
                                          View on Explorer →
                                        </a>
                                      )}
                                    </div>

                                    {/* Token Details */}
                                    <div className="space-y-4">
                                      <div>
                                        <div className="text-cyan-400 font-bold text-sm uppercase tracking-wide mb-2">
                                          Token Details
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              Decimals:
                                            </span>
                                            <span className="text-white font-mono">
                                              {h.decimals}
                                            </span>
                                          </div>
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              Price:
                                            </span>
                                            <span className="text-green-400 font-mono font-bold">
                                              ${h.price.toFixed(6)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              24h Change:
                                            </span>
                                            <span className="text-gray-500 font-mono">
                                              Unknown
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* MON Values */}
                                    <div className="space-y-4">
                                      <div>
                                        <div className="text-cyan-400 font-bold text-sm uppercase tracking-wide mb-2">
                                          MON Metrics
                                        </div>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              MON Value:
                                            </span>
                                            <span className="text-purple-400 font-mono font-bold">
                                              {parseFloat(
                                                h.monValue || "0"
                                              ).toFixed(4)}{" "}
                                              MON
                                            </span>
                                          </div>
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              MON per Token:
                                            </span>
                                            <span className="text-purple-400 font-mono">
                                              {parseFloat(
                                                h.monPerToken || "0"
                                              ).toFixed(6)}
                                            </span>
                                          </div>
                                          <div className="flex justify-between bg-black/30 p-2 rounded">
                                            <span className="text-gray-400">
                                              Market Data:
                                            </span>
                                            <span className="text-gray-500 font-mono">
                                              Limited
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Categories Section */}
                                  <div className="mt-6 pt-4 border-t border-cyan-400/20">
                                    <div className="text-cyan-400 font-bold text-sm uppercase tracking-wide mb-3">
                                      Token Categories
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {h.categories &&
                                      h.categories.length > 0 ? (
                                        h.categories.map((cat) => (
                                          <span
                                            key={cat}
                                            className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all hover:shadow-lg ${
                                              cat === "verified"
                                                ? "bg-green-500/20 border-green-400 text-green-400 hover:shadow-green-400/30"
                                                : cat === "fake"
                                                ? "bg-red-500/20 border-red-400 text-red-400 hover:shadow-red-400/30 animate-pulse"
                                                : cat === "ecosystem"
                                                ? "bg-purple-500/20 border-purple-400 text-purple-400 hover:shadow-purple-400/30"
                                                : cat === "lst"
                                                ? "bg-blue-500/20 border-blue-400 text-blue-400 hover:shadow-blue-400/30"
                                                : cat === "stablecoin"
                                                ? "bg-yellow-500/20 border-yellow-400 text-yellow-400 hover:shadow-yellow-400/30"
                                                : "bg-gray-800/50 border-gray-600 text-gray-300 hover:shadow-gray-600/30"
                                            }`}
                                          >
                                            {cat.toUpperCase()}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-800/50 border-2 border-gray-600 text-gray-500">
                                          No categories available
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Warning Messages */}
                              {isFake && (
                                <div className="mt-3 p-3 bg-red-500/20 border border-red-400 rounded text-sm text-red-400">
                                  <strong>WARNING:</strong> This token is marked
                                  as FAKE. Do not trade or hold.
                                </div>
                              )}
                              {isLowConfidence && !isFake && (
                                <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-400 rounded text-sm text-yellow-400">
                                  <strong>LOW CONFIDENCE:</strong> Price data
                                  may be unreliable. Trade with caution.
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xl text-gray-400 mb-4">
                      NO TOKENS FOUND
                    </p>
                    <p className="text-gray-500">
                      Get testnet tokens at{" "}
                      <a
                        href="https://faucet.monad.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline"
                      >
                        faucet.monad.xyz
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rebalancing Strategy */}
          {step === "rebalance" && (
            <div className="card fade-in">
              <h2 className="text-3xl font-bold mb-6 neon-text">
                AI REBALANCING STRATEGY
              </h2>

              {!strategy ? (
                <div className="space-y-6">
                  <div className="text-center py-12">
                    <div className="mb-6">
                      <div className="mb-4">
                        <img
                          src="/agent.png"
                          alt="AI Agent"
                          className="w-16 h-16 mx-auto"
                        />
                      </div>
                      <h3 className="text-2xl font-bold text-cyan-400 mb-2">
                        Ready to Optimize Your Portfolio
                      </h3>
                      <p className="text-gray-400">
                        Let AI analyze your holdings and suggest optimal
                        rebalancing trades
                      </p>
                    </div>

                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={handleComputeStrategy}
                        disabled={loading || holdings.length === 0}
                        className="btn btn-primary text-lg px-8 py-3"
                      >
                        {loading ? "ANALYZING..." : "🚀 TRIGGER REBALANCE"}
                      </button>
                    </div>

                    {holdings.length === 0 && (
                      <p className="text-yellow-400 text-sm mt-4">
                        Load your portfolio first to enable rebalancing
                      </p>
                    )}
                  </div>

                  {/* Next Auto-Rebalance Timer */}
                  <div className="p-4 bg-gray-800/50 rounded-lg border-2 border-purple-400/30">
                    <h4 className="text-purple-400 font-bold mb-2">
                      📅 Auto-Rebalance Schedule
                    </h4>
                    <div className="text-sm text-gray-400">
                      {delegationParams.rebalanceInterval ? (
                        <>
                          <p>
                            Frequency: Every{" "}
                            {delegationParams.rebalanceInterval} hour
                            {delegationParams.rebalanceInterval === 1
                              ? ""
                              : "s"}
                          </p>
                          <RebalanceTimer
                            intervalHours={delegationParams.rebalanceInterval}
                            lastRebalanceTime={lastRebalanceTime}
                            autoRebalanceEnabled={autoRebalanceEnabled}
                            onAutoRebalance={handleAutoRebalance}
                            isAutoRebalancing={isAutoRebalancing}
                          />
                          
                          {/* Auto-Rebalance Toggle */}
                          <div className="mt-4 p-3 bg-gray-900/50 rounded border border-cyan-400/30">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-bold text-cyan-400">Auto-Rebalance</h4>
                                <p className="text-xs text-gray-400">
                                  Automatically execute rebalancing when timer expires
                                </p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={autoRebalanceEnabled}
                                  onChange={(e) => setAutoRebalanceEnabled(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                              </label>
                            </div>
                            {autoRebalanceEnabled && (
                              <p className="text-xs text-green-400 mt-2">
                                🤖 Trades will be executed automatically using your delegation
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <p>
                          Auto-rebalancing not configured. Set up delegation to
                          enable automatic portfolio rebalancing.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="p-6 bg-black rounded-lg border-2 border-purple-400 shadow-[0_0_30px_rgba(191,0,255,0.3)]">
                    <h3 className="font-bold mb-3 text-purple-400 text-xl">
                      AI RATIONALE:
                    </h3>
                    <p className="text-gray-200 leading-relaxed">
                      {strategy.rationale}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-cyan-400 text-xl">
                        SUGGESTED TRADES ({strategy.trades.length})
                      </h3>
                      <button
                        onClick={() => {
                          if (
                            selectedTrades.length === strategy.trades.length
                          ) {
                            setSelectedTrades([]);
                          } else {
                            setSelectedTrades(
                              Array.from(
                                { length: strategy.trades.length },
                                (_, i) => i
                              )
                            );
                          }
                        }}
                        className="text-sm px-3 py-1 rounded bg-cyan-400/20 text-cyan-400 hover:bg-cyan-400/30 transition-colors"
                      >
                        {selectedTrades.length === strategy.trades.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                    </div>
                    {strategy.trades.length > 0 ? (
                      <div className="space-y-3">
                        {strategy.trades.map((trade, index) => {
                          const isSelected = selectedTrades.includes(index);
                          return (
                            <div
                              key={index}
                              className={`p-6 rounded-lg border-2 transition-all duration-300 ${
                                isSelected
                                  ? "bg-black border-cyan-400 shadow-[0_0_20px_rgba(0,255,247,0.3)]"
                                  : "bg-gray-800/50 border-gray-600/50 hover:border-gray-500"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  <label className="flex items-center cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTrades((prev) => [
                                            ...prev,
                                            index,
                                          ]);
                                        } else {
                                          setSelectedTrades((prev) =>
                                            prev.filter((i) => i !== index)
                                          );
                                        }
                                      }}
                                      className="w-5 h-5 text-cyan-400 bg-gray-700 border-gray-600 rounded focus:ring-cyan-400 focus:ring-2"
                                    />
                                  </label>
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`text-xl font-bold ${
                                        isSelected
                                          ? "text-red-400"
                                          : "text-gray-500"
                                      }`}
                                    >
                                      {trade.fromSymbol}
                                    </span>
                                    <div
                                      className={`px-2 py-1 rounded text-xs font-bold ${
                                        isSelected
                                          ? "bg-cyan-400/20 text-cyan-400"
                                          : "bg-gray-600/20 text-gray-500"
                                      }`}
                                    >
                                      SELL
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className={`text-3xl ${
                                    isSelected
                                      ? "text-cyan-400"
                                      : "text-gray-500"
                                  }`}
                                >
                                  →
                                </div>
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`px-2 py-1 rounded text-xs font-bold ${
                                      isSelected
                                        ? "bg-green-400/20 text-green-400"
                                        : "bg-gray-600/20 text-gray-500"
                                    }`}
                                  >
                                    BUY
                                  </div>
                                  <span
                                    className={`text-xl font-bold ${
                                      isSelected
                                        ? "text-green-400"
                                        : "text-gray-500"
                                    }`}
                                  >
                                    {trade.toSymbol}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`p-4 rounded-lg ${
                                  isSelected
                                    ? "bg-gray-800/50"
                                    : "bg-gray-700/50"
                                } mb-3`}
                              >
                                <div
                                  className={`text-sm font-semibold ${
                                    isSelected
                                      ? "text-cyan-400"
                                      : "text-gray-500"
                                  } mb-1`}
                                >
                                  Amount: {trade.amount} {trade.fromSymbol}
                                </div>
                              </div>
                              <div
                                className={`text-sm ${
                                  isSelected ? "text-gray-300" : "text-gray-600"
                                } leading-relaxed`}
                              >
                                <strong
                                  className={
                                    isSelected
                                      ? "text-cyan-400"
                                      : "text-gray-500"
                                  }
                                >
                                  Reason:
                                </strong>{" "}
                                {trade.reason}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-green-400 text-xl font-bold">
                        PORTFOLIO ALREADY BALANCED!
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setStep("portfolio")}
                      className="btn btn-secondary flex-1 text-lg"
                    >
                      ← BACK
                    </button>
                    <button
                      onClick={handleExecuteRebalance}
                      disabled={
                        selectedTrades.length === 0 ||
                        loading ||
                        !smartAccountAddress ||
                        !delegationCreated
                      }
                      className="btn btn-primary flex-1 text-lg"
                      title={
                        !smartAccountAddress
                          ? "Smart Account required for execution"
                          : !delegationCreated
                          ? "Delegation required for execution"
                          : ""
                      }
                    >
                      {loading
                        ? "EXECUTING VIA DELEGATION..."
                        : !smartAccountAddress
                        ? "SMART ACCOUNT REQUIRED"
                        : !delegationCreated
                        ? "DELEGATION REQUIRED"
                        : `EXECUTE ${selectedTrades.length} TRADE${
                            selectedTrades.length === 1 ? "" : "S"
                          } VIA DELEGATION →`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manual Swap Interface */}
          {step === "swap" && (
            <div className="card fade-in">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold neon-text">MANUAL SWAP</h2>
                <button
                  onClick={loadAllTokens}
                  disabled={swapState.loadingTokens}
                  className="btn btn-secondary"
                >
                  {swapState.loadingTokens ? "LOADING..." : "REFRESH TOKENS"}
                </button>
              </div>

              {swapState.loadingTokens ? (
                <div className="text-center py-12">
                  <div className="spinner mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading available tokens...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Swap Form */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* From Token */}
                    <div className="p-4 bg-black rounded-lg border-2 border-red-500">
                      <h3 className="font-bold text-red-500 mb-4">FROM</h3>

                      {/* Search Input */}
                      <input
                        type="text"
                        placeholder="Search tokens..."
                        value={swapState.fromTokenSearch || ""}
                        onChange={(e) =>
                          setSwapState((prev) => ({
                            ...prev,
                            fromTokenSearch: e.target.value,
                          }))
                        }
                        className="w-full p-2 bg-black border border-red-500 rounded text-red-500 mb-2 placeholder-red-300 focus:border-red-400 focus:ring-1 focus:ring-red-500/50"
                      />

                      <select
                        className="token-select-from w-full p-3 bg-black border-2 border-red-500 rounded text-red-500 mb-4 hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-500/50 transition-all duration-300 font-mono text-sm shadow-lg shadow-red-500/20"
                        value={swapState.fromToken}
                        onChange={(e) =>
                          setSwapState((prev) => ({
                            ...prev,
                            fromToken: e.target.value,
                            fromAmount: "",
                          }))
                        }
                      >
                        <option value="">Select token to sell</option>
                        <optgroup label="Your Holdings">
                          {swapState.allTokens
                            .filter(
                              (t: any) =>
                                parseFloat(t.balance) > 0 &&
                                (swapState.fromTokenSearch === "" ||
                                  !swapState.fromTokenSearch ||
                                  t.symbol
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.name
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.address
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ))
                            )
                            .map((t: any) => (
                              <option key={t.address} value={t.address}>
                                {t.symbol} - {parseFloat(t.balance).toFixed(4)}{" "}
                                (${(t.balanceUSD || 0).toFixed(2)})
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="All Available Tokens">
                          {swapState.allTokens
                            .filter(
                              (t: any) =>
                                parseFloat(t.balance) === 0 &&
                                (swapState.fromTokenSearch === "" ||
                                  !swapState.fromTokenSearch ||
                                  t.symbol
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.name
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.address
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.fromTokenSearch?.toLowerCase() ||
                                        ""
                                    ))
                            )
                            // Show all available tokens (no limit)
                            .map((t: any) => (
                              <option key={t.address} value={t.address}>
                                {t.symbol} - {t.name} ($
                                {(t.price || 0).toFixed(4)})
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-2">
                          Amount
                        </label>
                        <input
                          type="number"
                          placeholder="0.0"
                          value={swapState.fromAmount}
                          onChange={(e) =>
                            setSwapState((prev) => ({
                              ...prev,
                              fromAmount: e.target.value,
                            }))
                          }
                          className="w-full p-3 bg-black border-2 border-red-400/50 rounded text-white text-right text-2xl font-bold hover:border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all duration-300 font-mono shadow-lg shadow-red-400/10 glow-red"
                          step="any"
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        Available Balance:{" "}
                        <span className="text-white font-bold">
                          {swapState.fromToken
                            ? (() => {
                                const token = swapState.allTokens.find(
                                  (t: any) => t.address === swapState.fromToken
                                );
                                return token
                                  ? `${parseFloat(token.balance).toFixed(4)} ${
                                      token.symbol
                                    }`
                                  : "0.00";
                              })()
                            : "Select token"}
                        </span>
                      </div>
                    </div>

                    {/* To Token */}
                    <div className="p-4 bg-black rounded-lg border-2 border-green-500">
                      <h3 className="font-bold text-green-500 mb-4">TO</h3>

                      {/* Search Input */}
                      <input
                        type="text"
                        placeholder="Search tokens..."
                        value={swapState.toTokenSearch || ""}
                        onChange={(e) =>
                          setSwapState((prev) => ({
                            ...prev,
                            toTokenSearch: e.target.value,
                          }))
                        }
                        className="w-full p-2 bg-black border border-green-500 rounded text-green-500 mb-2 placeholder-green-300 focus:border-green-400 focus:ring-1 focus:ring-green-500/50"
                      />

                      <select
                        className="token-select-to w-full p-3 bg-black border-2 border-green-500 rounded text-green-500 mb-4 hover:border-green-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/50 transition-all duration-300 font-mono text-sm shadow-lg shadow-green-500/20"
                        value={swapState.toToken}
                        onChange={(e) =>
                          setSwapState((prev) => ({
                            ...prev,
                            toToken: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select token to buy</option>
                        <optgroup label="Popular Tokens">
                          {swapState.allTokens
                            .filter(
                              (t: any) =>
                                t.address !== swapState.fromToken &&
                                (swapState.toTokenSearch === "" ||
                                  !swapState.toTokenSearch ||
                                  t.symbol
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.name
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.address
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ))
                            )
                            // Show all popular tokens (no limit)
                            .map((t: any) => (
                              <option key={t.address} value={t.address}>
                                {t.symbol} - {t.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="All Available Tokens">
                          {swapState.allTokens
                            .filter(
                              (t: any) =>
                                t.address !== swapState.fromToken &&
                                (swapState.toTokenSearch === "" ||
                                  !swapState.toTokenSearch ||
                                  t.symbol
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.name
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ) ||
                                  t.address
                                    ?.toLowerCase()
                                    .includes(
                                      swapState.toTokenSearch?.toLowerCase() ||
                                        ""
                                    ))
                            )
                            // Show all remaining tokens (no limit)
                            .map((t: any) => (
                              <option key={t.address} value={t.address}>
                                {t.symbol} - {t.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                      <div className="mb-4">
                        <label className="block text-sm text-gray-400 mb-2">
                          You'll receive (estimated)
                        </label>
                        <input
                          type="text"
                          placeholder="0.0"
                          value={
                            swapState.loadingQuote
                              ? "Loading..."
                              : swapState.toAmount
                              ? parseFloat(swapState.toAmount).toFixed(6)
                              : "0.00"
                          }
                          className="w-full p-3 bg-black border-2 border-green-400/50 rounded text-white text-right text-2xl font-bold font-mono shadow-lg shadow-green-400/10 glow-green"
                          readOnly
                        />
                      </div>
                      <div className="text-sm text-gray-400">
                        Your Balance:{" "}
                        <span className="text-white font-bold">
                          {swapState.toToken
                            ? (() => {
                                const token = swapState.allTokens.find(
                                  (t: any) => t.address === swapState.toToken
                                );
                                return token
                                  ? `${parseFloat(token.balance).toFixed(4)} ${
                                      token.symbol
                                    }`
                                  : "0.00";
                              })()
                            : "Select token"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Swap Settings */}
                  <div className="p-4 bg-black rounded-lg border-2 border-cyan-400/50 shadow-lg shadow-cyan-400/10">
                    <h4 className="font-bold text-cyan-400 mb-4 font-mono">
                      SWAP SETTINGS
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-mono">
                          Slippage Tolerance
                        </label>
                        <select
                          className="w-full p-2 bg-black border-2 border-cyan-400/50 rounded text-white hover:border-cyan-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 font-mono text-sm glow-cyan"
                          value={swapState.slippage}
                          onChange={(e) =>
                            setSwapState((prev) => ({
                              ...prev,
                              slippage: e.target.value,
                            }))
                          }
                        >
                          <option value="0.5">0.5%</option>
                          <option value="1">1.0%</option>
                          <option value="2">2.0%</option>
                          <option value="5">5.0%</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-mono">
                          Transaction Deadline
                        </label>
                        <select
                          className="w-full p-2 bg-black border-2 border-cyan-400/50 rounded text-white hover:border-cyan-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 font-mono text-sm glow-cyan"
                          value={swapState.deadline}
                          onChange={(e) =>
                            setSwapState((prev) => ({
                              ...prev,
                              deadline: e.target.value,
                            }))
                          }
                        >
                          <option value="5">5 minutes</option>
                          <option value="10">10 minutes</option>
                          <option value="20">20 minutes</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-mono">
                          Priority
                        </label>
                        <select
                          className="w-full p-2 bg-black border-2 border-cyan-400/50 rounded text-white hover:border-cyan-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 font-mono text-sm glow-cyan"
                          value={swapState.priority}
                          onChange={(e) =>
                            setSwapState((prev) => ({
                              ...prev,
                              priority: e.target.value,
                            }))
                          }
                        >
                          <option value="normal">Normal</option>
                          <option value="fast">Fast</option>
                          <option value="instant">Instant</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Swap Preview */}
                  {swapState.quote &&
                    swapState.fromToken &&
                    swapState.toToken && (
                      <div className="p-4 bg-black rounded-lg border-2 border-yellow-400/50">
                        <h4 className="font-bold text-yellow-400 mb-4">
                          SWAP PREVIEW
                        </h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              Exchange Rate:
                            </span>
                            <span className="text-white font-bold">
                              1{" "}
                              {
                                swapState.allTokens.find(
                                  (t: any) => t.address === swapState.fromToken
                                )?.symbol
                              }{" "}
                              ={" "}
                              {swapState.fromAmount &&
                              parseFloat(swapState.fromAmount) > 0
                                ? (
                                    parseFloat(swapState.toAmount) /
                                    parseFloat(swapState.fromAmount)
                                  ).toFixed(6)
                                : "0"}{" "}
                              {
                                swapState.allTokens.find(
                                  (t: any) => t.address === swapState.toToken
                                )?.symbol
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Price Impact:</span>
                            <span className="text-green-400 font-bold">
                              {swapState.quote.priceImpact || "< 0.1%"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              Minimum Received:
                            </span>
                            <span className="text-white font-bold">
                              {(
                                parseFloat(swapState.toAmount) *
                                (1 - parseFloat(swapState.slippage) / 100)
                              ).toFixed(4)}{" "}
                              {
                                swapState.allTokens.find(
                                  (t: any) => t.address === swapState.toToken
                                )?.symbol
                              }
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Network Fee:</span>
                            <span className="text-white font-bold">
                              {swapState.quote.estimatedGas
                                ? formatGasEstimate(
                                    swapState.quote.estimatedGas
                                  )
                                : formatGasEstimate(200000)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Action Buttons */}
                  <div className="flex gap-4">
                    <button
                      onClick={() => setStep("portfolio")}
                      className="btn btn-secondary flex-1 text-lg"
                    >
                      ← BACK
                    </button>
                    <button
                      onClick={handleExecuteSwap}
                      disabled={
                        loading ||
                        !swapState.fromToken ||
                        !swapState.toToken ||
                        !swapState.fromAmount ||
                        parseFloat(swapState.fromAmount) <= 0
                      }
                      className="btn btn-primary flex-1 text-lg"
                    >
                      {loading ? "SWAPPING..." : "EXECUTE SWAP →"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Enhanced Activity Logs & Analytics */}
          {step === "logs" && (
            <div className="card fade-in">
              <h2 className="text-3xl font-bold mb-6 neon-text">
                ACTIVITY LOGS & ANALYTICS
              </h2>

              {/* Swap History Section */}
              <div className="mb-8 p-4 bg-black rounded-lg border-2 border-cyan-400/50">
                <h3 className="text-xl font-bold text-cyan-400 mb-4">
                  💱 SWAP HISTORY
                </h3>
                {(() => {
                  const swaps = swapHistory.getHistory().slice(0, 10); // Latest 10 swaps
                  const stats = swapHistory.getStats();

                  return (
                    <>
                      {/* Swap Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="text-center p-3 bg-gray-800/50 rounded">
                          <div className="text-2xl font-bold text-green-400">
                            {stats.successful}
                          </div>
                          <div className="text-xs text-gray-400">
                            Successful Swaps
                          </div>
                        </div>
                        <div className="text-center p-3 bg-gray-800/50 rounded">
                          <div className="text-2xl font-bold text-red-400">
                            {stats.failed}
                          </div>
                          <div className="text-xs text-gray-400">
                            Failed Swaps
                          </div>
                        </div>
                        <div className="text-center p-3 bg-gray-800/50 rounded">
                          <div className="text-2xl font-bold text-cyan-400">
                            {stats.successRate.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-400">
                            Success Rate
                          </div>
                        </div>
                        <div className="text-center p-3 bg-gray-800/50 rounded">
                          <div className="text-2xl font-bold text-purple-400">
                            {stats.last24h}
                          </div>
                          <div className="text-xs text-gray-400">Last 24h</div>
                        </div>
                      </div>

                      {/* Recent Swaps */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {swaps.length > 0 ? (
                          swaps.map((swap) => (
                            <div
                              key={swap.id}
                              className="p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-cyan-400/50 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`w-2 h-2 rounded-full ${
                                      swap.status === "success"
                                        ? "bg-green-400"
                                        : swap.status === "failed"
                                        ? "bg-red-400"
                                        : "bg-yellow-400"
                                    }`}
                                  />
                                  <span className="text-sm font-mono">
                                    {swap.fromAmount} {swap.fromSymbol} →{" "}
                                    {swap.toAmount} {swap.toSymbol}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-1 rounded ${
                                      swap.type === "manual"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : "bg-purple-500/20 text-purple-400"
                                    }`}
                                  >
                                    {swap.type}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs text-gray-400">
                                    {new Date(swap.timestamp).toLocaleString()}
                                  </div>
                                  {swap.txHash && (
                                    <div className="text-xs text-cyan-400 font-mono">
                                      {swap.txHash.slice(0, 10)}...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8 text-gray-400">
                            No swaps yet. Start trading to see your history!
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Enhanced Analytics Dashboard */}
              {address && (
                <div className="mb-6 p-4 bg-black rounded-lg border-2 border-purple-400/50">
                  <h3 className="text-xl font-bold text-purple-400 mb-4">
                    📊 PORTFOLIO ANALYTICS
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-800/50 rounded">
                      <div className="text-2xl font-bold text-cyan-400">
                        {activityLogger.getLogs().length}
                      </div>
                      <div className="text-xs text-gray-400">
                        Total Activities
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-800/50 rounded">
                      <div className="text-2xl font-bold text-green-400">
                        {swapHistory.getHistory().length}
                      </div>
                      <div className="text-xs text-gray-400">
                        Swaps Executed
                      </div>
                    </div>
                    <div className="text-center p-3 bg-gray-800/50 rounded">
                      <div className="text-2xl font-bold text-blue-400">
                        {holdings.length}
                      </div>
                      <div className="text-xs text-gray-400">
                        Token Holdings
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {activityLogger.getLogs().length > 0 ? (
                  activityLogger
                    .getLogs()
                    .reverse()
                    .map((log, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-2 ${
                          log.level === "success"
                            ? "bg-green-500/10 border-green-400/50"
                            : log.level === "error"
                            ? "bg-red-500/10 border-red-400/50"
                            : log.level === "warning"
                            ? "bg-yellow-500/10 border-yellow-400/50"
                            : "bg-blue-500/10 border-blue-400/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-xs font-bold px-2 py-1 rounded ${
                                  log.level === "success"
                                    ? "bg-green-400 text-black"
                                    : log.level === "error"
                                    ? "bg-red-400 text-black"
                                    : log.level === "warning"
                                    ? "bg-yellow-400 text-black"
                                    : "bg-blue-400 text-black"
                                }`}
                              >
                                {log.level.toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-cyan-400">
                                [{log.category}]
                              </span>
                            </div>
                            <div className="text-sm text-white font-medium">
                              {log.message}
                            </div>
                            {log.details && (
                              <div className="text-xs text-gray-400 mt-1 mono">
                                {log.details}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mono whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <p className="text-xl">No activity logs yet</p>
                    <p className="text-sm mt-2">
                      Logs will appear here as you use the app
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t-2 border-cyan-400/30">
                <button
                  onClick={() => {
                    activityLogger.clear();
                    setSuccess("Activity logs cleared");
                  }}
                  className="btn btn-secondary w-full"
                >
                  CLEAR LOGS
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Analysis Window */}
      {aiAnalysis.showWindow && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="card text-center max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <img src="/agent.png" alt="AI Agent" className="w-8 h-8" />
                <h3 className="text-2xl font-bold neon-text">AI ANALYSIS</h3>
              </div>
              <button
                onClick={() =>
                  setAiAnalysis((prev) => ({ ...prev, showWindow: false }))
                }
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {aiAnalysis.isAnalyzing ? (
              <div className="space-y-6">
                <div className="spinner mx-auto mb-6"></div>
                <div className="text-xl font-bold text-cyan-400">
                  ANALYZING PORTFOLIO...
                </div>
                <div className="text-gray-400">
                  AI Agent is analyzing your portfolio and computing optimal
                  rebalancing strategy
                </div>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="p-3 bg-gray-800/50 rounded">
                    <div className="text-sm text-gray-400">Risk Assessment</div>
                    <div className="text-cyan-400 font-bold animate-pulse">
                      Processing...
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded">
                    <div className="text-sm text-gray-400">Market Analysis</div>
                    <div className="text-cyan-400 font-bold animate-pulse">
                      Processing...
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded">
                    <div className="text-sm text-gray-400">Trade Strategy</div>
                    <div className="text-cyan-400 font-bold animate-pulse">
                      Processing...
                    </div>
                  </div>
                </div>
              </div>
            ) : aiAnalysis.result ? (
              <div className="space-y-6 text-left">
                <div className="p-4 bg-green-500/10 border-2 border-green-400/50 rounded-lg">
                  <div className="text-green-400 font-bold mb-2">
                    ANALYSIS COMPLETE
                  </div>
                  <div className="text-sm text-gray-300">
                    AI has computed {aiAnalysis.result.trades?.length || 0}{" "}
                    optimal trades for your portfolio
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-800/50 rounded">
                    <div className="text-sm text-gray-400">
                      Confidence Score
                    </div>
                    <div className="text-2xl font-bold text-green-400">
                      {aiAnalysis.result.confidence || "85"}%
                    </div>
                  </div>
                  <div className="p-3 bg-gray-800/50 rounded">
                    <div className="text-sm text-gray-400">Risk Level</div>
                    <div className="text-xl font-bold text-yellow-400">
                      {aiAnalysis.result.riskLevel || "MODERATE"}
                    </div>
                  </div>
                </div>

                {(aiAnalysis.result.rationale ||
                  aiAnalysis.result.reasoning) && (
                  <div className="p-4 bg-blue-500/10 border-2 border-blue-400/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <img src="/agent.png" alt="AI" className="w-5 h-5" />
                      <div className="text-blue-400 font-bold">
                        AI AGENT ANALYSIS
                      </div>
                    </div>
                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {aiAnalysis.result.rationale ||
                        aiAnalysis.result.reasoning}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() =>
                      setAiAnalysis((prev) => ({ ...prev, showWindow: false }))
                    }
                    className="btn btn-secondary flex-1"
                  >
                    CLOSE
                  </button>
                  <button
                    onClick={() => {
                      setAiAnalysis((prev) => ({ ...prev, showWindow: false }));
                      setStep("rebalance");
                    }}
                    className="btn btn-primary flex-1"
                  >
                    VIEW TRADES →
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-red-400">
                Analysis failed. Please try again.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="card text-center max-w-md">
            <div className="spinner mx-auto mb-6"></div>
            <div className="text-2xl font-bold neon-text">PROCESSING...</div>
            <div className="text-gray-400 mt-2">Please wait</div>
          </div>
        </div>
      )}

      {/* Revoke Delegation Modal */}
      <Modal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        title="REVOKE DELEGATION"
        footer={
          <div className="flex gap-4">
            <button
              onClick={() => setShowRevokeModal(false)}
              className="btn btn-secondary flex-1"
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                handleRevokeDelegation();
                setShowRevokeModal(false);
              }}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg border-2 border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50"
            >
              {loading ? "REVOKING..." : "REVOKE DELEGATION"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-lg text-gray-300">
            Are you sure you want to revoke the delegation? The AI agent will no
            longer be able to trade on your behalf.
          </p>

          {/* Delegation Details */}
          <div className="bg-black/50 rounded-lg p-4 border-2 border-red-400/30 space-y-3">
            <h3 className="font-bold text-lg text-red-400">
              CURRENT DELEGATION
            </h3>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Smart Account:
              </div>
              <div className="mono text-sm text-cyan-400 break-all">
                {smartAccountAddress || "Not set"}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Agent Address:
              </div>
              <div className="mono text-sm text-cyan-400 break-all">
                {agentAddress || "Not set"}
              </div>
            </div>

            {delegationTimestamp && (
              <>
                <div>
                  <div className="text-sm text-gray-400 uppercase mb-1">
                    Created:
                  </div>
                  <div className="text-sm text-white">
                    {new Date(delegationTimestamp).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-gray-400 uppercase mb-1">
                    Last Activity:
                  </div>
                  <div className="text-sm text-white">
                    {Math.floor((Date.now() - delegationTimestamp) / 60000) < 1
                      ? "Just now"
                      : Math.floor((Date.now() - delegationTimestamp) / 60000) <
                        60
                      ? `${Math.floor(
                          (Date.now() - delegationTimestamp) / 60000
                        )} minutes ago`
                      : Math.floor(
                          (Date.now() - delegationTimestamp) / 3600000
                        ) < 24
                      ? `${Math.floor(
                          (Date.now() - delegationTimestamp) / 3600000
                        )} hours ago`
                      : `${Math.floor(
                          (Date.now() - delegationTimestamp) / 86400000
                        )} days ago`}
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Permissions:
              </div>
              <div className="text-sm text-white">Full trading access</div>
            </div>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Risk Appetite:
              </div>
              <div className="text-sm text-white capitalize">
                {delegationParams.riskLevel}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Rebalance Frequency:
              </div>
              <div className="text-sm text-white">
                Every {delegationParams.rebalanceInterval}h
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Risk Level:
              </div>
              <div className="text-sm text-white capitalize">
                {delegationParams.riskLevel}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-400 uppercase mb-1">
                Status:
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400 font-bold">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-500/10 border-2 border-yellow-400/50 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="w-6 h-6 border-2 border-yellow-400 rounded-full flex items-center justify-center text-yellow-400 font-bold flex-shrink-0">
                !
              </div>
              <div>
                <div className="font-bold text-yellow-400 mb-1">WARNING</div>
                <div className="text-sm text-gray-300">
                  This action will immediately stop the AI agent from executing
                  trades. You can create a new delegation afterwards.
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
