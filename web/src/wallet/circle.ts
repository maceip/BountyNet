/**
 * Circle Modular Wallet integration.
 *
 * Uses @circle-fin/modular-wallets-core for passkey-based smart accounts.
 * Supports gasless transactions via Circle's bundler + paymaster.
 *
 * CORS-approved domains from .env:
 *   CIRCLE_CLIENT_LOCALHOST  → localhost dev
 *   CIRCLE_CLIENT_WEBEXT     → browser extension
 *   CIRCLE_CLIENT_TOKENS     → tokens.stare.network
 *
 * Supported testnets: arbitrumSepolia, arcTestnet, baseSepolia,
 *                     optimismSepolia, polygonAmoy, unichainSepolia
 */

import {
  toPasskeyTransport,
  toWebAuthnCredential,
  toModularTransport,
  toCircleSmartAccount,
  encodeTransfer,
} from '@circle-fin/modular-wallets-core'
import { createPublicClient, defineChain } from 'viem'
import { createBundlerClient, toWebAuthnAccount } from 'viem/account-abstraction'

// ── Arc Testnet chain definition ───────────────────────────────

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'Arc', symbol: 'ARC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } },
  testnet: true,
})

// ── Config ─────────────────────────────────────────────────────

const CLIENT_KEY = import.meta.env.VITE_CIRCLE_CLIENT_KEY || ''
const CLIENT_URL = import.meta.env.VITE_CIRCLE_CLIENT_URL || ''

// Arc Testnet — Circle's own L1, heavy faucet access, Arc bounty eligible
const DEFAULT_CHAIN = arcTestnet
const DEFAULT_CHAIN_SLUG = 'arcTestnet'

export type CircleWalletState = {
  address: string
  chainId: number
  chainName: string
  smartAccount: any
  bundlerClient: any
}

// ── Passkey registration (new wallet) ──────────────────────────

export async function registerWallet(username: string): Promise<CircleWalletState> {
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY)

  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: 'Register' as any,
    username,
  })

  return setupSmartAccount(credential)
}

// ── Passkey login (existing wallet) ────────────────────────────

export async function loginWallet(): Promise<CircleWalletState> {
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY)

  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: 'Login' as any,
  })

  return setupSmartAccount(credential)
}

// ── Shared setup ───────────────────────────────────────────────

async function setupSmartAccount(credential: any): Promise<CircleWalletState> {
  // Transport for the target chain
  const modularTransport = toModularTransport(
    `${CLIENT_URL}/${DEFAULT_CHAIN_SLUG}`,
    CLIENT_KEY,
  )

  // Public client for chain reads
  const client = createPublicClient({
    chain: DEFAULT_CHAIN,
    transport: modularTransport,
  })

  // Circle Smart Account (MSCA)
  const smartAccount = await toCircleSmartAccount({
    client,
    owner: toWebAuthnAccount({ credential }),
  })

  // Bundler client for sending user operations
  const bundlerClient = createBundlerClient({
    account: smartAccount,
    chain: DEFAULT_CHAIN,
    transport: modularTransport,
  })

  return {
    address: smartAccount.address,
    chainId: DEFAULT_CHAIN.id,
    chainName: DEFAULT_CHAIN.name,
    smartAccount,
    bundlerClient,
  }
}

// ── Send gasless transaction ───────────────────────────────────

export async function sendGaslessTransfer(
  bundlerClient: any,
  to: `0x${string}`,
  tokenAddress: `0x${string}`,
  amount: bigint,
): Promise<{ userOpHash: string; txHash: string }> {
  const userOpHash = await bundlerClient.sendUserOperation({
    calls: [encodeTransfer(to, tokenAddress, amount)],
    paymaster: true,
  })

  const { receipt } = await bundlerClient.waitForUserOperationReceipt({
    hash: userOpHash,
  })

  return { userOpHash, txHash: receipt.transactionHash }
}

// ── Chain configs for switching ────────────────────────────────

export const SUPPORTED_CHAINS = [
  { slug: 'arcTestnet', name: 'Arc Testnet', chainId: 5042002 },
  { slug: 'arbitrumSepolia', name: 'Arbitrum Sepolia', chainId: 421614 },
  { slug: 'baseSepolia', name: 'Base Sepolia', chainId: 84532 },
  { slug: 'optimismSepolia', name: 'Optimism Sepolia', chainId: 11155420 },
  { slug: 'polygonAmoy', name: 'Polygon Amoy', chainId: 80002 },
  { slug: 'unichainSepolia', name: 'Unichain Sepolia', chainId: 1301 },
] as const

// Arc Testnet CCTP addresses (for cross-chain USDC)
export const ARC_CCTP = {
  tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as const,
  messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as const,
  domain: 26,
} as const
