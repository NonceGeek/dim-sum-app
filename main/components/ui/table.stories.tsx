import type { Meta, StoryObj } from "@storybook/react";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "./table";
import { Badge } from "./badge";

const meta: Meta<typeof Table> = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Table>;

const transactions = [
  {
    hash: "0xabc1...def2",
    type: "Transfer",
    sender: "0x1a2b...3c4d",
    gasUsed: "1,200",
    status: "success" as const,
  },
  {
    hash: "0x4e5f...6a7b",
    type: "Swap",
    sender: "0x8c9d...0e1f",
    gasUsed: "3,450",
    status: "success" as const,
  },
  {
    hash: "0x2a3b...4c5d",
    type: "Stake",
    sender: "0x6e7f...8a9b",
    gasUsed: "2,100",
    status: "failed" as const,
  },
  {
    hash: "0x0c1d...2e3f",
    type: "Transfer",
    sender: "0x4a5b...6c7d",
    gasUsed: "980",
    status: "success" as const,
  },
];

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Recent transactions on the network.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Hash</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Sender</TableHead>
          <TableHead className="text-right">Gas Used</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.hash}>
            <TableCell className="font-mono">{tx.hash}</TableCell>
            <TableCell>{tx.type}</TableCell>
            <TableCell className="font-mono">{tx.sender}</TableCell>
            <TableCell className="text-right">{tx.gasUsed}</TableCell>
            <TableCell>
              <Badge
                variant={tx.status === "success" ? "default" : "destructive"}
              >
                {tx.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Validator</TableHead>
          <TableHead>Voting Power</TableHead>
          <TableHead className="text-right">Stake (MOVE)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Validator A</TableCell>
          <TableCell>12.4%</TableCell>
          <TableCell className="text-right">2,500,000</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Validator B</TableCell>
          <TableCell>8.7%</TableCell>
          <TableCell className="text-right">1,740,000</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Validator C</TableCell>
          <TableCell>6.2%</TableCell>
          <TableCell className="text-right">1,240,000</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Total</TableCell>
          <TableCell className="text-right font-bold">5,480,000</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
