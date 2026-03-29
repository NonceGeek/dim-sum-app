import { useState } from "react";
import { MessageCircle, Mail, Phone } from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserRole } from "./role-select-dialog";
import { EmailLoginDialog } from "./email-login-dialog";
import { SmsLoginDialog } from "./sms-login-dialog";

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
  role: UserRole;
}

export function LoginDialog({
  isOpen,
  onClose,
  callbackUrl = "/",
  role,
}: LoginDialogProps) {
  const t = useTranslations("Auth");
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [showSmsLogin, setShowSmsLogin] = useState(false);

  const handleWeChatLogin = async () => {
    try {
      await signIn("wechat", {
        callbackUrl: callbackUrl,
        redirect: true,
        role,
      });
    } catch (error) {
      console.error("WeChat login error:", error);
      toast.error(t("signInFailed"), {
        description: t("signInFailedDesc"),
      });
    }
  };

  const handleEmailLogin = () => {
    setShowEmailLogin(true);
  };

  const handleEmailLoginClose = () => {
    setShowEmailLogin(false);
  };

  const handleSmsLogin = () => {
    setShowSmsLogin(true);
  };

  const handleSmsLoginClose = () => {
    setShowSmsLogin(false);
  };

  if (showEmailLogin) {
    return (
      <EmailLoginDialog
        isOpen={showEmailLogin}
        onClose={handleEmailLoginClose}
        callbackUrl={callbackUrl}
        role={role}
      />
    );
  }

  /* SMS 登录  */
  if (showSmsLogin) {
    return (
      <SmsLoginDialog
        isOpen={showSmsLogin}
        onClose={handleSmsLoginClose}
        callbackUrl={callbackUrl}
        role={role}
      />
    );
  }


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            {t("signInTitle")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("signInContinueAs", { role })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            onClick={handleWeChatLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            {t("signInWith", { provider: "WeChat" })}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t("orContinueWith")}
              </span>
            </div>
          </div>

          {/* SMS 登录按钮 */}
          <Button
            onClick={handleSmsLogin}
            variant="outline"
            className="w-full flex items-center justify-center px-4 py-3 border border-input text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            <Phone className="w-5 h-5 mr-2" />
            {t("signInWith", { provider: "Phone" })}
          </Button>

          <Button
            onClick={handleEmailLogin}
            variant="outline"
            className="w-full flex items-center justify-center px-4 py-3 border border-input text-sm font-medium rounded-lg hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            <Mail className="w-5 h-5 mr-2" />
            {t("signInWith", { provider: "Email" })}
          </Button>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          {t("agreementPrefix")}{" "}
          <Link href="/terms" className="underline hover:text-primary">
            {t("termsOfService")}
          </Link>{" "}
          {t("agreementAnd")}{" "}
          <Link href="/privacy" className="underline hover:text-primary">
            {t("privacyPolicy")}
          </Link>
          .
        </div>
      </DialogContent>
    </Dialog>
  );
}
