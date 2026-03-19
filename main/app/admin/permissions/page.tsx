"use client";

import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Search,
  Plus,
  Trash2,
  User as UserIcon,
  X,
  Loader2,
  Check,
  ChevronsUpDown,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Permission {
  id: number;
  user_id: string;
  category_name: string;
  permission: string;
  created_at: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
    phoneNumber?: string | null;
  };
  category: {
    name: string;
    nickname: string | null;
    is_public: boolean;
  };
}

interface PermissionsResponse {
  permissions: Permission[];
}

interface Category {
  name: string;
  nickname: string | null;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  phoneNumber?: string | null;
}

interface UsersResponse {
  users: User[];
}

export default function AdminPermissionsPage() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    user_id: string;
    category_name: string;
    userName: string;
    categoryName: string;
  } | null>(null);
  const [newPermission, setNewPermission] = useState<{
    user_ids: string[];
    category_names: string[];
    permission: string;
  }>({
    user_ids: [],
    category_names: [],
    permission: "READ",
  });
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  const queryClient = useQueryClient();

  // Debounce user search query (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedUserSearch(userSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // ... existing queries ...

  // 获取权限列表
  const { data, isLoading } = useQuery<PermissionsResponse>({
    queryKey: ["admin-permissions", selectedUserId, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedUserId) params.append("user_id", selectedUserId);
      if (categoryFilter) params.append("category_name", categoryFilter);
      const response = await fetch(`/api/admin/corpus/permissions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    },
  });

  // 获取分类列表用于下拉选择
  const { data: categoriesData } = useQuery<{ categories: Category[] }>({
    queryKey: ["admin-categories-list"],
    queryFn: async () => {
      const response = await fetch("/api/admin/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // 获取用户列表 - 使用服务端搜索
  const { data: usersData, isLoading: isLoadingUsers } = useQuery<UsersResponse>({
    queryKey: ["admin-users-search", debouncedUserSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedUserSearch) {
        params.append("search", debouncedUserSearch);
        params.append("limit", "100"); // 搜索结果限制100个
      } else {
        params.append("limit", "100"); // 默认显示100个
      }
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // 过滤用户列表（仅排除 LEARNER，服务端已处理搜索）
  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    // 仅排除 LEARNER 用户，搜索已由服务端完成
    return usersData.users.filter((u) => u.role !== "LEARNER");
  }, [usersData?.users]);

  // ... existing helper functions ...

  // 根据角色获取固定权限级别
  const getRolePermissionLevel = (role: string) => {
    switch (role) {
      case "RESEARCHER":
        return "CREATE";
      case "TAGGER_PARTNER":
      case "TAGGER_OUTSOURCING":
        return "WRITE";
      default:
        return "READ";
    }
  };

  // 添加权限
  const addPermissionMutation = useMutation({
    mutationFn: async (data: {
      user_ids: string[];
      category_names: string[];
      permission: string;
    }) => {
      const response = await fetch("/api/admin/corpus/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to add permission");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      setIsAddDialogOpen(false);
      setNewPermission({ user_ids: [], category_names: [], permission: "READ" });
      setUserSearchQuery("");
      toast.success(`Successfully added ${data.count || 1} permissions`);
    },
    onError: () => {
      toast.error("Failed to add permission");
    },
  });

  // ... existing delete and update mutations ...

  // 删除权限
  const deletePermissionMutation = useMutation({
    mutationFn: async ({
      user_id,
      category_name,
    }: {
      user_id: string;
      category_name: string;
    }) => {
      const params = new URLSearchParams({ user_id, category_name });
      const response = await fetch(`/api/admin/corpus/permissions?${params}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete permission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      setDeleteTarget(null);
      toast.success("Permission revoked");
    },
    onError: () => {
      toast.error("Failed to revoke permission");
    },
  });

  // 更新权限
  const updatePermissionMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      category_name: string;
      permission: string;
    }) => {
      const response = await fetch("/api/admin/corpus/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update permission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      toast.success("Permission updated");
    },
    onError: () => {
      toast.error("Failed to update permission");
    },
  });

  const getPermissionBadgeColor = (permission: string) => {
    switch (permission) {
      case "FULL":
        return "bg-error text-error-foreground";
      case "CREATE":
        return "bg-primary text-primary-foreground";
      case "WRITE":
        return "bg-info text-info-foreground";
      case "READ":
        return "bg-success text-success-foreground";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  // 获取选中用户的显示名称
  const getSelectedUserName = (userId: string) => {
    const user = usersData?.users.find((u) => u.id === userId);
    if (!user) return userId;
    return user.name || user.email || userId;
  };

  return (
    <div className="space-y-8">
      {/* ... existing header ... */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          Permissions
        </h2>
        <p className="text-muted-foreground mt-2">
          Manage user access to corpus categories.
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Filter Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {/* 用户筛选下拉框 */}
            <Select
              value={selectedUserId || undefined}
              onValueChange={(value) =>
                setSelectedUserId(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-64 bg-secondary border-border text-foreground">
                <SelectValue placeholder="Select user to view permissions" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5">
                  <Input
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="h-8 bg-muted border-border text-foreground"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="all">All Users</SelectItem>
                {isLoadingUsers ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <span>{user.name || user.email || user.id}</span>
                        <span className="text-xs text-muted-foreground">{user.role}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {/* 分类筛选 */}
            <Select
              value={categoryFilter || undefined}
              onValueChange={(value) =>
                setCategoryFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-48 bg-secondary border-border text-foreground">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesData?.categories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {cat.nickname || cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 清除筛选按钮 */}
            {(selectedUserId || categoryFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedUserId("");
                  setCategoryFilter("");
                }}
                className="bg-secondary border-border text-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}

            {/* 添加权限按钮 */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 ml-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Permission
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border overflow-visible">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    Add New Permission
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Grant a user access to corpus categories.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* 用户多选 */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Users</label>
                    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={userPopoverOpen}
                          className="w-full justify-between bg-secondary border-border text-foreground hover:bg-accent hover:text-foreground"
                        >
                          {newPermission.user_ids.length > 0
                            ? `${newPermission.user_ids.length} selected`
                            : "Select users..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 bg-card border-border max-h-[400px]">
                        <Command className="bg-card border-border" shouldFilter={false}>
                          <CommandInput
                            placeholder="Search user..."
                            className="text-foreground"
                            value={userSearchQuery}
                            onValueChange={setUserSearchQuery}
                          />
                          <CommandList onWheel={(e) => e.stopPropagation()}>
                            {isLoadingUsers ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="ml-2 text-sm text-muted-foreground">Searching users...</span>
                              </div>
                            ) : (
                              <>
                                <CommandEmpty className="py-2 text-sm text-muted-foreground text-center">No user found.</CommandEmpty>
                                <CommandGroup>
                                  {filteredUsers.map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      value={`${user.name} ${user.email} ${user.phoneNumber || ''} ${user.id}`}
                                      onSelect={() => {
                                        setNewPermission((prev) => {
                                          const isSelected = prev.user_ids.includes(user.id);
                                          if (isSelected) {
                                            return {
                                              ...prev,
                                              user_ids: prev.user_ids.filter((id) => id !== user.id),
                                            };
                                          } else {
                                            return {
                                              ...prev,
                                              user_ids: [...prev.user_ids, user.id],
                                            };
                                          }
                                        });
                                      }}
                                      className="text-foreground hover:bg-accent cursor-pointer"
                                    >
                                      <div className="flex items-center gap-2 w-full">
                                        <div
                                          className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            newPermission.user_ids.includes(user.id)
                                              ? "bg-primary text-primary-foreground"
                                              : "opacity-50 [&_svg]:invisible"
                                          )}
                                        >
                                          <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-sm">{user.name || "N/A"}</div>
                                          <div className="text-xs text-muted-foreground">
                                            {user.email} {user.phoneNumber && `· ${user.phoneNumber}`} · {user.role}
                                          </div>
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Users Badges */}
                    {newPermission.user_ids.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                        {newPermission.user_ids.map((userId) => {
                          const user = usersData?.users.find(u => u.id === userId);
                          return (
                            <Badge key={userId} variant="secondary" className="bg-secondary text-secondary-foreground hover:bg-accent">
                              {user?.name || user?.email || userId}
                              <button
                                className="ml-1 hover:text-foreground"
                                onClick={() => {
                                  setNewPermission(prev => ({
                                    ...prev,
                                    user_ids: prev.user_ids.filter(id => id !== userId)
                                  }));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 分类多选 */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Categories</label>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={categoryPopoverOpen}
                          className="w-full justify-between bg-secondary border-border text-foreground hover:bg-accent hover:text-foreground"
                        >
                          {newPermission.category_names.length > 0
                            ? `${newPermission.category_names.length} selected`
                            : "Select categories..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0 bg-card border-border max-h-[400px]">
                        <Command className="bg-card border-border" shouldFilter={false}>
                          <CommandInput placeholder="Search category..." className="text-foreground" />
                          <CommandList onWheel={(e) => e.stopPropagation()}>
                            <CommandEmpty className="py-2 text-sm text-muted-foreground text-center">No category found.</CommandEmpty>
                            <CommandGroup>
                              {categoriesData?.categories.map((cat) => (
                                <CommandItem
                                  key={cat.name}
                                  value={cat.name}
                                  onSelect={(currentValue) => {
                                    setNewPermission((prev) => {
                                      const isSelected = prev.category_names.includes(cat.name);
                                      if (isSelected) {
                                        return {
                                          ...prev,
                                          category_names: prev.category_names.filter((n) => n !== cat.name),
                                        };
                                      } else {
                                        return {
                                          ...prev,
                                          category_names: [...prev.category_names, cat.name],
                                        };
                                      }
                                    });
                                  }}
                                  className="text-foreground hover:bg-accent cursor-pointer"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <div
                                      className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        newPermission.category_names.includes(cat.name)
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50 [&_svg]:invisible"
                                      )}
                                    >
                                      <Check className={cn("h-4 w-4")} />
                                    </div>
                                    <span>{cat.nickname || cat.name}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>

                    {/* Selected Categories Badges */}
                    {newPermission.category_names.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {newPermission.category_names.map((catName) => {
                          const cat = categoriesData?.categories.find(c => c.name === catName);
                          return (
                            <Badge key={catName} variant="secondary" className="bg-secondary text-secondary-foreground hover:bg-accent">
                              {cat?.nickname || catName}
                              <button
                                className="ml-1 hover:text-foreground"
                                onClick={() => {
                                  setNewPermission(prev => ({
                                    ...prev,
                                    category_names: prev.category_names.filter(n => n !== catName)
                                  }));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 权限级别（根据角色自动确定） */}
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Permission Level
                    </label>
                    {newPermission.user_ids.length > 0 ? (
                      <div className="p-3 bg-secondary rounded border border-border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            Auto-set based on each user's role
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                          {newPermission.user_ids.map((userId) => {
                            const user = usersData?.users.find((u) => u.id === userId);
                            if (!user) return null;
                            const permLevel = getRolePermissionLevel(user.role);
                            return (
                              <div key={userId} className="flex justify-between items-center">
                                <span className="text-foreground">{user.name || user.email}</span>
                                <Badge className="bg-info text-xs">{permLevel}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-secondary rounded border border-border text-muted-foreground text-sm">
                        Select users to see their permission levels
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setUserSearchQuery("");
                      setNewPermission({ user_ids: [], category_names: [], permission: "READ" });
                    }}
                    className="bg-secondary border-border text-foreground"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addPermissionMutation.mutate(newPermission)}
                    disabled={
                      newPermission.user_ids.length === 0 ||
                      newPermission.category_names.length === 0 ||
                      addPermissionMutation.isPending
                    }
                    className="bg-primary hover:bg-primary/90"
                  >
                    {addPermissionMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Permissions"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 选中用户信息提示 */}
      {selectedUserId && (
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-primary" />
              <span className="text-foreground">
                Viewing permissions for:{" "}
                <strong>{getSelectedUserName(selectedUserId)}</strong>
              </span>
              <Badge className="bg-primary">
                {data?.permissions.length || 0} permissions
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">
            Permissions List ({data?.permissions.length || 0})
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            User-corpus permission bindings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading permissions...</div>
            </div>
          ) : data?.permissions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No permissions found. Click "Add Permission" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">Role</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Permission</TableHead>
                  <TableHead className="text-muted-foreground">Created</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.permissions.map((perm) => (
                  <TableRow
                    key={`${perm.user_id}-${perm.category_name}`}
                    className="border-border"
                  >
                    <TableCell className="text-foreground">
                      <button
                        onClick={() => setSelectedUserId(perm.user_id)}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="text-left">
                          <div>{perm.user.name || "N/A"}</div>
                          <div className="text-xs text-muted-foreground">
                            {perm.user.email}
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-info">{perm.user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {perm.category.nickname || perm.category_name}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={perm.permission}
                        onValueChange={(value) =>
                          updatePermissionMutation.mutate({
                            user_id: perm.user_id,
                            category_name: perm.category_name,
                            permission: value,
                          })
                        }
                      >
                        <SelectTrigger
                          className={`w-28 h-8 ${getPermissionBadgeColor(perm.permission)} border-0 text-xs`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="READ">READ</SelectItem>
                          <SelectItem value="WRITE">WRITE</SelectItem>
                          <SelectItem value="CREATE">CREATE</SelectItem>
                          <SelectItem value="FULL">FULL</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(perm.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteTarget({
                            user_id: perm.user_id,
                            category_name: perm.category_name,
                            userName:
                              perm.user.name || perm.user.email || perm.user_id,
                            categoryName:
                              perm.category.nickname || perm.category_name,
                          })
                        }
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 删除确认弹窗 */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Confirm Delete
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to revoke permission for{" "}
              <strong className="text-foreground">{deleteTarget?.userName}</strong>{" "}
              on{" "}
              <strong className="text-foreground">
                {deleteTarget?.categoryName}
              </strong>
              ?
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deletePermissionMutation.isPending}
              className="bg-secondary border-border text-foreground hover:bg-accent"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePermissionMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deletePermissionMutation.mutate({
                    user_id: deleteTarget.user_id,
                    category_name: deleteTarget.category_name,
                  });
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deletePermissionMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
