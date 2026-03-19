import { Button } from "@/components/ui/button";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SearchResult } from "@/lib/api/search";
import { X } from "lucide-react";
import { useMemo, useState } from "react";

export default function CategorySelector({
  selectCategory,
  setSelectCategory,
  results,
  selectedDataset,
}: {
  selectCategory: string;
  setSelectCategory: (category: string) => void;
  results: SearchResult[] | null;
  selectedDataset: string[];
}) {
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState<string>("");

  console.log("selectCategory", selectCategory);
  const allCategories = useMemo(() => {
    const categoryInfo = new Map<string, { count: number; index: number }>();

    let index = 0;

    results?.forEach((item) => {
      const category = item.category;
      if (!categoryInfo.has(category)) {
        categoryInfo.set(category, { count: 1, index: index++ });
      } else {
        categoryInfo.get(category)!.count++;
      }
    });

    return categoryInfo;
  }, [results]);

  const uniqueCategories = useMemo(() => {
    return [...new Set(results?.map((r) => r.category))];
  }, [results]);
  return (
    <>
      {(selectedDataset.length > 1 || selectedDataset[0] === "all") && (
        <div className="flex flex-wrap items-center gap-2 my-6 justify-center">
          {uniqueCategories.length <= 5 ? (
            <>
              <button
                className={`px-4 py-1.5 rounded-full text-sm cursor-point ${
                  selectCategory === "全部"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground"
                }`}
                onClick={() => setSelectCategory("全部")}
              >
                全部
              </button>
              {uniqueCategories.map((category) => (
                <button
                  key={category}
                  className={`px-4 py-1.5 rounded-full text-sm cursor-point ${
                    category === selectCategory
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground"
                  }`}
                  onClick={() => setSelectCategory(category)}
                >
                  {category}
                </button>
              ))}
            </>
          ) : (
            <>
              {selectCategory && (
                <button
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm cursor-point ${
                    selectCategory === "全部"
                      ? "bg-card text-muted-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {selectCategory}
                  {selectCategory !== "全部" && (
                    <X
                      className="h-3 w-3 hover:text-muted-foreground"
                      onClick={() => {
                        setSelectCategory("全部");
                      }}
                    />
                  )}
                </button>
              )}
              <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-9 px-4 text-sm hover:bg-background dark:bg-background dark:text-accent-foreground"
                  >
                    选择分类筛选
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0">
                  <Command className="bg-background!">
                    <CommandInput
                      placeholder="搜索分类..."
                      value={tagInputValue}
                      onValueChange={setTagInputValue}
                    />
                    <CommandList>
                      <CommandItem
                        value="全部"
                        onSelect={() => {
                          setSelectCategory("全部");
                          setTagPopoverOpen(false);
                        }}
                      >
                        <div className="flex items-start justify-between w-full">
                          <span className="w-[200px] text-left wrap-break-word">
                            全部
                          </span>
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">
                            {results?.length || 0} 个文档
                          </span>
                        </div>
                      </CommandItem>
                      {[...allCategories.entries()]
                        .filter(([category]) =>
                          category
                            .toLowerCase()
                            .includes(tagInputValue.toLowerCase()),
                        )
                        .sort((a, b) => b[1].count - a[1].count)
                        .map(([category, info]) => (
                          <CommandItem
                            key={category}
                            value={category}
                            onSelect={() => {
                              setSelectCategory(category);
                              setTagPopoverOpen(false);
                            }}
                          >
                            <div className="flex items-start justify-between w-full">
                              <span className="w-[200px] text-left wrap-break-word">
                                {category}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                                {info.count} 个文档
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      )}
    </>
  );
}
