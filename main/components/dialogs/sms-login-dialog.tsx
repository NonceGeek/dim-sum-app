import { useState, useEffect } from "react";
import { Phone, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useSendSmsVerificationCode, UserRole } from "@/lib/api/auth";

interface SmsLoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
  role: UserRole;
}

export function SmsLoginDialog({
  isOpen,
  onClose,
  callbackUrl = "/",
  role,
}: SmsLoginDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const sendSmsMutation = useSendSmsVerificationCode();

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

  // 验证手机号格式（中国大陆）
  const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    return /^1[3-9]\d{9}$/.test(cleaned);
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast.error("请输入手机号");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error("请输入正确的手机号格式");
      return;
    }

    try {
      const result = await sendSmsMutation.mutateAsync({ phoneNumber, role });

      if (result.success) {
        toast.success("验证码已发送到您的手机");
        setIsCodeSent(true);
        setCountdown(60); // 开始60秒倒计时
      } else {
        toast.error(result.message || "发送验证码失败");
      }
    } catch (error) {
      console.error("Send code error:", error);
      toast.error("发送验证码失败");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("请输入6位验证码");
      return;
    }

    setIsVerifying(true);
    try {
      // 使用NextAuth的signIn方法
      const result = await signIn("sms", {
        phoneNumber: phoneNumber.replace(/[\s\-\(\)]/g, ""),
        code: verificationCode,
        role: role,
        callbackUrl: callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        toast.error("登录失败：" + result.error);
      } else if (result?.ok) {
        toast.success("登录成功！");
        // 登录成功，关闭对话框并重定向
        handleClose();
        window.location.href = callbackUrl;
      } else {
        toast.error("登录失败");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("登录失败");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBack = () => {
    setIsCodeSent(false);
    setVerificationCode("");
    setCountdown(0);
  };

  const handleClose = () => {
    setPhoneNumber("");
    setVerificationCode("");
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
            {isCodeSent ? "输入验证码" : "手机号登录"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isCodeSent
              ? `验证码已发送至 ${phoneNumber.slice(
                  0,
                  3
                )}****${phoneNumber.slice(-4)}`
              : "输入手机号快速登录或注册"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isCodeSent ? (
            <>
              <div className="space-y-2">
                <label htmlFor="phoneNumber" className="text-sm font-medium">
                  手机号
                </label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="请输入手机号"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={sendSmsMutation.isPending}
                  maxLength={11}
                />
              </div>

              <Button
                onClick={handleSendCode}
                disabled={sendSmsMutation.isPending || !phoneNumber}
                className="w-full"
              >
                {sendSmsMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    发送中...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    获取验证码
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2 flex flex-col">
                <label className="text-sm font-medium text-center w-full">
                  验证码
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
                  返回
                </Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="flex-1"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      验证中...
                    </>
                  ) : (
                    "立即登录"
                  )}
                </Button>
              </div>

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={handleSendCode}
                  disabled={sendSmsMutation.isPending || countdown > 0}
                  className="text-sm"
                >
                  {sendSmsMutation.isPending
                    ? "发送中..."
                    : countdown > 0
                    ? `重新发送 (${countdown}s)`
                    : "重新发送验证码"}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          登录即表示您同意我们的{" "}
          <Link href="/terms" className="underline hover:text-primary">
            服务条款
          </Link>{" "}
          和{" "}
          <Link href="/privacy" className="underline hover:text-primary">
            隐私政策
          </Link>
          。
        </div>
      </DialogContent>
    </Dialog>
  );
}
