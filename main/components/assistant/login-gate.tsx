"use client";

import { useState } from "react";
import { LoginDialog } from "@/components/dialogs/login-dialog";
import { RoleSelectDialog, type UserRole } from "@/components/dialogs/role-select-dialog";

/**
 * 站内登录需要先选角色再登录。返回打开登录流程的方法和要渲染的弹窗；
 * callbackPath 为登录后要回到的站内路径。
 */
export function useLoginGate() {
  const [callbackPath, setCallbackPath] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);

  const openLogin = (path: string) => {
    setRole(null);
    setCallbackPath(path);
  };

  const close = () => {
    setCallbackPath(null);
    setRole(null);
  };

  const withRole = (path: string, selected: UserRole) =>
    `${path}${path.includes("?") ? "&" : "?"}role=${selected}`;

  const dialogs = (
    <>
      <RoleSelectDialog
        isOpen={callbackPath !== null && role === null}
        // 选好角色后弹窗也会调用 onClose，此时保留流程继续打开登录弹窗
        onClose={() =>
          setRole((selected) => {
            if (!selected) setCallbackPath(null);
            return selected;
          })
        }
        onConfirm={(selected) => setRole(selected)}
      />
      {callbackPath !== null && role && (
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
