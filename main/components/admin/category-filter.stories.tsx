import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CategoryFilter } from "./category-filter";

function Preview() {
  const [value, setValue] = useState("");
  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">
        分类筛选样例：同名语料集以编号区分，支持名称或编号搜索。
      </p>
      <CategoryFilter
        value={value}
        onChange={setValue}
        allLabel="全部分类"
        searchLabel="搜索分类名称或编号..."
        emptyLabel="未找到分类。"
        categories={[
          {
            id: 68,
            name: "activity-autumn-a",
            nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
          },
          {
            id: 69,
            name: "activity-autumn-b",
            nickname: "自在禅城，舒度时光 - 地道岭南秋韵",
          },
          {
            id: 49,
            name: "activity-memory-a",
            nickname: "「粤菜记忆」声音资源征集",
          },
          {
            id: 57,
            name: "activity-memory-b",
            nickname: "「粤菜记忆」声音资源征集",
          },
          { id: 12, name: "internal-test", nickname: "测试语料（内部）" },
        ]}
      />
      <p className="text-sm">当前筛选值：{value || "全部分类"}</p>
    </div>
  );
}
const meta: Meta = { title: "Admin/Category filter", component: Preview };
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
