'use client'

import { useAppKit } from '@reown/appkit/react'
import { useAccount, useDisconnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet, Unlink } from 'lucide-react'
import { toast } from 'sonner'

interface ConnectButtonProps {
  onConnect?: (address: string) => void
  onDisconnect?: () => void
  className?: string
  showDisconnect?: boolean
}

export function ConnectButton({ onConnect, onDisconnect, className, showDisconnect = false }: ConnectButtonProps) {
  const { open } = useAppKit()
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()

  const handleConnect = () => {
    if (isConnected && address && onConnect) {
      onConnect(address)
    } else {
      open()
    }
  }

  const handleDisconnect = () => {
    disconnect()
    onDisconnect?.()
    toast.success('Wallet disconnected')
  }

  if (isConnected && showDisconnect) {
    return (
      <div className="flex space-x-2">
        <Button 
          onClick={handleConnect}
          className={className}
          variant="default"
        >
          <Wallet className="w-4 h-4 mr-2" />
          {`Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`}
        </Button>
        <Button 
          onClick={handleDisconnect}
          variant="destructive"
          size="sm"
        >
          <Unlink className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  return (
    <Button 
      onClick={handleConnect}
      className={className}
      variant={isConnected ? "default" : "outline"}
    >
      <Wallet className="w-4 h-4 mr-2" />
      {isConnected ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}` : 'Connect Wallet'}
    </Button>
  )
}