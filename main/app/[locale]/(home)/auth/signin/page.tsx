"use client";

import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Suspense } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const t = useTranslations("Auth");

  const handleWeChatLogin = async () => {
    try {
      await signIn("wechat", {
        callbackUrl,
        redirect: true,
      });
    } catch (error) {
      console.error("WeChat login error:", error);
      toast.error(t("signInFailed"), {
        description: t("signInFailedDesc"),
      });
    }
  };

  return (
    <>
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-sm p-8 border">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">{t("signInTitle")}</h1>
            <p className="text-muted-foreground">
              {t("signInSubtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleWeChatLogin}
              className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              {t("signInWith", { provider: "WeChat" })}
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground">
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
        </div>
      </div>
    </>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}
