"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useRequestDeletion,
  useCancelDeletion,
  useDeletionStatus,
} from "@/lib/api/user";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);

  const { data: deletionStatus, isLoading: statusLoading } =
    useDeletionStatus();
  const requestDeletionMutation = useRequestDeletion();
  const cancelDeletionMutation = useCancelDeletion();

  const isPendingDelete = deletionStatus?.isPendingDelete;

  const handleRequestDeletion = async () => {
    if (confirmPhrase !== "确认注销") {
      toast.error("请输入正确的确认短语");
      return;
    }
    setShowFinalConfirm(true);
  };

  const handleConfirmDeletion = async () => {
    try {
      const result = await requestDeletionMutation.mutateAsync(confirmPhrase);

      if (result.success) {
        toast.success(result.message);
        setShowFinalConfirm(false);
        onOpenChange(false);
        // 登出用户
        setTimeout(() => {
          signOut({ callbackUrl: "/" });
        }, 1500);
      }
    } catch (error: any) {
      console.error("Request deletion error:", error);
      toast.error(error?.message || "操作失败");
    }
  };

  const handleCancelDeletion = async () => {
    try {
      const result = await cancelDeletionMutation.mutateAsync();

      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Cancel deletion error:", error);
      toast.error(error?.message || "操作失败");
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 如果账号已在注销流程，显示撤销选项
  if (isPendingDelete) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              账号待注销
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>注销已申请</AlertTitle>
              <AlertDescription>
                您的账号将于{" "}
                <strong>{formatDate(deletionStatus?.deletionDate)}</strong>{" "}
                被永久删除。
                <br />
                在此之前，您可以随时撤销注销申请。
              </AlertDescription>
            </Alert>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                • 申请时间：{formatDate(deletionStatus?.deletionRequestedAt)}
              </p>
              <p>• 冷静期：{deletionStatus?.coolingPeriodDays} 天</p>
              <p>• 删除时间：{formatDate(deletionStatus?.deletionDate)}</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              关闭
            </Button>
            <Button
              variant="default"
              onClick={handleCancelDeletion}
              disabled={cancelDeletionMutation.isPending}
              className="flex-1"
            >
              {cancelDeletionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  撤销注销
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center text-destructive flex items-center justify-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              注销账号
            </DialogTitle>
            <DialogDescription className="text-center">
              此操作不可逆，请谨慎操作
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>警告</AlertTitle>
              <AlertDescription>
                注销账号后，您的所有数据将在 7 天后被永久删除，包括：
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>个人资料和设置</li>
                  <li>绑定的手机号和邮箱</li>
                  <li>API 密钥</li>
                  <li>其他关联数据</li>
                </ul>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                请输入「
                <span className="text-destructive font-bold">确认注销</span>
                」以继续
              </label>
              <Input
                placeholder="确认注销"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                disabled={requestDeletionMutation.isPending}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={
                requestDeletionMutation.isPending ||
                confirmPhrase !== "确认注销"
              }
              className="flex-1"
            >
              {requestDeletionMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                "申请注销"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 最终确认对话框 */}
      <AlertDialog open={showFinalConfirm} onOpenChange={setShowFinalConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              确定要注销账号吗？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您的账号将进入 7
              天冷静期。冷静期结束后，账号及所有数据将被永久删除。
              <br />
              <br />
              冷静期内您可以随时登录并撤销注销申请。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeletion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认注销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
