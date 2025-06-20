"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { userApi, UserProfile } from "@/lib/api/user";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail } from "lucide-react";
import Image from "next/image";
import { formatRole } from "@/lib/utils";
import { EditProfileDialog } from "@/components/dialogs/edit-profile-dialog";

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await userApi.getProfile();
        setProfile(data);
      } catch (err) {
        setError("Failed to load profile");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

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
              <p className="font-medium">{error}</p>
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
                    {profile && (
                      <EditProfileDialog
                        profile={profile}
                        onProfileUpdate={setProfile}
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
      </div>
    </>
  );
}
