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
        <TabsTrigger value="events">Events</TabsTrigger>
        <TabsTrigger value="payload">Payload</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-md border p-4 text-sm">
          <p>
            Transaction executed successfully with 1,200 gas units consumed.
            Block height: 84,291,037.
          </p>
        </div>
      </TabsContent>
      <TabsContent value="events">
        <div className="rounded-md border p-4 text-sm">
          <p>3 events emitted: CoinRegister, WithdrawEvent, DepositEvent.</p>
        </div>
      </TabsContent>
      <TabsContent value="payload">
        <div className="rounded-md border p-4 text-sm">
          <p>
            Function: 0x1::coin::transfer
            <br />
            Type arguments: 0x1::aptos_coin::AptosCoin
          </p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};

export const MultipleTabs: Story = {
  render: () => (
    <Tabs defaultValue="tokens" className="w-[500px]">
      <TabsList>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="nfts">NFTs</TabsTrigger>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="resources">Resources</TabsTrigger>
      </TabsList>
      <TabsContent value="tokens">
        <div className="rounded-md border p-4 text-sm">
          <p>MOVE: 1,250.00 | USDC: 500.00 | WETH: 0.5</p>
        </div>
      </TabsContent>
      <TabsContent value="nfts">
        <div className="rounded-md border p-4 text-sm">
          <p>3 NFT collections found.</p>
        </div>
      </TabsContent>
      <TabsContent value="transactions">
        <div className="rounded-md border p-4 text-sm">
          <p>142 transactions in the last 30 days.</p>
        </div>
      </TabsContent>
      <TabsContent value="resources">
        <div className="rounded-md border p-4 text-sm">
          <p>12 on-chain resources associated with this account.</p>
        </div>
      </TabsContent>
    </Tabs>
  ),
};
