'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, Unlink, LogOut, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { useDisconnect, useAccount } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'

interface WalletInfoProps {
  address: string
  onUnbind: () => void
  isUnbinding?: boolean
}

export function WalletInfo({ address, onUnbind, isUnbinding }: WalletInfoProps) {
  const { disconnect } = useDisconnect()
  const { isConnected } = useAccount()
  const { open } = useAppKit()
  
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast.success('Address copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy address')
    }
  }

  const viewOnExplorer = () => {
    window.open(`https://etherscan.io/address/${address}`, '_blank')
  }

  const handleDisconnect = () => {
    disconnect()
    toast.success('Wallet disconnected from browser')
  }

  const handleReconnect = () => {
    open()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Wallet Information</CardTitle>
        <Badge variant={isConnected ? "default" : "secondary"} className={isConnected ? "bg-green-600" : ""}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Wallet Address</p>
          <div className="flex items-center space-x-2">
            <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
              {formatAddress(address)}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyAddress}
              className="h-6 w-6 p-0"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={viewOnExplorer}
              className="h-6 w-6 p-0"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t space-y-2">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect Wallet
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onUnbind}
                disabled={isUnbinding}
                className="w-full"
              >
                <Unlink className="w-4 h-4 mr-2" />
                {isUnbinding ? 'Unbinding...' : 'Unbind Wallet'}
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Wallet disconnected from browser. Reconnect to access wallet features.
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={handleReconnect}
                className="w-full"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Reconnect Wallet
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}