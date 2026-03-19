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
