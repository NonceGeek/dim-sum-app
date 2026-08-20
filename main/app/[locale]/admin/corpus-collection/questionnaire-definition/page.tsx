"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Database, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type QuestionKey = "ageRange" | "cultureRegion" | "interestTypes";
type Question = {
  key: QuestionKey;
  type: "single_choice" | "multiple_choice";
  required: boolean;
  title: string;
  description?: string;
  options: Array<{ code: string; label: string }>;
};
type Questionnaire = {
  schemaVersion: number;
  name: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  questions: Question[];
};
type DefinitionData = {
  current: Questionnaire | null;
  versions: Array<Omit<Questionnaire, "questions">>;
};

export default function QuestionnaireDefinitionPage() {
  const t = useTranslations("QuestionnaireDefinition");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery<DefinitionData>({
    queryKey: ["questionnaire-definition"],
    queryFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-definition");
      if (!response.ok) throw new Error(t("loadFailed"));
      return response.json();
    },
  });

  useEffect(() => {
    if (!data?.current) return;
    setName(data.current.name);
    setQuestions(data.current.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    })));
  }, [data]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/corpus-collection/questionnaire-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, definition: { questions } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(t("publishFailed"));
      return result;
    },
    onSuccess: (result) => {
      setConfirmOpen(false);
      toast.success(t("publishSuccess", { version: result.questionnaire.schemaVersion }));
      queryClient.invalidateQueries({ queryKey: ["questionnaire-definition"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("publishFailed")),
  });

  const updateQuestion = (index: number, patch: Partial<Question>) => {
    setQuestions((current) => current.map((question, questionIndex) =>
      questionIndex === index ? { ...question, ...patch } : question));
  };
  const updateOption = (questionIndex: number, optionIndex: number, field: "code" | "label", value: string) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) =>
      currentQuestionIndex !== questionIndex
        ? question
        : {
            ...question,
            options: question.options.map((option, currentOptionIndex) =>
              currentOptionIndex === optionIndex ? { ...option, [field]: value } : option),
          }));
  };
  const moveOption = (questionIndex: number, optionIndex: number, direction: -1 | 1) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) => {
      if (currentQuestionIndex !== questionIndex) return question;
      const targetIndex = optionIndex + direction;
      if (targetIndex < 0 || targetIndex >= question.options.length) return question;
      const options = [...question.options];
      [options[optionIndex], options[targetIndex]] = [options[targetIndex], options[optionIndex]];
      return { ...question, options };
    }));
  };
  const addOption = (questionIndex: number) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) =>
      currentQuestionIndex === questionIndex
        ? { ...question, options: [...question.options, { code: `option_${Date.now()}`, label: t("newOption") }] }
        : question));
  };
  const removeOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((current) => current.map((question, currentQuestionIndex) =>
      currentQuestionIndex === questionIndex
        ? { ...question, options: question.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex) }
        : question));
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-12 w-80" /><Skeleton className="h-96 w-full" /></div>;
  }
  if (isError || !data?.current) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 py-16">
        <p className="text-sm text-muted-foreground">{t("unavailable")}</p>
        <Button variant="outline" onClick={() => refetch()}>{t("reload")}</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{t("title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("description", { version: data.current.schemaVersion })}</p>
        </div>
        <Button onClick={() => setConfirmOpen(true)} disabled={!name.trim() || questions.length !== 3}>
          <Send className="mr-2 h-4 w-4" />{t("publish")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("basic.title")}</CardTitle>
          <CardDescription>{t("basic.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="questionnaire-name">{t("basic.name")}</Label>
          <Input id="questionnaire-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
        </CardContent>
      </Card>

      {questions.map((question, questionIndex) => (
        <Card key={question.key}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{questionIndex + 1}. {t(`questions.${question.key}`)}</CardTitle>
              <Badge variant="secondary">{question.type === "single_choice" ? t("singleChoice") : t("multipleChoice")}</Badge>
              <Badge variant={question.required ? "default" : "outline"}>{question.required ? t("required") : t("optional")}</Badge>
              <Badge variant="outline" className="font-mono">{question.key}</Badge>
            </div>
            <CardDescription>{t("questionDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("questionTitle")}</Label>
              <Input value={question.title} maxLength={100} onChange={(event) => updateQuestion(questionIndex, { title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("questionHelp")}</Label>
              <Textarea
                value={question.description ?? ""}
                maxLength={200}
                placeholder={t("optional")}
                onChange={(event) => updateQuestion(questionIndex, { description: event.target.value || undefined })}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("options")}</Label>
                <Button variant="outline" size="sm" onClick={() => addOption(questionIndex)} disabled={question.options.length >= 30}>
                  <Plus className="mr-2 h-4 w-4" />{t("addOption")}
                </Button>
              </div>
              {question.options.map((option, optionIndex) => (
                <div key={`${question.key}-${optionIndex}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[minmax(150px,0.8fr)_minmax(180px,1fr)_auto] md:items-center">
                  <Input
                    className="font-mono text-sm"
                    value={option.code}
                    maxLength={64}
                    aria-label={t("optionCodeLabel", { question: t(`questions.${question.key}`) })}
                    onChange={(event) => updateOption(questionIndex, optionIndex, "code", event.target.value)}
                  />
                  <Input
                    value={option.label}
                    maxLength={40}
                    aria-label={t("optionNameLabel", { question: t(`questions.${question.key}`) })}
                    onChange={(event) => updateOption(questionIndex, optionIndex, "label", event.target.value)}
                  />
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => moveOption(questionIndex, optionIndex, -1)} disabled={optionIndex === 0} aria-label={t("moveUp")}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => moveOption(questionIndex, optionIndex, 1)} disabled={optionIndex === question.options.length - 1} aria-label={t("moveDown")}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeOption(questionIndex, optionIndex)} disabled={question.options.length <= 1} aria-label={t("delete")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />{t("history.title")}</CardTitle>
          <CardDescription>{t("history.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>{t("history.version")}</TableHead><TableHead>{t("history.name")}</TableHead><TableHead>{t("history.status")}</TableHead><TableHead>{t("history.publishedAt")}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.versions.map((version) => (
                <TableRow key={version.schemaVersion}>
                  <TableCell className="font-mono">v{version.schemaVersion}</TableCell>
                  <TableCell>{version.name}</TableCell>
                  <TableCell><Badge variant={version.status === "published" ? "default" : "secondary"}>{version.status === "published" ? t("history.current") : t("history.archived")}</Badge></TableCell>
                  <TableCell>{version.publishedAt ? new Date(version.publishedAt).toLocaleString(locale) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.description", { version: data.current.schemaVersion + 1 })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>{t("dialog.cancel")}</Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? t("dialog.publishing") : t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
