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
