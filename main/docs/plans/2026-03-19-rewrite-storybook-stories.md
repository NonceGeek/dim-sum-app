# Rewrite Storybook Stories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite all Storybook stories to use DimSum (Cantonese corpus management) domain data instead of blockchain explorer data, and match actual component usage patterns in the project.

**Architecture:** Each `.stories.tsx` file is independent and will be rewritten in-place. Stories should reflect real usage patterns from the codebase: actual props, variants, labels, and data structures. No new dependencies required.

**Tech Stack:** Storybook 10, React, TypeScript, Radix UI components, Tailwind CSS, lucide-react icons

---

## Context: DimSum Domain

DimSum AI Labs is a Cantonese corpus data hub with:
- **Entities:** Corpus categories (广州话正音字典), corpus entries (字/词), apps (学习/游戏/AI)
- **User roles:** LEARNER, TAGGER_PARTNER, TAGGER_OUTSOURCING, RESEARCHER
- **Permissions:** READ, WRITE, CREATE, FULL
- **Key fields:** 简体/繁体 (simplified/traditional), 粤音 (Cantonese pinyin), 释义 (meaning), 貢獻者 (contributor), 頁碼 (page number)
- **Corpus statuses:** RAW, INPROGRESS
- **Audit actions:** GRANT, REVOKE, MODIFY, ROLE_CHANGE

## Story Code Style

- `Meta<typeof Component>` with `tags: ["autodocs"]`
- `StoryObj<typeof Component>` type
- Named exports for variants (Default, AllVariants, etc.)
- Render functions for complex stories, `args` for simple ones
- Import from relative path (`"./button"`)

---

### Task 1: Button stories

**Files:**
- Modify: `components/ui/button.stories.tsx`

**Step 1: Rewrite button.stories.tsx**

Replace the entire file with domain-appropriate content. Key changes:
- AllVariants: use real labels ("保存", "删除帐号", "取消", "Search", "Sign In", "编辑")
- AllSizes: add `size="icon"` variant (used 17 times in project) with lucide icon
- Add WithIcon story showing Loader2 spinner pattern (actual loading state pattern)
- Keep Disabled story with domain labels

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Loader2, Search, Plus, Trash2, Settings } from "lucide-react";
import { Button } from "./button";

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default",
        "destructive",
        "outline",
        "secondary",
        "ghost",
        "link",
        "common",
      ],
    },
    size: {
      control: "select",
      options: ["default", "sm", "lg", "icon"],
    },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: "保存" },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="default">创建</Button>
      <Button variant="destructive">删除帐号</Button>
      <Button variant="outline">取消</Button>
      <Button variant="secondary">Revert</Button>
      <Button variant="ghost">Sign Out</Button>
      <Button variant="link">忘记密码?</Button>
      <Button variant="common">Apply</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Edit Profile</Button>
      <Button size="default">Search</Button>
      <Button size="lg">Sign In</Button>
      <Button variant="ghost" size="icon">
        <Settings className="h-4 w-4" />
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button>
        <Search className="w-4 h-4 mr-2" />
        Search
      </Button>
      <Button variant="outline">
        <Plus className="w-4 h-4 mr-2" />
        添加粤音
      </Button>
      <Button variant="destructive">
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </Button>
      <Button disabled>
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Saving...
      </Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button disabled>Save</Button>
      <Button variant="destructive" disabled>
        Delete
      </Button>
      <Button variant="outline" disabled>
        Cancel
      </Button>
      <Button variant="secondary" disabled>
        Revert
      </Button>
    </div>
  ),
};
```

**Step 2: Verify in Storybook**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm storybook --ci --smoke-test` (or manually open Storybook and check Components/Button)

---

### Task 2: Card stories

**Files:**
- Modify: `components/ui/card.stories.tsx`

**Step 1: Rewrite card.stories.tsx**

Key changes:
- Default: corpus category card pattern (actual usage)
- StatCard: dashboard stat card with icon (actual admin dashboard pattern)
- Minimal: simple content card (actual pattern in project)
- Remove CardFooter and CardAction (unused in project)

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";
import { Badge } from "./badge";
import { Users, BookOpen, FileText } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "Components/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[380px]">
      <CardHeader>
        <CardTitle>语料分类管理</CardTitle>
        <CardDescription>
          管理和查看所有粤语语料分类的状态与权限。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">分类数</span>
            <span>12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">公开分类</span>
            <span>8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">总词条数</span>
            <span>45,230</span>
          </div>
        </div>
      </CardContent>
    </Card>
  ),
};

export const StatCard: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-[640px]">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">1,247</div>
          <p className="text-xs text-muted-foreground">Active users this month</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">语料分类</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">12</div>
          <p className="text-xs text-muted-foreground">8 个公开</p>
        </CardContent>
      </Card>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总词条</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">45,230</div>
          <p className="text-xs text-muted-foreground">本月新增 320</p>
        </CardContent>
      </Card>
    </div>
  ),
};

export const CorpusCard: Story = {
  render: () => (
    <Card className="w-[380px] p-3 hover:shadow-lg transition-shadow cursor-pointer hover:bg-accent">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">广州话正音字典</h3>
          <Badge variant="secondary">置顶</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          收录广州话标准音的权威字典，包含粤音、释义及例词。
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>大小: 2.3 GB</span>
          <span>状态: INPROGRESS</span>
        </div>
      </div>
    </Card>
  ),
};
```

---

### Task 3: Badge stories

**Files:**
- Modify: `components/ui/badge.stories.tsx`

**Step 1: Rewrite badge.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Components/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "destructive", "outline"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: {
    children: "LEARNER",
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Badge variant="default">Active</Badge>
      <Badge variant="secondary">TAGGER_PARTNER</Badge>
      <Badge variant="destructive">Unverified</Badge>
      <Badge variant="outline">RAW</Badge>
    </div>
  ),
};

export const Roles: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="secondary">LEARNER</Badge>
      <Badge variant="secondary">TAGGER_PARTNER</Badge>
      <Badge variant="secondary">TAGGER_OUTSOURCING</Badge>
      <Badge variant="secondary">RESEARCHER</Badge>
    </div>
  ),
};

export const Permissions: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge className="bg-info text-info-foreground">READ</Badge>
      <Badge className="bg-warning text-warning-foreground">WRITE</Badge>
      <Badge className="bg-success text-success-foreground">CREATE</Badge>
      <Badge variant="default">FULL</Badge>
    </div>
  ),
};

export const CorpusStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="outline">RAW</Badge>
      <Badge variant="outline">INPROGRESS</Badge>
      <Badge variant="secondary">置顶</Badge>
    </div>
  ),
};
```

---

### Task 4: Dialog stories

**Files:**
- Modify: `components/ui/dialog.stories.tsx`

**Step 1: Rewrite dialog.stories.tsx**

Key changes:
- Default: corpus entry creation dialog (actual pattern)
- Controlled: controlled dialog with open/onOpenChange (dominant pattern in project)
- Uses DialogClose component (used in actual app)

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./dialog";
import { Button } from "./button";
import { Input } from "./input";

const meta: Meta<typeof Dialog> = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">创建新数据</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>创建新数据</DialogTitle>
          <DialogDescription>
            添加新的语料词条到当前分类中。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="char" className="text-sm font-medium">
              字符 *
            </label>
            <Input id="char" placeholder="输入汉字" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="pinyin" className="text-sm font-medium">
              粤音 *
            </label>
            <Input id="pinyin" placeholder="输入粤拼，如 jyut6 jyu5" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="meaning" className="text-sm font-medium">
              释义
            </label>
            <Input id="meaning" placeholder="输入释义" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const Controlled: Story = {
  render: function ControlledDialog() {
    const [open, setOpen] = useState(false);

    return (
      <>
        <Button variant="outline" onClick={() => setOpen(true)}>
          Edit Profile
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your display name and bio.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Display Name
                </label>
                <Input id="name" defaultValue="张三" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="bio" className="text-sm font-medium">
                  Bio
                </label>
                <Input id="bio" placeholder="Tell us about yourself" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
};

export const Confirmation: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">删除帐号</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除帐号</DialogTitle>
          <DialogDescription>
            此操作不可撤销。你的所有数据将在 30 天后被永久删除。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button variant="destructive">确认删除</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
```

---

### Task 5: Table stories

**Files:**
- Modify: `components/ui/table.stories.tsx`

**Step 1: Rewrite table.stories.tsx**

Key changes:
- Default: categories table (actual admin pattern)
- WithBadges: users table with role badges (actual pattern)
- Remove TableCaption, TableFooter (unused in project)

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "./table";
import { Badge } from "./badge";
import { Globe, Lock } from "lucide-react";

const meta: Meta<typeof Table> = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

const categories = [
  {
    name: "广州话正音字典",
    nickname: "ZYZD",
    status: "INPROGRESS" as const,
    isPublic: true,
    entries: 12450,
  },
  {
    name: "zyzdv2",
    nickname: "ZYZD V2",
    status: "RAW" as const,
    isPublic: false,
    entries: 8320,
  },
  {
    name: "corpus_yyjq",
    nickname: "粤语金曲",
    status: "INPROGRESS" as const,
    isPublic: true,
    entries: 3200,
  },
  {
    name: "corpus_movie",
    nickname: "粤语电影台词",
    status: "RAW" as const,
    isPublic: false,
    entries: 1580,
  },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground">Name</TableHead>
          <TableHead className="text-muted-foreground">Nickname</TableHead>
          <TableHead className="text-muted-foreground">Status</TableHead>
          <TableHead className="text-muted-foreground">Public</TableHead>
          <TableHead className="text-right text-muted-foreground">
            Entries
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((cat) => (
          <TableRow key={cat.name} className="border-border">
            <TableCell className="font-medium text-foreground">
              {cat.name}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {cat.nickname}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{cat.status}</Badge>
            </TableCell>
            <TableCell>
              {cat.isPublic ? (
                <Globe className="h-4 w-4 text-success" />
              ) : (
                <Lock className="h-4 w-4 text-warning" />
              )}
            </TableCell>
            <TableCell className="text-right">
              {cat.entries.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

const users = [
  { name: "张三", email: "zhangsan@example.com", role: "RESEARCHER" as const },
  { name: "李四", email: "lisi@example.com", role: "TAGGER_PARTNER" as const },
  { name: "王五", email: "wangwu@example.com", role: "LEARNER" as const },
  {
    name: "赵六",
    email: "zhaoliu@example.com",
    role: "TAGGER_OUTSOURCING" as const,
  },
];

export const UsersTable: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow className="border-border">
          <TableHead className="text-muted-foreground">Name</TableHead>
          <TableHead className="text-muted-foreground">Email</TableHead>
          <TableHead className="text-muted-foreground">Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.email} className="border-border">
            <TableCell className="font-medium text-foreground">
              {user.name}
            </TableCell>
            <TableCell className="text-muted-foreground">{user.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{user.role}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
```

---

### Task 6: Avatar stories

**Files:**
- Modify: `components/ui/avatar.stories.tsx`

**Step 1: Rewrite avatar.stories.tsx**

Key changes:
- Match actual sizes used (h-6 w-6, h-8 w-8)
- Use Chinese name fallbacks (actual pattern)
- Remove Group story (unused in project)

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";

const meta: Meta<typeof Avatar> = {
  title: "Components/Avatar",
  component: Avatar,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <Avatar>
      <AvatarImage
        src="https://github.com/shadcn.png"
        alt="User avatar"
      />
      <AvatarFallback>张</AvatarFallback>
    </Avatar>
  ),
};

export const Fallback: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="/nonexistent.png" alt="Unknown user" />
      <AvatarFallback>U</AvatarFallback>
    </Avatar>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">张</AvatarFallback>
      </Avatar>
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-sm">李</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback>王</AvatarFallback>
      </Avatar>
      <Avatar className="size-12">
        <AvatarFallback className="text-lg">赵</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithName: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarImage src="https://github.com/shadcn.png" alt="张三" />
        <AvatarFallback>张</AvatarFallback>
      </Avatar>
      <div>
        <p className="text-sm font-medium">张三</p>
        <p className="text-xs text-muted-foreground">RESEARCHER</p>
      </div>
    </div>
  ),
};
```

---

### Task 7: Input stories

**Files:**
- Modify: `components/ui/input.stories.tsx`

**Step 1: Rewrite input.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Search } from "lucide-react";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    type: {
      control: "select",
      options: ["text", "password", "email", "number", "search", "tel", "url"],
    },
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: "搜索分类...",
    type: "search",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: "广州话正音字典",
    type: "text",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="pinyin" className="text-sm font-medium">
        粤音
      </label>
      <Input id="pinyin" placeholder="输入粤拼，如 jyut6 jyu5" />
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
      <Input
        placeholder="Search by name or nickname..."
        className="pl-10 bg-secondary border-border text-foreground"
      />
    </div>
  ),
};

export const Number: Story = {
  render: () => (
    <div className="grid w-full max-w-[120px] gap-1.5">
      <label htmlFor="page" className="text-sm font-medium">
        Page
      </label>
      <Input
        id="page"
        type="number"
        placeholder="Go to Page"
        min={1}
        className="text-center"
      />
    </div>
  ),
};

export const File: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="avatar" className="text-sm font-medium">
        Avatar
      </label>
      <Input id="avatar" type="file" accept="image/*" />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "Read-only field",
    disabled: true,
  },
};
```

---

### Task 8: Select stories

**Files:**
- Modify: `components/ui/select.stories.tsx`

**Step 1: Rewrite select.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Filter by role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Roles</SelectItem>
        <SelectItem value="LEARNER">Learner</SelectItem>
        <SelectItem value="TAGGER_PARTNER">Tagger Partner</SelectItem>
        <SelectItem value="TAGGER_OUTSOURCING">Tagger Outsourcing</SelectItem>
        <SelectItem value="RESEARCHER">Researcher</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Permissions: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Permission level" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="READ">READ</SelectItem>
        <SelectItem value="WRITE">WRITE</SelectItem>
        <SelectItem value="CREATE">CREATE</SelectItem>
        <SelectItem value="FULL">FULL</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Small: Story = {
  render: () => (
    <Select>
      <SelectTrigger size="sm" className="w-[160px]">
        <SelectValue placeholder="Rows per page" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 rows</SelectItem>
        <SelectItem value="25">25 rows</SelectItem>
        <SelectItem value="50">50 rows</SelectItem>
        <SelectItem value="100">100 rows</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Select disabled>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Not available" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
      </SelectContent>
    </Select>
  ),
};
```

---

### Task 9: Tabs stories

**Files:**
- Modify: `components/ui/tabs.stories.tsx`

**Step 1: Rewrite tabs.stories.tsx**

Even though Tabs is not currently used in the app, keep as component documentation with domain data.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";

const meta: Meta<typeof Tabs> = {
  title: "Components/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="entries">词条</TabsTrigger>
        <TabsTrigger value="history">修改记录</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-md border p-4 text-sm">
          <p>
            广州话正音字典：收录 12,450 个词条，由 15 位标注员协作维护。
          </p>
        </div>
      </TabsContent>
      <TabsContent value="entries">
        <div className="rounded-md border p-4 text-sm">
          <p>最近更新：「粤」jyut6 — 广东省的简称。</p>
        </div>
      </TabsContent>
      <TabsContent value="history">
        <div className="rounded-md border p-4 text-sm">
          <p>张三 于 2026-03-18 修改了「声」的粤音标注。</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const MultipleTabs: Story = {
  render: () => (
    <Tabs defaultValue="corpus" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="corpus">语料集</TabsTrigger>
        <TabsTrigger value="apps">应用</TabsTrigger>
        <TabsTrigger value="users">用户</TabsTrigger>
        <TabsTrigger value="logs">操作日志</TabsTrigger>
      </TabsList>
      <TabsContent value="corpus">
        <div className="rounded-md border p-4 text-sm">
          <p>12 个语料分类，共 45,230 个词条。</p>
        </div>
      </TabsContent>
      <TabsContent value="apps">
        <div className="rounded-md border p-4 text-sm">
          <p>8 个已上架应用，涵盖学习、游戏和 AI 工具。</p>
        </div>
      </TabsContent>
      <TabsContent value="users">
        <div className="rounded-md border p-4 text-sm">
          <p>1,247 名注册用户，其中活跃标注员 32 名。</p>
        </div>
      </TabsContent>
      <TabsContent value="logs">
        <div className="rounded-md border p-4 text-sm">
          <p>最近 24 小时：128 次权限变更，45 次角色调整。</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
```

---

### Task 10: DropdownMenu stories

**Files:**
- Modify: `components/ui/dropdown-menu.stories.tsx`

**Step 1: Rewrite dropdown-menu.stories.tsx**

Key changes: Simplify to patterns actually used (basic menu + destructive item). Remove Sub/Radio/Checkbox stories.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";
import { Button } from "./button";
import { MoreHorizontal } from "lucide-react";

const meta: Meta<typeof DropdownMenu> = {
  title: "Components/DropdownMenu",
  component: DropdownMenu,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Open Menu</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>My Record</DropdownMenuItem>
        <DropdownMenuItem>Preferences</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Sign Out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const IconTrigger: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>编辑</DropdownMenuItem>
        <DropdownMenuItem>复制链接</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">删除</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
```

---

### Task 11: Sheet stories

**Files:**
- Modify: `components/ui/sheet.stories.tsx`

**Step 1: Rewrite sheet.stories.tsx**

Key changes: Only show `side="left"` (actual usage). Mobile sidebar navigation pattern.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./sheet";
import { Button } from "./button";
import { Menu, Home, BookOpen, AppWindow, FileText } from "lucide-react";

const meta: Meta<typeof Sheet> = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Sheet>;

export const Default: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetHeader>
          <SheetTitle>DimSum AI Labs</SheetTitle>
          <SheetDescription>Navigate the platform.</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-4 mt-4">
          <Button variant="ghost" className="justify-start gap-2">
            <Home className="h-4 w-4" />
            Home
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <BookOpen className="h-4 w-4" />
            Library
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <AppWindow className="h-4 w-4" />
            App Store
          </Button>
          <Button variant="ghost" className="justify-start gap-2">
            <FileText className="h-4 w-4" />
            Docs
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  ),
};
```

---

### Task 12: Popover stories

**Files:**
- Modify: `components/ui/popover.stories.tsx`

**Step 1: Rewrite popover.stories.tsx**

Key changes: Tag filter popover (actual pattern), info tooltip-style popover.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Popover> = {
  title: "Components/Popover",
  component: Popover,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Popover>;

export const Default: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">选择标签</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <div className="p-3 border-b border-border">
          <Input placeholder="搜索标签..." className="h-8" />
        </div>
        <div className="p-2 space-y-1">
          {["粤音", "释义", "例词", "粤剧", "口语"].map((tag) => (
            <div key={tag} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
              <Checkbox id={tag} />
              <label htmlFor={tag} className="text-sm cursor-pointer">
                {tag}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const WithInfo: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm">Editable Level</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            ?
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <p className="text-sm">
            Controls who can edit corpus entries. Level 0: not editable.
            Level 1: taggers only. Level 2: all logged-in users.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  ),
};
```

---

### Task 13: Tooltip stories

**Files:**
- Modify: `components/ui/tooltip.stories.tsx`

**Step 1: Rewrite tooltip.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip";
import { Button } from "./button";
import { Sun } from "lucide-react";

const meta: Meta<typeof Tooltip> = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline">Hover me</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>查看语料详情</p>
      </TooltipContent>
    </Tooltip>
  ),
};

export const OnIconButton: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon">
          <Sun className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle theme</TooltipContent>
    </Tooltip>
  ),
};

export const Placements: Story = {
  render: () => (
    <div className="flex items-center justify-center gap-8 p-16">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">Top</Button>
        </TooltipTrigger>
        <TooltipContent side="top">Tooltip on top</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">Bottom</Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Tooltip on bottom</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">Left</Button>
        </TooltipTrigger>
        <TooltipContent side="left">Tooltip on left</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm">Right</Button>
        </TooltipTrigger>
        <TooltipContent side="right">Tooltip on right</TooltipContent>
      </Tooltip>
    </div>
  ),
};

export const TruncatedText: Story = {
  render: () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-sm cursor-pointer underline decoration-dotted">
          zhangsan@example.com
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Click to copy email address</p>
      </TooltipContent>
    </Tooltip>
  ),
};
```

---

### Task 14: Checkbox stories

**Files:**
- Modify: `components/ui/checkbox.stories.tsx`

**Step 1: Rewrite checkbox.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "./checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="terms" />
      <label
        htmlFor="terms"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        I agree to the Terms of Service and Privacy Policy
      </label>
    </div>
  ),
};

export const Checked: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Checkbox id="checked" defaultChecked />
      <label htmlFor="checked" className="text-sm font-medium leading-none">
        公开此分类
      </label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-unchecked" disabled />
        <label
          htmlFor="disabled-unchecked"
          className="text-sm font-medium leading-none opacity-50"
        >
          Feature unavailable
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="disabled-checked" disabled defaultChecked />
        <label
          htmlFor="disabled-checked"
          className="text-sm font-medium leading-none opacity-50"
        >
          Always enabled
        </label>
      </div>
    </div>
  ),
};

export const CategoryFilter: Story = {
  render: () => (
    <div className="grid gap-3">
      <h4 className="text-sm font-medium">选择分类筛选</h4>
      <div className="flex items-center gap-2">
        <Checkbox id="zyzd" defaultChecked />
        <label htmlFor="zyzd" className="text-sm leading-none">
          广州话正音字典
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="yyjq" defaultChecked />
        <label htmlFor="yyjq" className="text-sm leading-none">
          粤语金曲
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="movie" />
        <label htmlFor="movie" className="text-sm leading-none">
          粤语电影台词
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="drama" />
        <label htmlFor="drama" className="text-sm leading-none">
          粤剧唱词
        </label>
      </div>
    </div>
  ),
};
```

---

### Task 15: RadioGroup stories

**Files:**
- Modify: `components/ui/radio-group.stories.tsx`

**Step 1: Rewrite radio-group.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { cn } from "@/lib/utils";

const meta: Meta<typeof RadioGroup> = {
  title: "Components/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof RadioGroup>;

export const Default: Story = {
  render: () => (
    <RadioGroup defaultValue="learner">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="learner" id="learner" />
        <label htmlFor="learner" className="text-sm font-medium leading-none">
          Learner
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tagger" id="tagger" />
        <label htmlFor="tagger" className="text-sm font-medium leading-none">
          Tagger
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="researcher" id="researcher" />
        <label htmlFor="researcher" className="text-sm font-medium leading-none">
          Researcher
        </label>
      </div>
    </RadioGroup>
  ),
};

export const WithDescriptions: Story = {
  render: () => (
    <RadioGroup defaultValue="read">
      <div className="flex items-start gap-3">
        <RadioGroupItem value="read" id="read" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="read" className="text-sm font-medium leading-none">
            READ
          </label>
          <p className="text-sm text-muted-foreground">
            Can only view public corpus entries.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="write" id="write" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="write" className="text-sm font-medium leading-none">
            WRITE
          </label>
          <p className="text-sm text-muted-foreground">
            Can view and edit existing corpus entries.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3">
        <RadioGroupItem value="create" id="create" className="mt-0.5" />
        <div className="grid gap-0.5">
          <label htmlFor="create" className="text-sm font-medium leading-none">
            CREATE
          </label>
          <p className="text-sm text-muted-foreground">
            Can view, edit, and create new corpus entries.
          </p>
        </div>
      </div>
    </RadioGroup>
  ),
};

export const CardStyle: Story = {
  render: () => (
    <RadioGroup
      defaultValue="learner"
      className="flex flex-col items-center space-y-4"
    >
      {["Learner", "Tagger", "Researcher"].map((role) => (
        <div key={role} className="w-full max-w-[200px]">
          <RadioGroupItem
            value={role.toLowerCase()}
            id={`card-${role.toLowerCase()}`}
            className="peer sr-only"
          />
          <label
            htmlFor={`card-${role.toLowerCase()}`}
            className={cn(
              "flex h-10 w-full items-center justify-center rounded-md border-2 border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary"
            )}
          >
            {role}
          </label>
        </div>
      ))}
    </RadioGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <RadioGroup defaultValue="learner" disabled>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="learner" id="d-learner" />
        <label
          htmlFor="d-learner"
          className="text-sm font-medium leading-none opacity-50"
        >
          Learner
        </label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="tagger" id="d-tagger" />
        <label
          htmlFor="d-tagger"
          className="text-sm font-medium leading-none opacity-50"
        >
          Tagger
        </label>
      </div>
    </RadioGroup>
  ),
};
```

---

### Task 16: Switch stories

**Files:**
- Modify: `components/ui/switch.stories.tsx`

**Step 1: Rewrite switch.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";
import { Globe, Lock } from "lucide-react";

const meta: Meta<typeof Switch> = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  argTypes: {
    checked: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof Switch>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="default-switch" />
      <label htmlFor="default-switch" className="text-sm font-medium">
        公开此分类
      </label>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Switch id="public-switch" defaultChecked />
      <Globe className="h-4 w-4 text-success" />
      <label htmlFor="public-switch" className="text-sm font-medium">
        Public
      </label>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Switch id="disabled-off" disabled />
        <label
          htmlFor="disabled-off"
          className="text-sm font-medium opacity-50"
        >
          Disabled (off)
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="disabled-on" disabled defaultChecked />
        <label
          htmlFor="disabled-on"
          className="text-sm font-medium opacity-50"
        >
          Disabled (on)
        </label>
      </div>
    </div>
  ),
};

export const SettingsList: Story = {
  render: () => (
    <div className="w-full max-w-sm space-y-4">
      <h4 className="text-sm font-medium">分类设置</h4>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">公开</p>
          <p className="text-xs text-muted-foreground">
            Allow all users to browse this corpus
          </p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">置顶</p>
          <p className="text-xs text-muted-foreground">
            Pin this corpus to the top of the library
          </p>
        </div>
        <Switch />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">允许编辑</p>
          <p className="text-xs text-muted-foreground">
            Let taggers modify entries in this corpus
          </p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  ),
};
```

---

### Task 17: Textarea stories

**Files:**
- Modify: `components/ui/textarea.stories.tsx`

**Step 1: Rewrite textarea.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "./textarea";

const meta: Meta<typeof Textarea> = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    placeholder: { control: "text" },
    disabled: { control: "boolean" },
    rows: { control: "number" },
  },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: {
    placeholder: "Tell us about yourself...",
  },
};

export const WithValue: Story = {
  args: {
    defaultValue:
      "粤语，又称广东话、广府话，是汉语的一种方言，主要流通于广东省珠江三角洲地区、香港及澳门。",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm gap-1.5">
      <label htmlFor="bio" className="text-sm font-medium">
        Bio
      </label>
      <Textarea
        id="bio"
        placeholder="Tell us about yourself"
        className="min-h-[100px]"
      />
      <p className="text-xs text-muted-foreground">
        This will be displayed on your public profile.
      </p>
    </div>
  ),
};

export const RuleInput: Story = {
  render: () => (
    <div className="grid w-full gap-1.5">
      <label htmlFor="rule" className="text-sm font-medium">
        规则编译检查
      </label>
      <Textarea
        id="rule"
        placeholder="请输入要编译的规则..."
        rows={6}
        className="bg-background border-border"
      />
    </div>
  ),
};

export const JsonEditor: Story = {
  render: () => (
    <div className="grid w-full gap-1.5">
      <label htmlFor="json" className="text-sm font-medium">
        Corpus Note (JSON)
      </label>
      <Textarea
        id="json"
        className="font-mono text-xs"
        rows={8}
        defaultValue={JSON.stringify(
          {
            context: {
              pinyin: ["jyut6", "jyu5"],
              meaning: ["Cantonese language", "粤语"],
              page: 42,
              number: "A-0156",
            },
            contributor: "张三",
          },
          null,
          2
        )}
      />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    placeholder: "This field is read-only",
    disabled: true,
  },
};
```

---

### Task 18: Skeleton stories

**Files:**
- Modify: `components/ui/skeleton.stories.tsx`

**Step 1: Rewrite skeleton.stories.tsx**

Key changes: Rename "TransactionRow" to "CorpusEntryRow", rename "DetailPage" to match actual patterns.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Components/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-[250px]" />,
};

export const TextLines: Story = {
  render: () => (
    <div className="space-y-2">
      <Skeleton className="h-4 w-[300px]" />
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
    </div>
  ),
};

export const UserProfile: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-[150px]" />
        <Skeleton className="h-4 w-[100px]" />
      </div>
    </div>
  ),
};

export const CorpusCard: Story = {
  render: () => (
    <div className="rounded-lg border p-4 space-y-4 w-full max-w-sm">
      <div className="space-y-1.5">
        <Skeleton className="h-5 w-[180px]" />
        <Skeleton className="h-3 w-[120px]" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[80%]" />
      <div className="flex gap-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  ),
};

export const TableRows: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <div className="flex gap-4 px-4 py-3 border-b border-border">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-28" />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  ),
};
```

---

### Task 19: Separator stories

**Files:**
- Modify: `components/ui/separator.stories.tsx`

**Step 1: Rewrite separator.stories.tsx**

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Separator } from "./separator";

const meta: Meta<typeof Separator> = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Separator>;

export const Default: Story = {
  render: () => (
    <div className="w-full max-w-sm">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">广州话正音字典</h4>
        <p className="text-sm text-muted-foreground">
          ZYZD — 收录广州话标准音的权威字典
        </p>
      </div>
      <Separator className="my-4" />
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Status</h4>
        <p className="text-sm text-muted-foreground">INPROGRESS</p>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Home</span>
      <Separator orientation="vertical" />
      <span>Library</span>
      <Separator orientation="vertical" />
      <span>App Store</span>
      <Separator orientation="vertical" />
      <span>Docs</span>
    </div>
  ),
};

export const InDetailsList: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">分类</span>
        <span className="text-sm font-medium">广州话正音字典</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">词条数</span>
        <span className="text-sm font-medium">12,450</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">贡献者</span>
        <span className="text-sm font-medium">15 人</span>
      </div>
      <Separator />
      <div className="flex justify-between py-3">
        <span className="text-sm text-muted-foreground">大小</span>
        <span className="text-sm font-medium">2.3 GB</span>
      </div>
    </div>
  ),
};

export const WithHeading: Story = {
  render: () => (
    <div className="w-full max-w-md">
      <h3 className="text-lg font-semibold">语料集概览</h3>
      <p className="text-sm text-muted-foreground">
        查看所有分类的统计信息与权限状态。
      </p>
      <Separator className="my-4" />
      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">总分类数</span>
          <span className="font-medium">12</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">总词条数</span>
          <span className="font-medium">45,230</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">活跃标注员</span>
          <span className="font-medium">32</span>
        </div>
      </div>
    </div>
  ),
};
```

---

### Task 20: Form stories

**Files:**
- Modify: `components/ui/form.stories.tsx`

**Step 1: Rewrite form.stories.tsx**

Key changes: Use corpus-relevant form fields instead of blockchain data.

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "./form";
import { Input } from "./input";
import { Button } from "./button";

const meta: Meta<typeof Form> = {
  title: "Components/Form",
  component: Form,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Form>;

const searchSchema = z.object({
  query: z.string().min(2, "Search query must be at least 2 characters"),
});

function SearchFormExample() {
  const form = useForm<z.infer<typeof searchSchema>>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  });

  function onSubmit(values: z.infer<typeof searchSchema>) {
    console.log("Search submitted:", values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-[400px]">
        <FormField
          control={form.control}
          name="query"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Search</FormLabel>
              <FormControl>
                <Input placeholder="搜索分类或词条..." {...field} />
              </FormControl>
              <FormDescription>
                Enter a category name, character, or pinyin to search.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Search</Button>
      </form>
    </Form>
  );
}

export const Default: Story = {
  render: () => <SearchFormExample />,
};

const corpusEntrySchema = z.object({
  character: z.string().min(1, "字符不能为空"),
  pinyin: z.string().min(1, "粤音不能为空"),
  meaning: z.string().optional(),
});

function CorpusEntryFormExample() {
  const form = useForm<z.infer<typeof corpusEntrySchema>>({
    resolver: zodResolver(corpusEntrySchema),
    defaultValues: { character: "", pinyin: "", meaning: "" },
  });

  function onSubmit(values: z.infer<typeof corpusEntrySchema>) {
    console.log("Entry submitted:", values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-[400px]">
        <FormField
          control={form.control}
          name="character"
          render={({ field }) => (
            <FormItem>
              <FormLabel>字符</FormLabel>
              <FormControl>
                <Input placeholder="输入汉字" {...field} />
              </FormControl>
              <FormDescription>The character or word to add.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="pinyin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>粤音</FormLabel>
              <FormControl>
                <Input placeholder="如 jyut6 jyu5" {...field} />
              </FormControl>
              <FormDescription>
                Cantonese pronunciation in Jyutping romanization.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="meaning"
          render={({ field }) => (
            <FormItem>
              <FormLabel>释义</FormLabel>
              <FormControl>
                <Input placeholder="输入释义（可选）" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
          <Button type="submit">创建</Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
        </div>
      </form>
    </Form>
  );
}

export const CorpusEntry: Story = {
  render: () => <CorpusEntryFormExample />,
};
```

---

### Task 21: Verify all stories build

**Step 1: Run Storybook build**

Run: `cd /Users/fun/Documents/GitHub/dimsum-app/main && pnpm storybook build`

Expected: Build completes with no errors.

**Step 2: Fix any build errors**

If any story has import errors or TypeScript issues, fix them.

**Step 3: Commit**

```bash
cd /Users/fun/Documents/GitHub/dimsum-app/main
git add components/ui/*.stories.tsx components/theme-toggle/theme-toggle.stories.tsx
git commit -m "refactor: rewrite Storybook stories with DimSum domain data

Replace all blockchain explorer placeholder data with actual Cantonese
corpus management domain data. Match component usage patterns to real
codebase patterns. Add missing story variants (Button icon size,
controlled Dialog, etc.) and remove unused sub-component demos.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
