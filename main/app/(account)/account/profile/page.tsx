"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { useUserProfile, UserProfile } from "@/lib/api/user";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Wallet, Unlink, Copy, Link } from "lucide-react";
import Image from "next/image";
import { formatRole } from "@/lib/utils";
import { EditProfileDialog } from "@/components/dialogs/edit-profile-dialog";
import { BindWalletDialog } from "@/components/wallet/bind-wallet-dialog";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUnbindWallet } from "@/lib/api/wallet";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfilePage() {
  const [bindWalletOpen, setBindWalletOpen] = useState(false);
  
  // React Query hooks
  const { data: profile, isLoading: loading, error } = useUserProfile();
  const unbindWalletMutation = useUnbindWallet();
  const queryClient = useQueryClient();

  const copyWalletAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Wallet address copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy wallet address");
    }
  };

  const handleWalletBound = () => {
    // React Query will automatically refetch profile data due to cache invalidation
    // No manual refetch needed
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    // Update the profile data in React Query cache
    queryClient.setQueryData(["user", "profile"], updatedProfile);
  };

  const handleUnbindWallet = async () => {
    if (!profile?.ethAddress) return;

    try {
      await unbindWalletMutation.mutateAsync();
      toast.success("Wallet unbound successfully!");
    } catch (error) {
      console.error("Failed to unbind wallet:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to unbind wallet"
      );
    }
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Profile</h1>
        </div>

        {loading && (
          <div className="space-y-6">
            <Card className="p-6 bg-card">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-20 w-20 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </Card>
          </div>
        )}

        {error && (
          <Card className="p-6 bg-destructive/10 border-destructive/20">
            <div className="text-destructive text-center">
              <p className="font-medium">Failed to load profile</p>
              <p className="text-sm mt-1">Please try again later</p>
            </div>
          </Card>
        )}

        {profile && !loading && (
          <div className="grid gap-6">
            <Card className="p-6 bg-card transition-all duration-200 hover:shadow-lg">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  {profile.image || profile.wechatAvatar ? (
                    <Image
                      src={profile.image || profile.wechatAvatar || ""}
                      alt={profile.name}
                      width={96}
                      height={96}
                      className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                      <span className="text-3xl font-bold">
                        {profile.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold">{profile.name}</h2>
                    <Badge variant="secondary" className="text-sm">
                      {formatRole(profile.role)}
                    </Badge>
                    {profile.isSystemAdmin && (
                      <Badge variant="destructive" className="text-sm">
                        System Admin
                      </Badge>
                    )}
                    {profile && (
                      <EditProfileDialog
                        profile={profile}
                        onProfileUpdate={handleProfileUpdate}
                      />
                    )}
                  </div>

                  <div className="mt-2 space-y-2">
                    <div className="flex items-center text-muted-foreground">
                      <Mail className="w-4 h-4 mr-2" />
                      <span>{profile.email || "Not set"}</span>
                    </div>
                    <div className="flex items-center text-muted-foreground">
                      <Phone className="w-4 h-4 mr-2" />
                      <span>{profile.phoneNumber || "Not set"}</span>
                    </div>
                    <div className="flex items-center justify-start text-muted-foreground">
                      <div className="flex items-center">
                        <Wallet className="w-4 h-4 mr-2" />
                        {profile.ethAddress ? (
                          <TooltipProvider>
                            <div className="flex items-center space-x-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-pointer hover:text-white">
                                    {`${profile.ethAddress.slice(
                                      0,
                                      6
                                    )}...${profile.ethAddress.slice(-4)}`}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-mono">
                                    {profile.ethAddress}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  copyWalletAddress(profile.ethAddress!)
                                }
                                className="h-4 w-4 p-0 hover:bg-muted"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TooltipProvider>
                        ) : (
                          <span>No wallet bound</span>
                        )}
                      </div>
                      {profile.ethAddress ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleUnbindWallet}
                          disabled={unbindWalletMutation.isPending}
                          className="h-6 px-2 text-xs text-destructive hover:text-destructive ml-2"
                        >
                          <Unlink className="w-3 h-3 mr-1" />
                          {unbindWalletMutation.isPending ? "Unbinding..." : "Unbind"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setBindWalletOpen(true)}
                          className="h-6 px-2 text-xs ml-2"
                        >
                          {" "}
                          <Link className="w-3 h-3 mr-1" />
                          Bind Wallet
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {profile.bio && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    About
                  </h3>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {profile.bio}
                  </p>
                </div>
              )}
              {!profile.bio && (
                <div className="mt-6 pt-6 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    About
                  </h3>
                  <p className="text-sm text-muted-foreground italic">
                    No bio added yet
                  </p>
                </div>
              )}
            </Card>
          </div>
        )}

        <BindWalletDialog
          open={bindWalletOpen}
          onOpenChange={setBindWalletOpen}
          onSuccess={handleWalletBound}
        />
      </div>
    </>
  );
}
