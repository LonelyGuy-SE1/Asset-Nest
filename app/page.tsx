'use client';

import { useAccount, useConnect, useDisconnect, useSignTypedData, useChainId } from 'wagmi';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { privateKeyToAccount } from 'viem/accounts';
import { getDeterministicAgentAddress } from '@/lib/utils/agent';

interface Holding {
  token: string;
  symbol: string;
  balance: string;
  decimals: number;
  valueUSD: number;
  percentage: number;
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
  const [step, setStep] = useState<'connect' | 'setup' | 'portfolio' | 'rebalance'>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [smartAccountAddress, setSmartAccountAddress] = useState('');
  const [agentAddress, setAgentAddress] = useState('');
  const [delegationCreated, setDelegationCreated] = useState(false);
  const [showDelegationDetails, setShowDelegationDetails] = useState(false);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValueUSD, setTotalValueUSD] = useState(0);

  const [targets, setTargets] = useState<Target[]>([
    { symbol: 'MON', targetPercentage: 40 },
    { symbol: 'USDC', targetPercentage: 30 },
    { symbol: 'USDT', targetPercentage: 20 },
    { symbol: 'WETH', targetPercentage: 10 },
  ]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Fix hydration by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-proceed when wallet connects and set deterministic agent address
  useEffect(() => {
    if (isConnected && address && !smartAccountAddress && mounted) {
      setShowHero(false);
      setStep('setup');
      setSuccess(`Wallet connected: ${address.slice(0, 10)}...`);

      // Set deterministic agent address immediately on connection
      const deterministicAgentAddr = getDeterministicAgentAddress(address);
      setAgentAddress(deterministicAgentAddr);
    }
  }, [isConnected, address, mounted]);

  // Handle disconnect - reset to hero page
  const handleDisconnect = () => {
    disconnect();
    setShowHero(true);
    setStep('connect');
    setSmartAccountAddress('');
    setAgentAddress('');
    setDelegationCreated(false);
    setHoldings([]);
    setTotalValueUSD(0);
    setStrategy(null);
    setError('');
    setSuccess('');
  };

  // Handle revoke delegation
  const handleRevokeDelegation = async () => {
    if (!smartAccountAddress || !agentAddress) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await axios.post('/api/delegation/revoke', {
        smartAccountAddress,
        agentAddress,
      });

      setDelegationCreated(false);
      setSuccess('Delegation revoked successfully! You can create a new one.');
    } catch (err: any) {
      console.error('Delegation revoke error:', err);
      setError(err.response?.data?.error || 'Failed to revoke delegation');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSmartAccount = async () => {
    if (!address) return;

    setLoading(true);
    setError('');
    try {
      // Generate a deterministic private key from wallet address for demo
      // In production, use proper MetaMask SDK
      const demoPrivateKey = `0x${address.slice(2).padStart(64, '0')}`;

      const response = await axios.post('/api/smart-account/create', {
        signerPrivateKey: demoPrivateKey,
      });

      setSmartAccountAddress(response.data.smartAccountAddress);
      setSuccess(`Smart Account created: ${response.data.smartAccountAddress.slice(0, 10)}...`);

      // Generate deterministic agent address based on wallet address
      // This ensures the same wallet always gets the same agent address
      const deterministicAgentAddr = getDeterministicAgentAddress(address);
      setAgentAddress(deterministicAgentAddr);

    } catch (err: any) {
      console.error('Smart account creation error:', err);
      setError(err.response?.data?.error || 'Failed to create smart account');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDelegation = async () => {
    if (!smartAccountAddress || !agentAddress || !address) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Create EIP-712 typed data for delegation signature
      const domain = {
        name: 'Asset Nest Delegation',
        version: '1',
        chainId: chainId, // Use connected wallet's chainId
        verifyingContract: smartAccountAddress as `0x${string}`,
      };

      const types = {
        Delegation: [
          { name: 'delegate', type: 'address' },
          { name: 'delegator', type: 'address' },
          { name: 'authority', type: 'address' },
          { name: 'caveats', type: 'Caveat[]' },
          { name: 'salt', type: 'uint256' },
        ],
        Caveat: [
          { name: 'enforcer', type: 'address' },
          { name: 'terms', type: 'bytes' },
        ],
      };

      const salt = BigInt(Date.now());

      const message = {
        delegate: agentAddress,
        delegator: smartAccountAddress,
        authority: '0x0000000000000000000000000000000000000000' as `0x${string}`,
        caveats: [],
        salt,
      };

      // Trigger MetaMask signature popup
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Delegation',
        message,
      });

      setSuccess('Signature received! Creating delegation...');

      // For demo purposes, we'll still use the API with private key
      // In production, send the signature to the backend
      const demoPrivateKey = `0x${address.slice(2).padStart(64, '0')}`;

      const response = await axios.post('/api/delegation/create', {
        smartAccountAddress,
        agentAddress,
        signerPrivateKey: demoPrivateKey,
        type: 'open',
      });

      setDelegationCreated(true);
      setSuccess('Delegation created! Agent can now rebalance your portfolio.');

      // Auto-fetch portfolio
      await fetchPortfolio();
      setStep('portfolio');

    } catch (err: any) {
      console.error('Delegation creation error:', err);
      if (err.message?.includes('User rejected')) {
        setError('Signature rejected. Please approve in MetaMask to continue.');
      } else {
        setError(err.response?.data?.error || err.message || 'Failed to create delegation');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPortfolio = async () => {
    const targetAddr = smartAccountAddress || address;
    if (!targetAddr) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`/api/portfolio/balances?address=${targetAddr}`);
      setHoldings(response.data.holdings);
      setTotalValueUSD(response.data.totalValueUSD);
      setSuccess('Portfolio loaded successfully');
    } catch (err: any) {
      console.error('Portfolio fetch error:', err);
      setError(err.response?.data?.error || 'Failed to fetch portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleComputeStrategy = async () => {
    if (holdings.length === 0) {
      setError('No holdings found. Fund your wallet first.');
      return;
    }

    const targetSum = targets.reduce((sum, t) => sum + t.targetPercentage, 0);
    if (Math.abs(targetSum - 100) > 0.1) {
      setError(`Targets must sum to 100%, got ${targetSum.toFixed(1)}%`);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.post('/api/rebalance/strategy', {
        holdings: holdings.map((h) => ({
          token: h.token,
          symbol: h.symbol,
          balance: h.balance,
          valueUSD: h.valueUSD,
        })),
        targets,
      });

      setStrategy(response.data.strategy);
      setSuccess(`AI computed ${response.data.strategy.trades.length} trades`);
      setStep('rebalance');
    } catch (err: any) {
      console.error('Strategy error:', err);
      setError(err.response?.data?.error || 'Failed to compute strategy');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteRebalance = async () => {
    if (!strategy || !address) return;

    setLoading(true);
    setError('');
    try {
      const demoPrivateKey = `0x${address.slice(2).padStart(64, '0')}`;

      const response = await axios.post('/api/rebalance/execute', {
        trades: strategy.trades,
        smartAccountPrivateKey: demoPrivateKey,
      });

      setSuccess(`Executed! TX: ${response.data.userOpHash.slice(0, 10)}...`);

      // Refresh portfolio
      await fetchPortfolio();

    } catch (err: any) {
      console.error('Execution error:', err);
      setError(err.response?.data?.details || err.response?.data?.error || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = (symbol: string, value: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.symbol === symbol ? { ...t, targetPercentage: value } : t))
    );
  };

  // Smart decimal formatting: 3 decimals for values >= 1, 5 decimals for values < 1
  const formatValue = (value: number): string => {
    if (value >= 1) {
      return value.toFixed(3);
    } else {
      return value.toFixed(5);
    }
  };

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
            <span className="text-gray-900 font-bold">{success}</span>
          </div>
        </div>
      )}

      {/* Hero Landing Page */}
      {showHero && (
        <div className="min-h-[80vh] flex items-center justify-center fade-in">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Title */}
            <div className="space-y-4">
              <h1 className="text-7xl font-bold neon-text mb-4" style={{ textShadow: '0 0 20px rgba(0,255,247,0.8), 0 0 40px rgba(0,255,247,0.5)' }}>
                ASSET NEST
              </h1>
              <p className="text-3xl font-bold text-white mb-2">
                AI-Powered Portfolio Rebalancer
              </p>
              <p className="text-xl text-gray-300">
                Autonomous portfolio management on Monad using MetaMask Smart Accounts
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 mb-12">
              <div className="bg-black border-2 border-cyan-400 rounded-lg p-6 shadow-[0_0_20px_rgba(0,255,247,0.3)]">
                <div className="text-4xl mb-3">🤖</div>
                <h3 className="text-xl font-bold text-cyan-400 mb-2">AI Agent</h3>
                <p className="text-gray-300 text-sm">
                  Intelligent rebalancing strategies powered by advanced AI algorithms
                </p>
              </div>

              <div className="bg-black border-2 border-purple-400 rounded-lg p-6 shadow-[0_0_20px_rgba(191,0,255,0.3)]">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-purple-400 mb-2">Smart Accounts</h3>
                <p className="text-gray-300 text-sm">
                  Gasless transactions with MetaMask Delegation Toolkit (ERC-4337)
                </p>
              </div>

              <div className="bg-black border-2 border-green-400 rounded-lg p-6 shadow-[0_0_20px_rgba(57,255,20,0.3)]">
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="text-xl font-bold text-green-400 mb-2">Monad L1</h3>
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
                style={{ boxShadow: '0 0 40px rgba(0,255,247,0.6)' }}
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

      {/* Step Indicator */}
      {!showHero && (
        <>
          <div className="card">
            <div className="grid grid-cols-4 gap-2">
              {['connect', 'setup', 'portfolio', 'rebalance'].map((s, i) => (
                <div
                  key={s}
                  className={`text-center py-2 px-1 rounded-lg text-sm font-bold uppercase ${
                    step === s
                      ? 'bg-black border-2 border-cyan-400 text-cyan-400 shadow-[0_0_20px_rgba(0,255,247,0.5)]'
                      : 'bg-black border border-gray-700 text-gray-500'
                  }`}
                >
                  {i + 1}. {s}
                </div>
              ))}
            </div>
          </div>

          {/* Connect Wallet */}
      {step === 'connect' && !isConnected && (
        <div className="card fade-in text-center">
          <h2 className="text-4xl font-bold mb-4 neon-text">
            ASSET NEST
          </h2>
          <p className="text-xl mb-2">AI PORTFOLIO REBALANCER</p>
          <p className="mb-6 text-gray-400">
            Connect MetaMask on Monad Testnet
          </p>
          <div className="space-y-4">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={loading}
                className="btn btn-primary w-full max-w-md mx-auto block text-lg"
              >
                {loading ? 'CONNECTING...' : `CONNECT ${connector.name.toUpperCase()}`}
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-500">
            Chain ID: 10143 | Monad Testnet
          </p>
        </div>
      )}

      {/* Connected Wallet Info */}
      {isConnected && address && (
        <div className="card fade-in">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 uppercase">Connected Wallet</div>
              <div className="mono font-bold text-2xl neon-text">
                {address.slice(0, 10)}...{address.slice(-8)}
              </div>
            </div>
            <button onClick={handleDisconnect} className="btn btn-secondary">
              DISCONNECT
            </button>
          </div>
        </div>
      )}

      {/* Setup Smart Account & Delegation */}
      {step === 'setup' && isConnected && (
        <div className="card fade-in">
          <h2 className="text-3xl font-bold mb-6 neon-text">
            SETUP SMART ACCOUNT
          </h2>
          <div className="space-y-6">
            {!smartAccountAddress ? (
              <div>
                <p className="mb-4 text-gray-300">
                  Create a MetaMask Smart Account with ERC-4337 capabilities
                </p>
                <button
                  onClick={handleCreateSmartAccount}
                  disabled={loading}
                  className="btn btn-primary w-full text-lg"
                >
                  {loading ? 'CREATING...' : 'CREATE SMART ACCOUNT'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-800/50 rounded-lg border-2 border-cyan-400">
                  <div className="text-sm text-gray-400">Smart Account Address</div>
                  <div className="mono text-cyan-400 font-bold">
                    {smartAccountAddress.slice(0, 20)}...{smartAccountAddress.slice(-18)}
                  </div>
                </div>

                {agentAddress && (
                  <div className="p-4 bg-gray-800/50 rounded-lg border-2 border-purple-400">
                    <div className="text-sm text-gray-400">AI Agent Address</div>
                    <div className="mono text-purple-400 font-bold">
                      {agentAddress.slice(0, 20)}...{agentAddress.slice(-18)}
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
                          <div className="text-green-400 text-xl">✓</div>
                          <div>
                            <div className="font-bold text-white">Execute Trades</div>
                            <div className="text-sm text-gray-400">
                              Agent can swap tokens on your behalf using Monorail
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="text-green-400 text-xl">✓</div>
                          <div>
                            <div className="font-bold text-white">Rebalance Portfolio</div>
                            <div className="text-sm text-gray-400">
                              Agent can adjust your token allocations to match target percentages
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="text-green-400 text-xl">✓</div>
                          <div>
                            <div className="font-bold text-white">Gasless Transactions</div>
                            <div className="text-sm text-gray-400">
                              Execute trades without paying gas fees (ERC-4337)
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t-2 border-green-400/30">
                        <h4 className="font-bold text-yellow-400 mb-2">RESTRICTIONS</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span className="text-gray-300">
                              <span className="font-bold">Type:</span> Open Delegation (Unrestricted)
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span className="text-gray-300">
                              <span className="font-bold">Delegate:</span> {agentAddress.slice(0, 10)}...{agentAddress.slice(-8)}
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400">⚠</span>
                            <span className="text-gray-300">
                              <span className="font-bold">Expiration:</span> No expiration (revocable anytime)
                            </span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-cyan-400">ℹ</span>
                            <span className="text-gray-300">
                              <span className="font-bold">Standard:</span> ERC-7710 Delegation
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-black rounded-lg border-2 border-purple-400/50">
                      <p className="text-sm text-gray-300">
                        <span className="font-bold text-purple-400">Note:</span> You will be prompted to sign this delegation in MetaMask.
                        This creates a cryptographic signature proving you authorize the AI agent to trade on your behalf.
                      </p>
                    </div>

                    <button
                      onClick={handleCreateDelegation}
                      disabled={loading}
                      className="btn btn-success w-full text-lg"
                    >
                      {loading ? 'WAITING FOR SIGNATURE...' : 'SIGN DELEGATION IN METAMASK'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-6 bg-black rounded-lg border-2 border-green-400 shadow-[0_0_30px_rgba(57,255,20,0.3)]">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-green-400 text-3xl">✓</div>
                        <div>
                          <h3 className="text-xl font-bold text-green-400">
                            DELEGATION ACTIVE
                          </h3>
                          <p className="text-sm text-gray-300">
                            AI agent is authorized to rebalance your portfolio
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm border-t-2 border-green-400/30 pt-4 mt-4">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Agent Address:</span>
                          <span className="mono text-green-400">{agentAddress.slice(0, 10)}...{agentAddress.slice(-8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Smart Account:</span>
                          <span className="mono text-green-400">{smartAccountAddress.slice(0, 10)}...{smartAccountAddress.slice(-8)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Status:</span>
                          <span className="text-green-400 font-bold">Active</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleRevokeDelegation}
                        disabled={loading}
                        className="btn btn-danger text-lg"
                      >
                        {loading ? 'REVOKING...' : 'REVOKE DELEGATION'}
                      </button>
                      <button
                        onClick={fetchPortfolio}
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
      {step === 'portfolio' && (
        <div className="card fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold neon-text">YOUR PORTFOLIO</h2>
            <button
              onClick={fetchPortfolio}
              disabled={loading}
              className="btn btn-secondary"
            >
              {loading ? 'LOADING...' : 'REFRESH'}
            </button>
          </div>

          <div className="space-y-6">
            <div className="text-center p-6 bg-black rounded-lg border-2 border-cyan-400 shadow-[0_0_30px_rgba(0,255,247,0.3)]">
              <div className="text-5xl font-bold neon-text">
                ${formatValue(totalValueUSD)}
              </div>
              <div className="text-gray-400 mt-2">TOTAL VALUE</div>
            </div>

            {holdings.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>TOKEN</th>
                        <th>BALANCE</th>
                        <th>VALUE</th>
                        <th>ALLOCATION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h) => {
                        const balance = Number(h.balance) / 10 ** h.decimals;
                        return (
                          <tr key={h.symbol}>
                            <td className="font-bold text-cyan-400 text-lg">{h.symbol}</td>
                            <td className="mono">
                              {formatValue(balance)}
                            </td>
                            <td className="font-bold">${formatValue(h.valueUSD)}</td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="flex-1 bg-black border border-cyan-400/30 rounded-full h-3 overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-400 shadow-[0_0_10px_rgba(0,255,247,0.5)]"
                                    style={{ width: `${h.percentage}%` }}
                                  ></div>
                                </div>
                                <span className="font-bold min-w-[60px]">{h.percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t-2 border-cyan-400/30 pt-6">
                  <h3 className="text-2xl font-bold mb-4 text-cyan-400">TARGET ALLOCATION</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {targets.map((t) => (
                      <div key={t.symbol} className="space-y-2">
                        <label className="block text-sm font-bold text-gray-400 uppercase">
                          {t.symbol} (%)
                        </label>
                        <input
                          type="number"
                          value={t.targetPercentage}
                          onChange={(e) => updateTarget(t.symbol, parseFloat(e.target.value) || 0)}
                          min="0"
                          max="100"
                          step="5"
                          className="text-xl font-bold"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <span className="text-lg">
                      TOTAL: <span className={`font-bold ${
                        Math.abs(targets.reduce((sum, t) => sum + t.targetPercentage, 0) - 100) < 0.1
                          ? 'text-green-400'
                          : 'text-red-400'
                      }`}>
                        {targets.reduce((sum, t) => sum + t.targetPercentage, 0).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleComputeStrategy}
                  disabled={loading}
                  className="btn btn-success w-full text-lg"
                >
                  {loading ? 'COMPUTING...' : 'COMPUTE AI STRATEGY →'}
                </button>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-xl text-gray-400 mb-4">NO TOKENS FOUND</p>
                <p className="text-gray-500">
                  Get testnet tokens at{' '}
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
      {step === 'rebalance' && strategy && (
        <div className="card fade-in">
          <h2 className="text-3xl font-bold mb-6 neon-text">
            AI REBALANCING STRATEGY
          </h2>

          <div className="space-y-6">
            <div className="p-6 bg-black rounded-lg border-2 border-purple-400 shadow-[0_0_30px_rgba(191,0,255,0.3)]">
              <h3 className="font-bold mb-3 text-purple-400 text-xl">AI RATIONALE:</h3>
              <p className="text-gray-200 leading-relaxed">{strategy.rationale}</p>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-cyan-400 text-xl">
                REQUIRED TRADES ({strategy.trades.length})
              </h3>
              {strategy.trades.length > 0 ? (
                <div className="space-y-3">
                  {strategy.trades.map((trade, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-800/50 rounded-lg border-2 border-cyan-400/30 hover:border-cyan-400 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-red-400">{trade.fromSymbol}</span>
                          <span className="text-cyan-400">→</span>
                          <span className="text-2xl font-bold text-green-400">{trade.toSymbol}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">{trade.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-green-400 text-xl font-bold">
                  ✓ PORTFOLIO ALREADY BALANCED!
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-800/50 rounded-lg border-2 border-cyan-400/30">
              <div className="text-sm text-gray-400">
                ESTIMATED GAS: <span className="mono text-cyan-400">{strategy.estimatedGas}</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('portfolio')}
                className="btn btn-secondary flex-1 text-lg"
              >
                ← BACK
              </button>
              <button
                onClick={handleExecuteRebalance}
                disabled={strategy.trades.length === 0 || loading}
                className="btn btn-primary flex-1 text-lg"
              >
                {loading ? 'EXECUTING...' : 'EXECUTE REBALANCING →'}
              </button>
            </div>
          </div>
        </div>
      )}

        </>
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
    </div>
  );
}
