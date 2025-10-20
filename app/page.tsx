'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState, useEffect } from 'react';
import axios from 'axios';

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
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [step, setStep] = useState<'connect' | 'portfolio' | 'rebalance'>('connect');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [smartAccountAddress, setSmartAccountAddress] = useState('');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalValueUSD, setTotalValueUSD] = useState(0);

  const [targets, setTargets] = useState<Target[]>([
    { symbol: 'MON', targetPercentage: 40 },
    { symbol: 'USDC', targetPercentage: 30 },
    { symbol: 'USDT', targetPercentage: 20 },
    { symbol: 'WETH', targetPercentage: 10 },
  ]);
  const [strategy, setStrategy] = useState<Strategy | null>(null);

  // Auto-fetch portfolio when wallet connects
  useEffect(() => {
    if (isConnected && address && !smartAccountAddress) {
      setSmartAccountAddress(address);
      setSuccess(`Wallet connected: ${address.slice(0, 10)}...${address.slice(-8)}`);
      setStep('portfolio');
      fetchPortfolio(address);
    }
  }, [isConnected, address]);

  const fetchPortfolio = async (addr?: string) => {
    const targetAddr = addr || smartAccountAddress;
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
      setError('No holdings found. Please fund your wallet first.');
      return;
    }

    const targetSum = targets.reduce((sum, t) => sum + t.targetPercentage, 0);
    if (Math.abs(targetSum - 100) > 0.1) {
      setError(`Target percentages must sum to 100%, got ${targetSum}%`);
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
      setSuccess(`AI Strategy computed: ${response.data.strategy.trades.length} trades required`);
      setStep('rebalance');
    } catch (err: any) {
      console.error('Strategy computation error:', err);
      setError(err.response?.data?.error || 'Failed to compute strategy');
    } finally {
      setLoading(false);
    }
  };

  const updateTarget = (symbol: string, value: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.symbol === symbol ? { ...t, targetPercentage: value } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {error && (
        <div className="card bg-vscode-error/20 border-vscode-error fade-in">
          <div className="flex items-center">
            <span className="status-dot status-error"></span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="card bg-vscode-success/20 border-vscode-success fade-in">
          <div className="flex items-center">
            <span className="status-dot status-success"></span>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Wallet Connection */}
      {!isConnected ? (
        <div className="card fade-in text-center">
          <h2 className="text-2xl font-bold mb-4 text-vscode-accent">
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-vscode-text/80">
            Connect MetaMask on Monad Testnet to start rebalancing your portfolio
          </p>
          <div className="space-y-2">
            {connectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => connect({ connector })}
                disabled={loading}
                className="btn btn-primary w-full max-w-md mx-auto block"
              >
                {loading ? 'Connecting...' : `Connect ${connector.name}`}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-vscode-text/60">
            Make sure you&apos;re on Monad Testnet (Chain ID: 10143)
          </p>
        </div>
      ) : (
        <>
          {/* Connected Wallet Info */}
          <div className="card fade-in">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-vscode-text/60">Connected Wallet</div>
                <div className="mono font-bold text-vscode-accent">
                  {address?.slice(0, 10)}...{address?.slice(-8)}
                </div>
              </div>
              <button onClick={() => disconnect()} className="btn btn-secondary">
                Disconnect
              </button>
            </div>
          </div>

          {/* Portfolio View */}
          {step === 'portfolio' && (
            <div className="card fade-in">
              <h2 className="text-2xl font-bold mb-4 text-vscode-accent">Your Portfolio</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-3xl font-bold">${totalValueUSD.toFixed(2)}</div>
                    <div className="text-sm text-vscode-text/60">Total Portfolio Value</div>
                  </div>
                  <button onClick={() => fetchPortfolio()} disabled={loading} className="btn btn-secondary">
                    {loading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                {holdings.length > 0 ? (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Balance</th>
                          <th>Value (USD)</th>
                          <th>Allocation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => (
                          <tr key={h.symbol}>
                            <td className="font-bold">{h.symbol}</td>
                            <td className="mono">
                              {(Number(h.balance) / 10 ** h.decimals).toFixed(6)}
                            </td>
                            <td>${h.valueUSD.toFixed(2)}</td>
                            <td>
                              <div className="flex items-center">
                                <div className="w-32 bg-vscode-panel rounded-full h-2 mr-2">
                                  <div
                                    className="bg-vscode-accent h-2 rounded-full"
                                    style={{ width: `${h.percentage}%` }}
                                  ></div>
                                </div>
                                <span>{h.percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="pt-4 border-t border-vscode-border">
                      <h3 className="text-xl font-bold mb-3">Set Target Allocation</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {targets.map((t) => (
                          <div key={t.symbol}>
                            <label className="block mb-1 text-sm font-medium">{t.symbol} (%)</label>
                            <input
                              type="number"
                              value={t.targetPercentage}
                              onChange={(e) => updateTarget(t.symbol, parseFloat(e.target.value) || 0)}
                              min="0"
                              max="100"
                              step="1"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm text-vscode-text/60">
                        Total: {targets.reduce((sum, t) => sum + t.targetPercentage, 0).toFixed(1)}%
                        (must equal 100%)
                      </div>
                    </div>

                    <button onClick={handleComputeStrategy} disabled={loading} className="btn btn-success w-full">
                      {loading ? 'Computing...' : 'Compute AI Rebalancing Strategy →'}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-8 text-vscode-text/60">
                    <p className="mb-2">No tokens found in your wallet.</p>
                    <p className="text-sm">
                      Get testnet tokens:{' '}
                      <a
                        href="https://faucet.monad.xyz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-vscode-accent hover:underline"
                      >
                        Monad Faucet
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
              <h2 className="text-2xl font-bold mb-4 text-vscode-accent">
                AI Rebalancing Strategy
              </h2>
              <div className="space-y-4">
                <div className="p-4 bg-vscode-panel rounded">
                  <h3 className="font-bold mb-2">AI Rationale:</h3>
                  <p className="text-sm">{strategy.rationale}</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">Required Trades ({strategy.trades.length})</h3>
                  {strategy.trades.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>From</th>
                          <th>To</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {strategy.trades.map((trade, index) => (
                          <tr key={index}>
                            <td className="font-bold">{trade.fromSymbol}</td>
                            <td className="font-bold">{trade.toSymbol}</td>
                            <td className="text-sm">{trade.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-4 text-vscode-success">
                      ✓ Portfolio already balanced! No trades needed.
                    </div>
                  )}
                </div>

                <div className="p-4 bg-vscode-panel rounded">
                  <div className="text-sm text-vscode-text/60">
                    Estimated Gas: <span className="mono">{strategy.estimatedGas}</span>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button onClick={() => setStep('portfolio')} className="btn btn-secondary flex-1">
                    ← Back to Portfolio
                  </button>
                  <button
                    onClick={() => setSuccess('Execution requires Smart Account delegation. Feature coming soon!')}
                    className="btn btn-success flex-1"
                    disabled={strategy.trades.length === 0}
                  >
                    Execute Rebalancing →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card text-center">
            <div className="spinner mx-auto mb-4"></div>
            <div>Processing...</div>
          </div>
        </div>
      )}
    </div>
  );
}
