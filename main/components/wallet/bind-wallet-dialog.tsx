'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { useAppKit } from '@reown/appkit/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetNonce, useBindWallet } from '@/lib/api/wallet'

interface BindWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (address: string) => void
}


export function BindWalletDialog({ open, onOpenChange, onSuccess }: BindWalletDialogProps) {
  const [step, setStep] = useState<'connect' | 'sign' | 'binding' | 'success' | 'error'>('connect')
  const [nonce, setNonce] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isWaitingForConnection, setIsWaitingForConnection] = useState(false)
  const [isSwitchingWallet, setIsSwitchingWallet] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const { address, isConnected } = useAccount()
  const { signMessage, isPending: isSigning } = useSignMessage()
  const { disconnect } = useDisconnect()
  const { open: openAppKit } = useAppKit()
  
  // React Query hooks
  const getNonceMutation = useGetNonce()
  const bindWalletMutation = useBindWallet()

  // 监听钱包连接状态变化
  useEffect(() => {
    if (isConnected && address && isWaitingForConnection && !isSwitchingWallet) {
      // 钱包连接成功后，重新显示弹窗并继续绑定流程（仅在非切换钱包状态下）
      setIsWaitingForConnection(false)
      onOpenChange(true)
    } else if (isConnected && address && isWaitingForConnection && isSwitchingWallet) {
      // 切换钱包后连接成功，重新显示弹窗
      setIsWaitingForConnection(false)
      setIsSwitchingWallet(false)
      onOpenChange(true)
    }
  }, [isConnected, address, isWaitingForConnection, isSwitchingWallet, onOpenChange])

  const resetDialog = () => {
    setStep('connect')
    setNonce('')
    setMessage('')
    setError('')
    setIsWaitingForConnection(false)
    setIsSwitchingWallet(false)
    setIsProcessing(false)
  }

  const handleConnect = async (connectedAddress: string) => {
    if (!connectedAddress) return
    
    try {
      const data = await getNonceMutation.refetch()
      if (data.data) {
        setNonce(data.data.nonce)
        setMessage(data.data.message)
        setStep('sign')
      }
    } catch (error) {
      console.error('Failed to get nonce:', error)
      setError(error instanceof Error ? error.message : 'Failed to get nonce')
      setStep('error')
    }
  }

  const handleProceedWithCurrentWallet = async () => {
    if (address) {
      setIsProcessing(true)
      try {
        await handleConnect(address)
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleSwitchWallet = () => {
    // 标记正在切换钱包状态
    setIsSwitchingWallet(true)
    setIsWaitingForConnection(true)
    // 先隐藏当前弹窗，避免挡住AppKit弹窗
    onOpenChange(false)
    // 断开当前钱包连接
    disconnect()
    // 稍微延迟后打开AppKit钱包选择器
    // setTimeout(() => {
    //   openAppKit()
    // }, 100)
  }

  const handleConnectWallet = () => {
    // 隐藏当前弹窗，避免挡住AppKit弹窗
    setIsWaitingForConnection(true)
    onOpenChange(false)
    // 打开AppKit钱包选择器
    openAppKit()
  }

  const handleSign = async () => {
    if (!address || !message) return

    try {
      setStep('binding')
      
      const signature = await new Promise<string>((resolve, reject) => {
        signMessage(
          { account: address, message },
          {
            onSuccess: (signature) => resolve(signature),
            onError: (error) => reject(error)
          }
        )
      })

      // 绑定钱包
      const result = await bindWalletMutation.mutateAsync({
        address,
        signature,
        nonce
      })

      setStep('success')
      toast.success('Wallet bound successfully!')
      
      setTimeout(() => {
        onSuccess(result.address)
        onOpenChange(false)
        resetDialog()
      }, 2000)

    } catch (error) {
      console.error('Failed to bind wallet:', error)
      setError(error instanceof Error ? error.message : 'Failed to bind wallet')
      setStep('error')
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    resetDialog()
  }

  return (
    <Dialog open={open && !isWaitingForConnection && !isSwitchingWallet} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bind Wallet</DialogTitle>
          <DialogDescription>
            Connect your wallet and sign a message to bind it to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'connect' && (
            <div className="text-center space-y-4">
              {isConnected && address ? (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-2">Wallet Connected</p>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm text-muted-foreground cursor-pointer hover:text-white">
                            {address.slice(0, 6)}...{address.slice(-4)}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-mono">{address}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Continue with this wallet or switch to a different one.
                  </p>
                  <div className="flex space-x-2">
                    <Button 
                      onClick={handleProceedWithCurrentWallet}
                      disabled={isProcessing}
                      className="flex-1"
                    >
                      {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Continue with this wallet
                    </Button>
                    <Button 
                      onClick={handleSwitchWallet}
                      variant="outline"
                      className="flex-1"
                      disabled={isProcessing}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Switch Wallet
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    First, connect your wallet to continue.
                  </p>
                  <Button onClick={handleConnectWallet} className="w-full">
                    Connect Wallet
                  </Button>
                </>
              )}
            </div>
          )}

          {step === 'sign' && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-sm cursor-pointer hover:text-white">
                        <strong>Connected:</strong> {address?.slice(0, 6)}...{address?.slice(-4)}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono">{address}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">
                Sign a message to prove wallet ownership and bind it to your account.
              </p>
              <Button 
                onClick={handleSign} 
                disabled={isSigning}
                className="w-full"
              >
                {isSigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Message
              </Button>
            </div>
          )}

          {step === 'binding' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">
                Binding wallet to your account...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-medium">Wallet bound successfully!</p>
              <p className="text-sm text-muted-foreground">
                Your wallet has been linked to your account.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-sm font-medium text-red-600">Error</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={resetDialog} className="flex-1">
                  Try Again
                </Button>
                <Button variant="secondary" onClick={handleClose} className="flex-1">
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}