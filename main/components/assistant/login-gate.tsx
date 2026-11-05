"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, type UserRole } from "@/components/dialogs/role-select-dialog";

type Step = "confirm" | "role" | "login";

/**
 * 未登录使用小助手：先弹窗说明需要登录并询问是否登录，同意后再走站内“选角色 → 登录”流程。
 * callbackPath 为登录后要回到的站内路径。
 */
export function useLoginGate() {
  const t = useTranslations("Assistant");
  const [callbackPath, setCallbackPath] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("confirm");
  const [role, setRole] = useState<UserRole | null>(null);

  const openLogin = (path: string) => {
    setRole(null);
    setStep("confirm");
    setCallbackPath(path);
  };

  const close = () => {
    setCallbackPath(null);
    setRole(null);
    setStep("confirm");
  };

  const withRole = (path: string, selected: UserRole) =>
    `${path}${path.includes("?") ? "&" : "?"}role=${selected}`;

  const dialogs = (
    <>
      <AlertDialog
        open={callbackPath !== null && step === "confirm"}
        // 点“去登录”后弹窗也会触发关闭，此时 step 已切到 role，不能当作取消
        onOpenChange={(open) => {
          if (open) return;
          setStep((current) => {
            if (current === "confirm") {
              setCallbackPath(null);
              setRole(null);
            }
            return current;
          });
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("loginPromptTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("loginPromptDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={close}>{t("loginPromptCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => setStep("role")}>{t("loginPromptConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <RoleSelectDialog
        isOpen={callbackPath !== null && step === "role"}
        // 选好角色后弹窗也会调用 onClose，此时继续进入登录弹窗
        onClose={() =>
          setRole((selected) => {
            if (!selected) setCallbackPath(null);
            return selected;
          })
        }
        onConfirm={(selected) => {
          setRole(selected);
          setStep("login");
        }}
      />
      {callbackPath !== null && step === "login" && role && (
        <LoginDialog
          isOpen
          onClose={close}
          callbackUrl={withRole(callbackPath, role)}
          role={role}
        />
      )}
    </>
  );

  return { openLogin, dialogs };
}
