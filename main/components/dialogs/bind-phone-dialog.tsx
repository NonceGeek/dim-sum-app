"use client";

import { useState, useEffect } from "react";
import { Phone, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
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
  const [step, setStep] = useState<"input" | "verify" | "merge-confirm">(
    "input"
  );
  const [countdown, setCountdown] = useState(0);

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
    }
  }, [open]);

  // 验证手机号格式（中国大陆）
  const isValidPhoneNumber = (phone: string): boolean => {
    const cleaned = phone.replace(/[\s\-\(\)]/g, "");
    return /^1[3-9]\d{9}$/.test(cleaned);
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      toast.error("Please enter phone number");
      return;
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      toast.error("Please enter a valid phone number format");
      return;
    }

    try {
      const result = await sendBindCodeMutation.mutateAsync(phoneNumber);

      if (result.success) {
        toast.success("Verification code sent");
        setStep("verify");
        setCountdown(60);
      }
    } catch (error: any) {
      console.error("Send code error:", error);
      toast.error(error?.message || "Failed to send verification code");
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error("Please enter 6-digit verification code");
      return;
    }

    try {
      const result = await bindPhoneMutation.mutateAsync({
        phoneNumber: phoneNumber.replace(/[\s\-\(\)]/g, ""),
        code: verificationCode,
      });

      if (result.success) {
        toast.success("Phone number bound successfully!");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      // 手机号已关联另一个账号 —— 需要用户显式确认后才合并
      if (error?.message === "MERGE_REQUIRED") {
        setStep("merge-confirm");
        return;
      }
      console.error("Bind phone error:", error);
      toast.error(error?.message || "Bind failed");
    }
  };

  // 用户确认合并：用同一验证码带 confirmMerge 再次提交
  const handleConfirmMerge = async () => {
    try {
      const result = await bindPhoneMutation.mutateAsync({
        phoneNumber: phoneNumber.replace(/[\s\-\(\)]/g, ""),
        code: verificationCode,
        confirmMerge: true,
      });

      if (result.success) {
        toast.success("Phone bound and the previous account was merged");
        onOpenChange(false);
        onSuccess?.();
      }
    } catch (error: any) {
      console.error("Merge accounts error:", error);
      toast.error(error?.message || "Merge failed");
    }
  };

  const handleBack = () => {
    if (step === "verify" || step === "merge-confirm") {
      setStep("input");
      setVerificationCode("");
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
            {step === "input" &&
              (currentPhone ? "Change Phone Number" : "Bind Phone Number")}
            {step === "verify" && "Enter Verification Code"}
            {step === "merge-confirm" && "Merge Account?"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "input" &&
              (currentPhone
                ? `Current phone: ${maskPhone(currentPhone)}, enter new phone number to change`
                : "Bind phone number to enable phone login")}
            {step === "verify" &&
              `Verification code sent to ${maskPhone(phoneNumber)}`}
            {step === "merge-confirm" && ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "input" && (
            <>
              <div className="space-y-2">
                <label htmlFor="phoneNumber" className="text-sm font-medium">
                  Phone Number
                </label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="Enter phone number"
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
                  Verification Code
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
                    ? "Sending..."
                    : countdown > 0
                    ? `Resend (${countdown}s)`
                    : "Resend Code"}
                </Button>
              </div>
            </>
          )}

          {step === "merge-confirm" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Phone number {maskPhone(phoneNumber)} is already linked to
                another account.
                <br />
                <br />
                Continuing will merge that account&apos;s data into your current
                account. Where both accounts have data (likes, bookmarks,
                permissions, game progress), your current account&apos;s version
                is kept and the rest is combined in — <strong>nothing is
                lost</strong>. The other account will then be deactivated (it is
                archived and can be restored by an admin).
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
                Cancel
              </Button>
              <Button
                onClick={handleSendCode}
                disabled={sendBindCodeMutation.isPending || !phoneNumber}
                className="flex-1"
              >
                {sendBindCodeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 mr-2" />
                    Get Code
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
                Back
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
                    Binding...
                  </>
                ) : (
                  "Confirm Bind"
                )}
              </Button>
            </>
          )}

          {step === "merge-confirm" && (
            <>
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={bindPhoneMutation.isPending}
                className="flex-1"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmMerge}
                disabled={bindPhoneMutation.isPending}
                className="flex-1"
              >
                {bindPhoneMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  "Merge & Bind"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
