import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { mainnet, polygon, optimism, arbitrum } from 'viem/chains'

// Get projectId from https://cloud.reown.com
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'your-project-id-here'

if (!projectId) {
  throw new Error('Project ID is not defined')
}

export const metadata = {
  name: 'DimSum AI Labs',
  description: 'Cantonese AI Data & App Hub',
  url: 'https://search.aidimsum.com/',
  icons: ['/logo.png']
}

// Define the chains you want to support
export const chains = [mainnet, polygon, optimism, arbitrum]

// Create wagmi adapter
export const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, polygon, optimism, arbitrum],
  projectId
})

export const wagmiConfig = wagmiAdapter.wagmiConfig