import '@fontsource-variable/raleway'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http, useReadContract, useWriteContract, useAccount, useWatchContractEvent } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { ConnectButton, RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { formatUnits } from 'viem'
import { useCallback, useState } from 'react'
import '@rainbow-me/rainbowkit/styles.css'
import WatercolorCanvas from './scene/WatercolorCanvas'
import { Card, Accordion, Dropdown, Popover, Button, Stat, Badge, palette, font, tracking, glass } from './components'

const RPC_URL = import.meta.env.VITE_SEPOLIA_RPC_URL || 'http://localhost:8545'

const connectors = connectorsForWallets(
  [{ groupName: 'Recommended', wallets: [metaMaskWallet, walletConnectWallet] }],
  { appName: 'Hack Prep', projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '' },
)

const config = createConfig({
  connectors,
  chains: [sepolia],
  transports: { [sepolia.id]: http(RPC_URL) },
})

const queryClient = new QueryClient()
const COUNTER_ADDRESS = (import.meta.env.VITE_COUNTER_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`

const COUNTER_ABI = [
  { type: 'function', name: 'dashboard', inputs: [], outputs: [{ type: 'tuple', components: [
    { name: 'count', type: 'uint256' },
    { name: 'eurcTotalSupply', type: 'uint256' },
    { name: 'usdcTotalSupply', type: 'uint256' },
    { name: 'lastRefreshBlock', type: 'uint256' },
    { name: 'lastResolvedAddr', type: 'address' },
    { name: 'lastResolvedNode', type: 'bytes32' },
    { name: 'ensRegistryAddr', type: 'address' },
    { name: 'eurcTokenAddr', type: 'address' },
    { name: 'usdcTokenAddr', type: 'address' },
    { name: 'eurcLiveSupply', type: 'uint256' },
    { name: 'usdcLiveSupply', type: 'uint256' },
    { name: 'callerEurcBalance', type: 'uint256' },
    { name: 'callerUsdcBalance', type: 'uint256' },
    { name: 'ensNodeOwner', type: 'address' },
  ]}], stateMutability: 'view' },
  { type: 'function', name: 'increment', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'decrement', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'refresh', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'event', name: 'CountChanged', inputs: [{ name: 'newCount', type: 'uint256', indexed: false }, { name: 'changedBy', type: 'address', indexed: false }] },
  { type: 'event', name: 'Refreshed', inputs: [{ name: 'eurcSupply', type: 'uint256', indexed: false }, { name: 'usdcSupply', type: 'uint256', indexed: false }, { name: 'blockNumber', type: 'uint256', indexed: false }] },
] as const

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <WatercolorCanvas />
          <div style={{
            position: 'relative',
            zIndex: 1,
            minHeight: '100vh',
            padding: '2rem',
            maxWidth: 660,
            margin: '0 auto',
          }}>
            <Header />
            <Dashboard />
            <Footer />
          </div>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

function Header() {
  return (
    <header style={{
      ...glass(),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      borderRadius: 20,
      marginBottom: '1.75rem',
      animation: 'fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <div>
        <h1 style={{
          fontFamily: font.family,
          fontSize: '1.1rem',
          fontWeight: 300,
          color: palette.ink,
          letterSpacing: tracking.ultra,
          textTransform: 'uppercase',
          margin: 0,
        }}>
          Hack Prep
        </h1>
        <div style={{
          fontFamily: font.family,
          fontSize: '0.55rem',
          fontWeight: 500,
          color: palette.inkMuted,
          letterSpacing: tracking.widest,
          textTransform: 'uppercase',
          marginTop: 4,
        }}>
          ETHGlobal Cannes 2026
        </div>
      </div>
      <ConnectButton />
    </header>
  )
}

function Dashboard() {
  const { address } = useAccount()
  const { writeContract } = useWriteContract()
  const [selectedNetwork, setNetwork] = useState('sepolia')

  const { data: dash, refetch } = useReadContract({
    address: COUNTER_ADDRESS,
    abi: COUNTER_ABI,
    functionName: 'dashboard',
    account: address,
    query: { refetchInterval: 15_000 },
  })

  const onEvent = useCallback(() => { refetch() }, [refetch])
  useWatchContractEvent({ address: COUNTER_ADDRESS, abi: COUNTER_ABI, eventName: 'CountChanged', onLogs: onEvent })
  useWatchContractEvent({ address: COUNTER_ADDRESS, abi: COUNTER_ABI, eventName: 'Refreshed', onLogs: onEvent })

  const doTx = (fn: 'increment' | 'decrement' | 'refresh') => {
    writeContract(
      { address: COUNTER_ADDRESS, abi: COUNTER_ABI, functionName: fn },
      { onSuccess: () => setTimeout(() => refetch(), 2000) },
    )
  }

  const zero = '0x0000000000000000000000000000000000000000'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Counter */}
      <div className="dashboard-card">
        <Card title="Counter" accent={palette.teal}>
          <Stat label="Count" value={dash ? dash.count.toString() : '—'} big accent={palette.teal} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <Button color={palette.teal} onClick={() => doTx('increment')}>+ Increment</Button>
            <Button color={palette.mauve} onClick={() => doTx('decrement')}>- Decrement</Button>
          </div>
        </Card>
      </div>

      {/* EURC (primary) */}
      <div className="dashboard-card">
        <Card title="Circle EURC" accent={palette.sea}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Badge color={palette.sea}>Live</Badge>
            <Badge color={palette.lavender} variant="outline">Arc Testnet</Badge>
          </div>
          <Stat label="EURC Supply" value={dash ? `${formatUnits(dash.eurcLiveSupply, 6)} EURC` : '—'} />
          <Stat label="Your EURC" value={dash && address ? `${formatUnits(dash.callerEurcBalance, 6)} EURC` : 'connect wallet'} big accent={palette.sea} />
          <Stat label="USDC Supply" value={dash ? `${formatUnits(dash.usdcLiveSupply, 6)} USDC` : '—'} sub />
          <Stat label="Your USDC" value={dash && address ? `${formatUnits(dash.callerUsdcBalance, 6)} USDC` : '—'} sub />
          <Stat label="EURC Token" value={dash?.eurcTokenAddr ?? '—'} mono />
          <Stat label="Last Refresh" value={dash?.lastRefreshBlock ? `block #${dash.lastRefreshBlock}` : 'never'} sub />
          <Button color={palette.sea} onClick={() => doTx('refresh')} style={{ marginTop: '0.75rem' }}>
            Refresh On-Chain
          </Button>
        </Card>
      </div>

      {/* ENS */}
      <div className="dashboard-card">
        <Card title="ENS" accent={palette.lavender}>
          <Stat label="Registry" value={dash?.ensRegistryAddr ?? '—'} mono />
          <Stat label="Last Resolved" value={dash?.lastResolvedAddr === zero ? 'none' : dash?.lastResolvedAddr ?? '—'} mono />
          <Stat label="Node Owner" value={dash?.ensNodeOwner === zero ? '—' : dash?.ensNodeOwner ?? '—'} mono />
        </Card>
      </div>

      {/* Contract Info — collapsible */}
      <div className="dashboard-card">
        <Card title="Contract" accent={palette.terra} collapsible>
          <Stat label="Proxy" value={COUNTER_ADDRESS} mono />
          <Stat label="Network" value="Sepolia" />
          <Stat label="RPC" value={RPC_URL} mono />
          <Stat label="Updates" value="event-driven + 15s fallback" sub />
        </Card>
      </div>

      {/* Network selector + info popover */}
      <div className="dashboard-card">
        <Card title="Network & Tools" accent={palette.mauve}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Dropdown
              label="Network"
              accent={palette.mauve}
              options={[
                { value: 'sepolia', label: 'Sepolia', icon: '\u26CF' },
                { value: 'worldchain', label: 'World Chain Sepolia', icon: '\u2B24' },
                { value: 'arc', label: 'Arc Testnet', icon: '\u25CE' },
              ]}
              value={selectedNetwork}
              onChange={setNetwork}
            />
            <Popover
              accent={palette.lavender}
              trigger={
                <Button color={palette.lavender} variant="outline" size="sm">Info</Button>
              }
            >
              <div style={{ fontFamily: font.family, letterSpacing: tracking.normal }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: palette.lavender, letterSpacing: tracking.widest, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                  About this node
                </div>
                <p style={{ fontSize: '0.82rem', color: palette.inkLight, lineHeight: 1.7, margin: 0 }}>
                  Self-hosted Geth + Lighthouse on EC2 (eu-central-1).
                  RPC is open on port 8545, WS on 8546.
                  Dashboard reads are batched into a single <code style={{ fontFamily: font.mono, fontSize: '0.75rem', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: 4 }}>dashboard()</code> call.
                </p>
              </div>
            </Popover>
          </div>
        </Card>
      </div>

      {/* Technical accordion */}
      <div className="dashboard-card">
        <Card title="Architecture" accent={palette.tealDark} collapsible defaultOpen={false}>
          <Accordion
            items={[
              {
                id: 'contracts',
                title: 'Smart Contracts',
                accent: palette.teal,
                content: (
                  <div>
                    UUPS upgradeable Counter with ENS registry reads, Circle USDC balance/supply queries,
                    and a single <code style={{ fontFamily: font.mono, fontSize: '0.78rem' }}>dashboard()</code> view
                    that returns all state in one RPC call.
                  </div>
                ),
              },
              {
                id: 'frontend',
                title: 'Frontend',
                accent: palette.sea,
                content: (
                  <div>
                    React 19 + Vite + wagmi + RainbowKit. OGL WebGL watercolor scene with ~340
                    brushstroke meshes, raycasting hover, depth parallax. Glassmorphic UI with
                    ITC Avant Garde Gothic tracking.
                  </div>
                ),
              },
              {
                id: 'infra',
                title: 'Infrastructure',
                accent: palette.terra,
                content: (
                  <div>
                    Geth + Lighthouse Sepolia node on EC2 m5ad.8xlarge.
                    AWS SSM Parameter Store for cross-machine secret sync.
                    CI via GitHub Actions: compile, Slither scan, deploy.
                  </div>
                ),
              },
              {
                id: 'mobile',
                title: 'Android App',
                accent: palette.mauve,
                content: (
                  <div>
                    Kotlin 2.1.20 + Jetpack Compose (BOM 2026.03) + Material 3 Expressive.
                    Web3j + ethers-kt for on-chain reads. JVM 21, SDK 36, NDK 28.
                  </div>
                ),
              },
            ]}
            multiple
          />
        </Card>
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '2.5rem 0 1.5rem',
      fontFamily: font.family,
      fontSize: '0.55rem',
      fontWeight: 500,
      color: palette.inkMuted,
      letterSpacing: tracking.widest,
      textTransform: 'uppercase',
    }}>
      ETHGlobal Cannes 2026 &mdash; Watercolor scene after Raoul Dufy
    </footer>
  )
}
