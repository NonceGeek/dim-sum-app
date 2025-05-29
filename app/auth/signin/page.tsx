"use client";

import { useSearchParams } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Suspense } from 'react';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleWeChatLogin = () => {
    const state = Math.random().toString(36).substring(7);
    const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/wechat?callbackUrl=${encodeURIComponent(callbackUrl)}`);

    const authUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${process.env.NEXT_PUBLIC_WECHAT_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
    
    window.location.href = authUrl;
  };

  return (
    <>
      <Header />
      <div className="h-[calc(100vh-56px)] flex items-center justify-center bg-background">
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg shadow-sm p-8 border">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-foreground mb-2">Sign In</h1>
              <p className="text-muted-foreground">
                Sign in to continue to your account
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={handleWeChatLogin}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Sign in with WeChat
              </button>
            </div>

            <div className="mt-8 text-center text-xs text-muted-foreground">
              By signing in, you agree to our <a href="#" className="underline hover:text-primary">Terms of Service</a> and <a href="#" className="underline hover:text-primary">Privacy Policy</a>.
            </div>
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