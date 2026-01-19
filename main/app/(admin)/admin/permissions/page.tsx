"use client";

import { useState, useMemo } from "react";
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
import { Search, Plus, Trash2, User as UserIcon, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

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
}

interface UsersResponse {
  users: User[];
}

export default function AdminPermissionsPage() {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [newPermission, setNewPermission] = useState({
    user_id: "",
    category_name: "",
    permission: "READ",
  });
  const queryClient = useQueryClient();

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

  // 获取用户列表
  const { data: usersData } = useQuery<UsersResponse>({
    queryKey: ["admin-users-all"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users?limit=1000");
      if (!response.ok) throw new Error("Failed to fetch users");
      return response.json();
    },
  });

  // 过滤用户列表用于搜索
  const filteredUsers = useMemo(() => {
    if (!usersData?.users) return [];
    if (!userSearchQuery) return usersData.users.slice(0, 20);
    const query = userSearchQuery.toLowerCase();
    return usersData.users
      .filter(
        (user) =>
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.id.toLowerCase().includes(query),
      )
      .slice(0, 20);
  }, [usersData?.users, userSearchQuery]);

  // 添加权限
  const addPermissionMutation = useMutation({
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
      if (!response.ok) throw new Error("Failed to add permission");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-permissions"] });
      setIsAddDialogOpen(false);
      setNewPermission({ user_id: "", category_name: "", permission: "READ" });
      setUserSearchQuery("");
      toast.success("Permission added successfully");
    },
    onError: () => {
      toast.error("Failed to add permission");
    },
  });

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
        return "bg-red-500";
      case "CREATE":
        return "bg-purple-500";
      case "WRITE":
        return "bg-blue-500";
      case "READ":
        return "bg-green-500";
      default:
        return "bg-gray-500";
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
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Permissions
        </h2>
        <p className="text-gray-400 mt-2">
          Manage user access to corpus categories.
        </p>
      </div>

      {/* Search and Filter */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Filter Permissions</CardTitle>
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
              <SelectTrigger className="w-64 bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Select user to view permissions" />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5">
                  <Input
                    placeholder="Search users..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="h-8 bg-gray-600 border-gray-500 text-white"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="all">All Users</SelectItem>
                {filteredUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <span>{user.name || user.email || user.id}</span>
                      <span className="text-xs text-gray-400">{user.role}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 分类筛选 */}
            <Select
              value={categoryFilter || undefined}
              onValueChange={(value) =>
                setCategoryFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-48 bg-gray-700 border-gray-600 text-white">
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
                className="bg-gray-700 border-gray-600 text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            )}

            {/* 添加权限按钮 */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700 ml-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Permission
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 border-gray-700">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    Add New Permission
                  </DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Grant a user access to a corpus category.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* 用户选择带搜索 */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">User</label>
                    <div className="space-y-2">
                      <Input
                        placeholder="Search user by name or email..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      {newPermission.user_id && (
                        <div className="flex items-center gap-2 p-2 bg-gray-700 rounded">
                          <UserIcon className="h-4 w-4 text-gray-400" />
                          <span className="text-white text-sm">
                            {getSelectedUserName(newPermission.user_id)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setNewPermission({
                                ...newPermission,
                                user_id: "",
                              })
                            }
                            className="ml-auto h-6 w-6 p-0 text-gray-400 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {!newPermission.user_id && userSearchQuery && (
                        <div className="max-h-40 overflow-y-auto bg-gray-700 rounded border border-gray-600">
                          {filteredUsers.length === 0 ? (
                            <div className="p-2 text-sm text-gray-400">
                              No users found
                            </div>
                          ) : (
                            filteredUsers.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => {
                                  setNewPermission({
                                    ...newPermission,
                                    user_id: user.id,
                                  });
                                  setUserSearchQuery("");
                                }}
                                className="w-full px-3 py-2 text-left hover:bg-gray-600 flex items-center gap-2"
                              >
                                <UserIcon className="h-4 w-4 text-gray-400" />
                                <div>
                                  <div className="text-sm text-white">
                                    {user.name || "N/A"}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    {user.email} · {user.role}
                                  </div>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 分类选择 */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">Category</label>
                    <Select
                      value={newPermission.category_name}
                      onValueChange={(value) =>
                        setNewPermission({
                          ...newPermission,
                          category_name: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categoriesData?.categories.map((cat) => (
                          <SelectItem key={cat.name} value={cat.name}>
                            {cat.nickname || cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 权限级别选择 */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-300">
                      Permission Level
                    </label>
                    <Select
                      value={newPermission.permission}
                      onValueChange={(value) =>
                        setNewPermission({
                          ...newPermission,
                          permission: value,
                        })
                      }
                    >
                      <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="READ">READ - View only</SelectItem>
                        <SelectItem value="WRITE">
                          WRITE - Can update entries
                        </SelectItem>
                        <SelectItem value="CREATE">
                          CREATE - Can add and update entries
                        </SelectItem>
                        <SelectItem value="FULL">
                          FULL - All operations
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false);
                      setUserSearchQuery("");
                    }}
                    className="bg-gray-700 border-gray-600 text-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addPermissionMutation.mutate(newPermission)}
                    disabled={
                      !newPermission.user_id || !newPermission.category_name
                    }
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Add Permission
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 选中用户信息提示 */}
      {selectedUserId && (
        <Card className="bg-purple-900/30 border-purple-700">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <UserIcon className="h-5 w-5 text-purple-400" />
              <span className="text-white">
                Viewing permissions for:{" "}
                <strong>{getSelectedUserName(selectedUserId)}</strong>
              </span>
              <Badge className="bg-purple-600">
                {data?.permissions.length || 0} permissions
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Permissions Table */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">
            Permissions List ({data?.permissions.length || 0})
          </CardTitle>
          <CardDescription className="text-gray-400">
            User-corpus permission bindings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-400">Loading permissions...</div>
            </div>
          ) : data?.permissions.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              No permissions found. Click "Add Permission" to create one.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">User</TableHead>
                  <TableHead className="text-gray-300">Role</TableHead>
                  <TableHead className="text-gray-300">Category</TableHead>
                  <TableHead className="text-gray-300">Permission</TableHead>
                  <TableHead className="text-gray-300">Created</TableHead>
                  <TableHead className="text-gray-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.permissions.map((perm) => (
                  <TableRow
                    key={`${perm.user_id}-${perm.category_name}`}
                    className="border-gray-700"
                  >
                    <TableCell className="text-white">
                      <button
                        onClick={() => setSelectedUserId(perm.user_id)}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-left">
                          <div>{perm.user.name || "N/A"}</div>
                          <div className="text-xs text-gray-400">
                            {perm.user.email}
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500">{perm.user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
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
                          className={`w-28 h-8 ${getPermissionBadgeColor(perm.permission)} border-0 text-white text-xs`}
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
                    <TableCell className="text-gray-300">
                      {format(new Date(perm.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          deletePermissionMutation.mutate({
                            user_id: perm.user_id,
                            category_name: perm.category_name,
                          })
                        }
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
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
    </div>
  );
}
