"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CONTRIBUTION_KINDS,
  CONTRIBUTION_MODALITIES,
  CONTRIBUTION_USE_CASES,
  CONTRIBUTOR_TYPES,
  INTENDED_ACCESS_MODES,
  LICENSE_STATUSES,
  PRIVACY_STATUSES,
  RIGHTS_STATUSES,
  SUBMITTER_AUTHORITIES,
  contributionStepSchemas,
} from "@/lib/library/options";

type FormState = {
  contributionKind: (typeof CONTRIBUTION_KINDS)[number];
  contributorType: string;
  contactName: string;
  contactEmail: string;
  organizationName: string;
  contactRole: string;
  region: string;
  otherContact: string;
  datasetName: string;
  shortDescription: string;
  modalities: string[];
  useCase: string;
  scaleDescription: string;
  sourceCollectionMethod: string;
  rightsStatus: string;
  rightsHolder: string;
  submitterAuthority: string;
  intendedAccessMode: string;
  licenseStatus: string;
  licenseNameOrUrl: string;
  privacyStatus: string;
  referenceUrl: string;
  applicantNote: string;
  declarations: { accurate: boolean; authorized: boolean; noAutoPublish: boolean };
  website: string;
};

const INITIAL: FormState = {
  contributionKind: "dataset",
  contributorType: "individual",
  contactName: "",
  contactEmail: "",
  organizationName: "",
  contactRole: "",
  region: "",
  otherContact: "",
  datasetName: "",
  shortDescription: "",
  modalities: [],
  useCase: "",
  scaleDescription: "",
  sourceCollectionMethod: "",
  rightsStatus: "",
  rightsHolder: "",
  submitterAuthority: "",
  intendedAccessMode: "",
  licenseStatus: "",
  licenseNameOrUrl: "",
  privacyStatus: "",
  referenceUrl: "",
  applicantNote: "",
  declarations: { accurate: false, authorized: false, noAutoPublish: false },
  website: "",
};

const STEP_KEYS = ["contact", "overview", "rights", "confirm"] as const;

function Field({
  label,
  required,
  htmlFor,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function ChoiceCard({
  name,
  checked,
  title,
  hint,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
        checked ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <b>{title}</b>
      {hint && <small className="text-muted-foreground">{hint}</small>}
    </label>
  );
}

function Chip({
  type,
  name,
  checked,
  label,
  onChange,
}: {
  type: "radio" | "checkbox";
  name: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
      )}
    >
      <input
        type={type}
        name={name}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}

function NativeSelect({
  id,
  value,
  options,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  options: Array<[string, string]>;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, label]) => (
          <SelectItem key={v} value={v}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ContributionForm({
  onClose,
  onSubmittedChange,
  className,
}: {
  onClose: () => void;
  /** Lets the container switch its title to the submitted state. */
  onSubmittedChange?: (submitted: boolean) => void;
  className?: string;
}) {
  const t = useTranslations("Library.contribute");
  const locale = useLocale();
  const [step, setStep] = useState(0); // 0 intro, 1–4 form steps, 5 success
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [applicationNo, setApplicationNo] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const text = (key: keyof FormState) => ({
    id: `cf-${key}`,
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set(key, e.target.value as never),
  });
  const opt = (group: string, values: readonly string[]) =>
    values.map((v) => [v, t(`options.${group}.${v}`)] as [string, string]);

  const validate = () => {
    if (step < 1 || step > 4) return true;
    const ok = contributionStepSchemas[step - 1].safeParse(form).success;
    setError(ok ? null : t(`validation.${STEP_KEYS[step - 1]}`));
    return ok;
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/contribution-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setApplicationNo(data.applicationNo);
      setStep(5);
      onSubmittedChange?.(true);
    } catch (e) {
      // Keep everything the user typed; only show the error.
      setError(e instanceof Error && e.message ? e.message : t("submitError"));
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (!validate()) return;
    if (step === 4) void submit();
    else setStep((s) => s + 1);
  };
  const reset = () => {
    onSubmittedChange?.(false);
    setForm(INITIAL);
    setApplicationNo(null);
    setError(null);
    setStep(0);
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {step >= 1 && step <= 4 && (
        <ol className="grid grid-cols-4 gap-1 border-b px-4 py-3 text-xs">
          {STEP_KEYS.map((key, i) => (
            <li
              key={key}
              className={cn(
                "border-t-2 pt-1.5",
                i + 1 < step && "border-primary text-primary",
                i + 1 === step && "border-primary font-semibold",
                i + 1 > step && "border-muted text-muted-foreground",
              )}
            >
              {t(`steps.${key}`)}
            </li>
          ))}
        </ol>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {step === 0 && (
          <>
            <p className="text-sm text-muted-foreground">{t("intro.lead")}</p>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <b>{t("intro.noUpload")}</b>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>{t("intro.bullet1")}</li>
                <li>{t("intro.bullet2")}</li>
                <li>{t("intro.bullet3")}</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">{t("intro.kindTitle")}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONTRIBUTION_KINDS.map((kind) => (
                  <ChoiceCard
                    key={kind}
                    name="contributionKind"
                    checked={form.contributionKind === kind}
                    title={t(`intro.kind.${kind}`)}
                    hint={t(`intro.kind.${kind}Hint`)}
                    onSelect={() => set("contributionKind", kind)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">{t("contactStep.hint")}</p>
            <Field label={t("contactStep.contributorType")} required>
              <div className="grid gap-2 sm:grid-cols-2">
                {CONTRIBUTOR_TYPES.map((v) => (
                  <ChoiceCard
                    key={v}
                    name="contributorType"
                    checked={form.contributorType === v}
                    title={t(`options.contributorType.${v}`)}
                    hint={t(`options.contributorType.${v}Hint`)}
                    onSelect={() => set("contributorType", v)}
                  />
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("contactStep.contactName")} required htmlFor="cf-contactName">
                <Input {...text("contactName")} maxLength={100} autoComplete="name" />
              </Field>
              <Field label={t("contactStep.contactEmail")} required htmlFor="cf-contactEmail">
                <Input {...text("contactEmail")} type="email" maxLength={200} autoComplete="email" />
              </Field>
              <Field label={t("contactStep.organizationName")} required htmlFor="cf-organizationName">
                <Input {...text("organizationName")} maxLength={200} placeholder={t("contactStep.organizationPlaceholder")} />
              </Field>
              <Field label={t("contactStep.contactRole")} htmlFor="cf-contactRole">
                <Input {...text("contactRole")} maxLength={100} />
              </Field>
              <Field label={t("contactStep.region")} htmlFor="cf-region">
                <Input {...text("region")} maxLength={100} />
              </Field>
              <Field label={t("contactStep.otherContact")} htmlFor="cf-otherContact">
                <Input {...text("otherContact")} maxLength={200} placeholder={t("contactStep.otherContactPlaceholder")} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground">{t("overviewStep.hint")}</p>
            <Field label={t("overviewStep.datasetName")} required htmlFor="cf-datasetName">
              <Input {...text("datasetName")} maxLength={200} placeholder={t("overviewStep.datasetNamePlaceholder")} />
            </Field>
            <Field label={t("overviewStep.shortDescription")} required htmlFor="cf-shortDescription">
              <Input {...text("shortDescription")} maxLength={140} placeholder={t("overviewStep.shortDescriptionPlaceholder")} />
            </Field>
            <Field label={t("overviewStep.modalities")} required>
              <div className="flex flex-wrap gap-2">
                {CONTRIBUTION_MODALITIES.map((v) => (
                  <Chip
                    key={v}
                    type="checkbox"
                    name="modalities"
                    checked={form.modalities.includes(v)}
                    label={t(`options.modality.${v}`)}
                    onChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        modalities: checked
                          ? [...new Set([...f.modalities, v])]
                          : f.modalities.filter((m) => m !== v),
                      }))
                    }
                  />
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("overviewStep.useCase")} required htmlFor="cf-useCase">
                <NativeSelect
                  id="cf-useCase"
                  value={form.useCase}
                  placeholder={t("choose")}
                  options={opt("useCase", CONTRIBUTION_USE_CASES)}
                  onChange={(v) => set("useCase", v)}
                />
              </Field>
              <Field label={t("overviewStep.scaleDescription")} required htmlFor="cf-scaleDescription">
                <Input {...text("scaleDescription")} maxLength={200} placeholder={t("overviewStep.scalePlaceholder")} />
              </Field>
            </div>
            <Field label={t("overviewStep.sourceCollectionMethod")} required htmlFor="cf-sourceCollectionMethod">
              <Textarea {...text("sourceCollectionMethod")} rows={4} maxLength={2000} placeholder={t("overviewStep.sourcePlaceholder")} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <p className="text-sm text-muted-foreground">{t("rightsStep.hint")}</p>
            <Field label={t("rightsStep.rightsStatus")} required>
              <div className="grid gap-2 sm:grid-cols-2">
                {RIGHTS_STATUSES.map((v) => (
                  <ChoiceCard
                    key={v}
                    name="rightsStatus"
                    checked={form.rightsStatus === v}
                    title={t(`options.rightsStatus.${v}`)}
                    hint={t(`options.rightsStatus.${v}Hint`)}
                    onSelect={() => set("rightsStatus", v)}
                  />
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("rightsStep.rightsHolder")} required htmlFor="cf-rightsHolder">
                <Input {...text("rightsHolder")} maxLength={200} placeholder={t("rightsStep.rightsHolderPlaceholder")} />
              </Field>
              <Field label={t("rightsStep.submitterAuthority")} required htmlFor="cf-submitterAuthority">
                <NativeSelect
                  id="cf-submitterAuthority"
                  value={form.submitterAuthority}
                  placeholder={t("choose")}
                  options={opt("submitterAuthority", SUBMITTER_AUTHORITIES)}
                  onChange={(v) => set("submitterAuthority", v)}
                />
              </Field>
            </div>
            <Field label={t("rightsStep.intendedAccessMode")} required>
              <div className="flex flex-wrap gap-2">
                {INTENDED_ACCESS_MODES.map((v) => (
                  <Chip
                    key={v}
                    type="radio"
                    name="intendedAccessMode"
                    checked={form.intendedAccessMode === v}
                    label={t(`options.intendedAccessMode.${v}`)}
                    onChange={() => set("intendedAccessMode", v)}
                  />
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("rightsStep.licenseStatus")} required htmlFor="cf-licenseStatus">
                <NativeSelect
                  id="cf-licenseStatus"
                  value={form.licenseStatus}
                  placeholder={t("choose")}
                  options={opt("licenseStatus", LICENSE_STATUSES)}
                  onChange={(v) => set("licenseStatus", v)}
                />
              </Field>
              <Field label={t("rightsStep.licenseNameOrUrl")} htmlFor="cf-licenseNameOrUrl">
                <Input {...text("licenseNameOrUrl")} maxLength={500} placeholder={t("rightsStep.licensePlaceholder")} />
              </Field>
            </div>
            <Field label={t("rightsStep.privacyStatus")} required>
              <div className="flex flex-wrap gap-2">
                {PRIVACY_STATUSES.map((v) => (
                  <Chip
                    key={v}
                    type="radio"
                    name="privacyStatus"
                    checked={form.privacyStatus === v}
                    label={t(`options.privacyStatus.${v}`)}
                    onChange={() => set("privacyStatus", v)}
                  />
                ))}
              </div>
            </Field>
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t("rightsStep.notice")}
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <p className="text-sm text-muted-foreground">{t("confirmStep.hint")}</p>
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <b>{form.datasetName}</b>
              <p className="text-muted-foreground">
                {[
                  form.modalities.map((m) => t(`options.modality.${m}`)).join(" / "),
                  form.useCase && t(`options.useCase.${form.useCase}`),
                  form.scaleDescription,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-primary">
                {t("confirmStep.rightsSummary", {
                  rights: form.rightsStatus ? t(`options.rightsStatus.${form.rightsStatus}`) : "—",
                  access: form.intendedAccessMode
                    ? t(`options.intendedAccessMode.${form.intendedAccessMode}`)
                    : "—",
                })}
              </p>
            </div>
            <Field label={t("confirmStep.referenceUrl")} htmlFor="cf-referenceUrl">
              <Input {...text("referenceUrl")} maxLength={1000} placeholder={t("confirmStep.referencePlaceholder")} />
            </Field>
            <Field label={t("confirmStep.applicantNote")} htmlFor="cf-applicantNote">
              <Textarea {...text("applicantNote")} rows={3} maxLength={2000} placeholder={t("confirmStep.notePlaceholder")} />
            </Field>
            <div className="space-y-2">
              {(["accurate", "authorized", "noAutoPublish"] as const).map((key) => (
                <label key={key} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={form.declarations[key]}
                    onCheckedChange={(checked) =>
                      setForm((f) => ({
                        ...f,
                        declarations: { ...f.declarations, [key]: checked === true },
                      }))
                    }
                  />
                  <span>{t(`confirmStep.declarations.${key}`)}</span>
                </label>
              ))}
            </div>
            <input
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
              {...text("website")}
            />
          </>
        )}

        {step === 5 && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <p className="text-muted-foreground">{t("success.thanks")}</p>
            {applicationNo && (
              <div>
                <p className="text-xs text-muted-foreground">{t("success.applicationNo")}</p>
                <p className="font-mono text-xl font-semibold">{applicationNo}</p>
              </div>
            )}
            <p className="text-sm font-medium">{t("success.status")}</p>
            <div className="space-y-1 rounded-lg border bg-muted/40 p-4 text-left text-sm">
              <p className="font-medium">{t("success.nextTitle")}</p>
              <p>1. {t("success.next1")}</p>
              <p>2. {t("success.next2", { email: form.contactEmail })}</p>
              <p>3. {t("success.next3")}</p>
            </div>
            <p className="text-xs text-muted-foreground">{t("success.notice")}</p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex justify-between gap-2 border-t p-4">
        {step === 0 && (
          <>
            <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button onClick={() => setStep(1)}>{t("start")}</Button>
          </>
        )}
        {step >= 1 && step <= 4 && (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setError(null);
                setStep((s) => s - 1);
              }}
            >
              {t("prev")}
            </Button>
            <Button onClick={next} disabled={busy}>
              {step === 4 ? (busy ? t("submitting") : t("submit")) : t("next")}
            </Button>
          </>
        )}
        {step === 5 && (
          <>
            <Button variant="outline" onClick={onClose}>{t("success.back")}</Button>
            <Button onClick={reset}>{t("success.another")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
