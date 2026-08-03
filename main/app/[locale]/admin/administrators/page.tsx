"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface AdministratorCandidate {
  id: string;
  name: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  status: string;
  isSystemAdmin: boolean;
  isSuperAdmin: boolean;
}

const roleTranslationKeys: Record<string, string> = {
  LEARNER: "roles.learner",
  TAGGER_PARTNER: "roles.taggerPartner",
  TAGGER_OUTSOURCING: "roles.taggerOutsourcing",
  RESEARCHER: "roles.researcher",
};

export default function AdministratorsPage() {
  const t = useTranslations("AdminAdministrators");
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [pendingUser, setPendingUser] =
    useState<AdministratorCandidate | null>(null);

  useEffect(() => {
    if (status !== "loading" && !session?.user?.isSuperAdmin) {
      router.replace("/admin");
    }
  }, [router, session, status]);

  const { data, isLoading, isError } = useQuery<{
    users: AdministratorCandidate[];
  }>({
    queryKey: ["administrator-management", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const response = await fetch(`/api/admin/administrators?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
    enabled: Boolean(session?.user?.isSuperAdmin),
  });

  const updateAdministrator = useMutation({
    mutationFn: async ({
      userId,
      isSystemAdmin,
    }: {
      userId: string;
      isSystemAdmin: boolean;
    }) => {
      const response = await fetch("/api/admin/administrators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isSystemAdmin }),
      });
      if (!response.ok) throw new Error("Failed to update administrator");
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["administrator-management"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(
        variables.isSystemAdmin ? t("grantSuccess") : t("revokeSuccess")
      );
    },
    onError: () => toast.error(t("updateFailed")),
  });

  if (status === "loading" || !session?.user?.isSuperAdmin) return null;

  const confirmAccessChange = () => {
    if (!pendingUser) return;
    updateAdministrator.mutate({
      userId: pendingUser.id,
      isSystemAdmin: !pendingUser.isSystemAdmin,
    });
    setPendingUser(null);
  };

  const pendingIdentifier = pendingUser
    ? pendingUser.name ||
      pendingUser.email ||
      pendingUser.phoneNumber ||
      pendingUser.id
    : "";
  const isGranting = pendingUser ? !pendingUser.isSystemAdmin : false;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="mt-2 text-muted-foreground">{t("description")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("searchTitle")}</CardTitle>
          <CardDescription>{t("searchDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
            </div>
            <Button type="submit">{t("searchButton")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">
              {t("loading")}
            </p>
          ) : isError ? (
            <p className="py-8 text-center text-destructive">
              {t("loadFailed")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.account")}</TableHead>
                  <TableHead>{t("columns.contact")}</TableHead>
                  <TableHead>{t("columns.role")}</TableHead>
                  <TableHead>{t("columns.permission")}</TableHead>
                  <TableHead className="text-right">
                    {t("columns.action")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name || t("unnamedUser")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email || user.phoneNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {roleTranslationKeys[user.role]
                          ? t(roleTranslationKeys[user.role])
                          : user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.isSuperAdmin ? (
                        <Badge className="gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {t("superAdmin")}
                        </Badge>
                      ) : user.isSystemAdmin ? (
                        <Badge variant="secondary" className="gap-1">
                          <Shield className="h-3.5 w-3.5" />
                          {t("administrator")}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t("regularAccount")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={user.isSystemAdmin ? "outline" : "default"}
                        disabled={
                          user.isSuperAdmin || updateAdministrator.isPending
                        }
                        onClick={() => setPendingUser(user)}
                      >
                        {user.isSuperAdmin
                          ? t("cannotModify")
                          : user.isSystemAdmin
                            ? t("revokeAdministrator")
                            : t("grantAdministrator")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.users.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={Boolean(pendingUser)}
        onOpenChange={(open) => !open && setPendingUser(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isGranting ? t("dialog.grantTitle") : t("dialog.revokeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isGranting
                ? t("dialog.grantDescription", { user: pendingIdentifier })
                : t("dialog.revokeDescription", { user: pendingIdentifier })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("dialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                !isGranting &&
                  "bg-destructive text-white hover:bg-destructive/90"
              )}
              onClick={confirmAccessChange}
            >
              {isGranting ? t("dialog.confirmGrant") : t("dialog.confirmRevoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
