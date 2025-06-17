import { MessageCircle } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserRole } from './role-select-dialog';

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  callbackUrl?: string;
  role: UserRole;
}

export function LoginDialog({ isOpen, onClose, callbackUrl = '/', role }: LoginDialogProps) {
  const handleWeChatLogin = async () => {
    try {
      await signIn('wechat', {
        callbackUrl: callbackUrl,
        redirect: true,
        role,
      });
    } catch (error) {
      console.error('WeChat login error:', error);
      toast.error("Sign in failed", {
        description: "Please try again later",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Sign In</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to continue as {role}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <button
            onClick={handleWeChatLogin}
            className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors duration-200"
          >
            <MessageCircle className="w-5 h-5 mr-2" />
            Sign in with WeChat
          </button>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          By signing in, you agree to our <Link href="/terms" className="underline hover:text-primary">Terms of Service</Link> and <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
        </div>
      </DialogContent>
    </Dialog>
  );
} 