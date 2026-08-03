"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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

export default function AdministratorsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (status !== "loading" && !session?.user?.isSuperAdmin) {
      router.replace("/admin");
    }
  }, [router, session, status]);

  const { data, isLoading, isError } = useQuery<{ users: AdministratorCandidate[] }>({
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
    mutationFn: async ({ userId, isSystemAdmin }: { userId: string; isSystemAdmin: boolean }) => {
      const response = await fetch("/api/admin/administrators", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isSystemAdmin }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "更新失败");
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["administrator-management"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(variables.isSystemAdmin ? "已设为管理员" : "已取消管理员权限");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status === "loading" || !session?.user?.isSuperAdmin) return null;

  const changeAccess = (user: AdministratorCandidate) => {
    const nextValue = !user.isSystemAdmin;
    const action = nextValue ? "设为管理员" : "取消管理员权限";
    const identifier = user.name || user.email || user.phoneNumber || user.id;
    if (window.confirm(`确定要将 ${identifier} ${action}吗？`)) {
      updateAdministrator.mutate({ userId: user.id, isSystemAdmin: nextValue });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">管理员管理</h2>
        <p className="mt-2 text-muted-foreground">授予或撤销后台管理员权限。此页面仅超级管理员可见。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>查找账号</CardTitle>
          <CardDescription>可按姓名、邮箱或手机号搜索，最多显示 100 个账号。</CardDescription>
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
                placeholder="姓名、邮箱或手机号"
              />
            </div>
            <Button type="submit">搜索</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号列表</CardTitle>
          <CardDescription>超级管理员权限不能在此页面撤销。</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-8 text-center text-muted-foreground">加载中…</p>
          ) : isError ? (
            <p className="py-8 text-center text-destructive">无法加载账号，请稍后重试。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>账号</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || "未命名用户"}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email || user.phoneNumber || "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{user.role}</Badge></TableCell>
                    <TableCell>
                      {user.isSuperAdmin ? (
                        <Badge className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />超级管理员</Badge>
                      ) : user.isSystemAdmin ? (
                        <Badge variant="secondary" className="gap-1"><Shield className="h-3.5 w-3.5" />管理员</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">普通账号</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={user.isSystemAdmin ? "outline" : "default"}
                        disabled={user.isSuperAdmin || updateAdministrator.isPending}
                        onClick={() => changeAccess(user)}
                      >
                        {user.isSuperAdmin
                          ? "不可修改"
                          : user.isSystemAdmin
                            ? "取消管理员"
                            : "设为管理员"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.users.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">没有找到匹配账号。</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
