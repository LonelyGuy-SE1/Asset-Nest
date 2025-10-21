'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
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

  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<'connect' | 'setup' | 'portfolio' | 'rebalance'>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [smartAccountAddress, setSmartAccountAddress] = useState('');
  const [agentAddress, setAgentAddress] = useState('');
  const [delegationCreated, setDelegationCreated] = useState(false);

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
      setStep('setup');
      setSuccess(`Wallet connected: ${address.slice(0, 10)}...`);

      // Set deterministic agent address immediately on connection
      const deterministicAgentAddr = getDeterministicAgentAddress(address);
      setAgentAddress(deterministicAgentAddr);
    }
  }, [isConnected, address, mounted]);

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
    try {
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
      setError(err.response?.data?.error || 'Failed to create delegation');
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

      {/* Step Indicator */}
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
            <button onClick={() => disconnect()} className="btn btn-secondary">
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
                  <div>
                    <p className="mb-4 text-gray-300">
                      Grant the AI agent permission to rebalance your portfolio
                    </p>
                    <button
                      onClick={handleCreateDelegation}
                      disabled={loading}
                      className="btn btn-success w-full text-lg"
                    >
                      {loading ? 'CREATING...' : 'CREATE DELEGATION'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={fetchPortfolio}
                    disabled={loading}
                    className="btn btn-primary w-full text-lg"
                  >
                    CONTINUE TO PORTFOLIO →
                  </button>
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
            <div className="text-center p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border-2 border-cyan-400">
              <div className="text-5xl font-bold neon-text">
                ${totalValueUSD.toFixed(2)}
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
                      {holdings.map((h) => (
                        <tr key={h.symbol}>
                          <td className="font-bold text-cyan-400 text-lg">{h.symbol}</td>
                          <td className="mono">
                            {(Number(h.balance) / 10 ** h.decimals).toFixed(6)}
                          </td>
                          <td className="font-bold">${h.valueUSD.toFixed(2)}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                                  style={{ width: `${h.percentage}%` }}
                                ></div>
                              </div>
                              <span className="font-bold min-w-[60px]">{h.percentage.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
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
            <div className="p-6 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg border-2 border-purple-400">
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
