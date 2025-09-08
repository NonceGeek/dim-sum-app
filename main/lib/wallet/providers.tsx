'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import React, { type ReactNode, useState } from 'react'

import { wagmiConfig, projectId, metadata, wagmiAdapter } from './config'
import { mainnet, polygon, optimism, arbitrum } from '@reown/appkit/networks'

// Setup queryClient
const queryClient = new QueryClient()

if (!projectId) throw new Error('Project ID is not defined')

// Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks: [mainnet, polygon, optimism, arbitrum],
  metadata,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-color-mix-strength': 40
  }
})

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}