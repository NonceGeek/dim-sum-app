"use client";

import { useState, useEffect } from "react";
import { Phone, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSendBindCode, useBindPhone } from "@/lib/api/user";

interface BindPhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  currentPhone?: string | null;
}

export function BindPhoneDialog({
  open,
  onOpenChange,
  onSuccess,
  currentPhone,
}: BindPhoneDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"input" | "verify" | "conflict">("input");
  const [countdown, setCountdown] = useState(0);
  const [conflictPhone, setConflictPhone] = useState("");

  const sendBindCodeMutation = useSendBindCode();
  const bindPhoneMutation = useBindPhone();

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

  // 重置状态
  useEffect(() => {
    if (!open) {
      setPhoneNumber("");
      setVerificationCode("");
      setStep("input");
      setCountdown(0);
      setConflictPhone("");
    }
  }, [open]);

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
      const result = await sendBindCodeMutation.mutateAsync(phoneNumber);

      if (result.success) {
        toast.success("验证码已发送");
        setStep("verify");
        setCountdown(60);
      }
    } catch (error: any) {
      // 处理冲突错误
      if (
        error?.response?.status === 409 ||
        error?.message?.includes("PHONE_ALREADY_BOUND")
      ) {
        setConflictPhone(phoneNumber);
        setStep("conflict");
        return;
      }
      console.error("Send code error:", error);
      toast.error(error?.message || "发送验证码失败");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("请输入6位验证码");
      return;
    }

    try {
      const result = await bindPhoneMutation.mutateAsync({
        phoneNumber: phoneNumber.replace(/[\s\-\(\)]/g, ""),
        code: verificationCode,
      });

      if (result.success) {
        toast.success("手机号绑定成功！");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      // 处理冲突错误
      if (
        error?.response?.status === 409 ||
        error?.message?.includes("PHONE_ALREADY_BOUND")
      ) {
        setConflictPhone(phoneNumber);
        setStep("conflict");
        return;
      }
      console.error("Bind phone error:", error);
      toast.error(error?.message || "绑定失败");
    }
  };

  const handleBack = () => {
    if (step === "verify" || step === "conflict") {
      setStep("input");
      setVerificationCode("");
      setConflictPhone("");
    }
  };

  const maskPhone = (phone: string) => {
    if (phone.length >= 11) {
      return phone.slice(0, 3) + "****" + phone.slice(-4);
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            {step === "input" && (currentPhone ? "换绑手机号" : "绑定手机号")}
            {step === "verify" && "输入验证码"}
            {step === "conflict" && "手机号已被使用"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "input" &&
              (currentPhone
                ? `当前手机号：${maskPhone(currentPhone)}，输入新手机号进行换绑`
                : "绑定手机号后可使用手机号登录")}
            {step === "verify" && `验证码已发送至 ${maskPhone(phoneNumber)}`}
            {step === "conflict" && ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "input" && (
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
                  disabled={sendBindCodeMutation.isPending}
                  maxLength={11}
                />
              </div>
            </>
          )}

          {step === "verify" && (
            <>
              <div className="space-y-2 flex flex-col items-center">
                <label className="text-sm font-medium text-center w-full">
                  验证码
                </label>
                <InputOTP
                  value={verificationCode}
                  onChange={setVerificationCode}
                  maxLength={6}
                  disabled={bindPhoneMutation.isPending}
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

              <div className="text-center">
                <Button
                  variant="link"
                  onClick={handleSendCode}
                  disabled={sendBindCodeMutation.isPending || countdown > 0}
                  className="text-sm"
                >
                  {sendBindCodeMutation.isPending
                    ? "发送中..."
                    : countdown > 0
                    ? `重新发送 (${countdown}s)`
                    : "重新发送验证码"}
                </Button>
              </div>
            </>
          )}

          {step === "conflict" && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                手机号 {maskPhone(conflictPhone)} 已关联其他账号。
                <br />
                如需使用该手机号，请先退出登录，然后使用该手机号登录对应账号。
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {step === "input" && (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                onClick={handleSendCode}
                disabled={sendBindCodeMutation.isPending || !phoneNumber}
                className="flex-1"
              >
                {sendBindCodeMutation.isPending ? (
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
          )}

          {step === "verify" && (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={bindPhoneMutation.isPending}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={
                  bindPhoneMutation.isPending || verificationCode.length !== 6
                }
                className="flex-1"
              >
                {bindPhoneMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    绑定中...
                  </>
                ) : (
                  "确认绑定"
                )}
              </Button>
            </>
          )}

          {step === "conflict" && (
            <>
              <Button variant="outline" onClick={handleBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                使用其他手机号
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                取消
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
