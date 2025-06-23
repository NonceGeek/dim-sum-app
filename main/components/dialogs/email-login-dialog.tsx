import { useState, useEffect } from 'react';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useSendVerificationCode, UserRole } from '@/lib/api/auth';

interface EmailLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
  role: UserRole;
}

export function EmailLoginDialog({ isOpen, onClose, callbackUrl = '/', role }: EmailLoginDialogProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const sendVerificationMutation = useSendVerificationCode();

  // 倒计时效果
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    try {
      const result = await sendVerificationMutation.mutateAsync({ email, role });
      
      if (result.success) {
        // 开发环境下显示特殊提示
        if (process.env.NODE_ENV === 'development') {
          toast.success('Verification code sent to your registered email (development mode)');
        } else {
          toast.success('Verification code sent to your email');
        }
        setIsCodeSent(true);
        setCountdown(60); // 开始60秒倒计时
      } else {
        toast.error(result.message || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Send code error:', error);
      toast.error('Failed to send verification code');
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }

    setIsVerifying(true);
    try {
      // 使用NextAuth的signIn方法
      const result = await signIn('email', {
        email: email,
        code: verificationCode,
        role: role,
        callbackUrl: callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Login failed: ' + result.error);
      } else if (result?.ok) {
        toast.success('Logged in successfully!');
        // 登录成功，关闭对话框并重定向
        handleClose();
        window.location.href = callbackUrl;
      } else {
        toast.error('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Failed to login');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    setIsCodeSent(false);
    setVerificationCode('');
    setCountdown(0);
  };

  const handleClose = () => {
    setEmail('');
    setVerificationCode('');
    setIsCodeSent(false);
    setIsVerifying(false);
    setCountdown(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {isCodeSent ? 'Enter Verification Code' : 'Sign In with Email'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isCodeSent 
              ? `We've sent a verification code to ${email}`
              : `Sign in to continue as ${role}`
            }
          </DialogDescription>
          {process.env.NODE_ENV === 'development' && !isCodeSent && (
            <div className="mt-2 text-xs text-amber-600 text-center">
              Development mode: Code will be sent to registered email
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {!isCodeSent ? (
            <>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={sendVerificationMutation.isPending}
                />
              </div>
              
              <Button
                onClick={handleSendCode}
                disabled={sendVerificationMutation.isPending || !email}
                className="w-full"
              >
                {sendVerificationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2 flex flex-col">
                <label className="text-sm font-medium text-center w-full">
                  Verification Code
                </label>
                <InputOTP
                  value={verificationCode}
                  onChange={setVerificationCode}
                  maxLength={6}
                  disabled={isVerifying}
                >
                  <InputOTPGroup className="justify-center">
                    <InputOTPSlot className="border-primary/50" index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={isVerifying}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={handleSendCode}
                  disabled={sendVerificationMutation.isPending || countdown > 0}
                  className="text-sm"
                >
                  {sendVerificationMutation.isPending 
                    ? 'Sending...' 
                    : countdown > 0 
                      ? `Resend Code (${countdown}s)` 
                      : 'Resend Code'
                  }
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="underline hover:text-primary">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline hover:text-primary">
            Privacy Policy
          </Link>
          .
        </div>
      </DialogContent>
    </Dialog>
  );
} 