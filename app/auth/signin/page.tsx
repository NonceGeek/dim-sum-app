"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { useAuthStore } from "@/lib/store/useAuthStore";
import { useRouter } from "next/navigation";
import { useQrCode, useQrCodeStatus } from "@/lib/api/auth";

export default function SignIn() {
  const [isMobile, setIsMobile] = useState(false);
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  // React Query hooks
  const { data: qrCode, refetch: fetchQrCode, isError: qrCodeError } = useQrCode();
  const { data: qrStatus } = useQrCodeStatus(qrCode?.ticket ?? null);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Check if mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /iphone|ipad|ipod|android|windows phone|mobile/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch QR code when not on mobile
  useEffect(() => {
    if (!isMobile) {
      fetchQrCode();
    }
  }, [isMobile, fetchQrCode]);

  // Handle QR code scan
  useEffect(() => {
    if (qrStatus?.status === "scanned") {
      signIn("wechat", { callbackUrl: "/" });
    }
  }, [qrStatus]);

  const handleWechatLogin = () => {
    if (isMobile) {
      signIn("wechat", { callbackUrl: "/" });
    }
  };

  const getQrCodeStatus = () => {
    if (qrCodeError) return "expired";
    if (!qrCode) return "loading";
    if (qrStatus?.status === "scanned") return "scanned";
    return "ready";
  };

  const qrCodeStatus = getQrCodeStatus();

  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>
            Choose your sign in method
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <Button
              className="w-full"
              onClick={handleWechatLogin}
            >
              Sign in with WeChat
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {qrCodeStatus === "loading" && (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                  <p>Loading...</p>
                </div>
              )}
              {qrCodeStatus === "ready" && qrCode && (
                <div className="w-48 h-48 relative">
                  <Image
                    src={qrCode.qrcode_url}
                    alt="WeChat Sign In QR Code"
                    fill
                    className="object-contain"
                  />
                </div>
              )}
              {qrCodeStatus === "expired" && (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                  <p>QR Code Expired</p>
                </div>
              )}
              {qrCodeStatus === "scanned" && (
                <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                  <p>Scanned, signing in...</p>
                </div>
              )}
              <p className="text-sm text-gray-500">
                {qrCodeStatus === "ready" && "Scan with WeChat to sign in"}
                {qrCodeStatus === "expired" && "QR code expired, please refresh the page"}
                {qrCodeStatus === "scanned" && "Scanned, signing in..."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 