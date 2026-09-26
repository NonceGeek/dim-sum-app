"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  COLLECTION_ACTIONS,
  COLLECTION_ROLES,
  ROLE_PRESETS,
  CollectionAction,
  CollectionRole,
} from "@/lib/collection-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
type Activity = { id: string; title: string; displayUuid: string };
export default function SubmissionPermissionsPage() {
  const t = useTranslations("CollectionPermissions");
  const [uid, setUid] = useState("");
  const [user, setUser] = useState<{
    id: string;
    name: string;
    isSystemAdmin: boolean;
    isSuperAdmin: boolean;
  } | null>(null);
  const [role, setRole] = useState<CollectionRole>("ACTIVITY_REVIEWER");
  const [active, setActive] = useState(true);
  const [note, setNote] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [grants, setGrants] = useState<Record<string, CollectionAction[]>>({});
  const [activityId, setActivityId] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setUser(null);
    try {
      const response = await fetch(
        `/api/admin/corpus-collection/submission-permissions?userId=${encodeURIComponent(uid.trim())}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setUser(data.user);
      setActivities(data.activities);
      setActivityId("");
      setRole(
        data.user.collectionOperatorRole?.role_code ?? "ACTIVITY_REVIEWER",
      );
      setActive(data.user.collectionOperatorRole?.active ?? true);
      setNote(data.user.collectionOperatorRole?.note ?? "");
      setGrants(
        Object.fromEntries(
          data.grants
            .filter((g: any) => g.actions.length)
            .map((g: any) => [g.activityId, g.actions]),
        ),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(
        "/api/admin/corpus-collection/submission-permissions",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user!.id,
            role,
            active,
            note,
            grants: Object.entries(grants).map(([activityId, actions]) => ({
              activityId,
              actions,
            })),
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("error"));
    } finally {
      setBusy(false);
    }
  };
  const toggle = (id: string, action: CollectionAction, checked: boolean) =>
    setGrants((old) => {
      const previous = old[id];
      const next = checked
        ? [...new Set([...previous, "view" as const, action])]
        : action === "view"
          ? []
          : previous.filter((a) => a !== action);
      return { ...old, [id]: next };
    });
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t("title")}</h2>
      <p className="text-muted-foreground">{t("description")}</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <Input
          aria-label="UID"
          placeholder="UID"
          value={uid}
          onChange={(e) => {
            setUid(e.target.value);
            setUser(null);
          }}
        />
        <Button disabled={busy || !uid.trim()}>{t("lookup")}</Button>
      </form>
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>{user.name || user.id}</CardTitle>
            <p className="break-all text-sm">UID: {user.id}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {user.isSystemAdmin || user.isSuperAdmin ? (
              <p>{t("adminAll")}</p>
            ) : (
              <>
                <fieldset disabled={busy} className="space-y-4">
                  <label className="flex items-center gap-3">
                    {t("role")}
                    <select
                      className="rounded border bg-background p-2"
                      value={role}
                      onChange={(e) =>
                        setRole(e.target.value as CollectionRole)
                      }
                    >
                      {COLLECTION_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`roles.${r}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t("presetHint")}
                  </p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    {t("active")}
                  </label>
                  {!active && (
                    <p className="text-destructive">{t("revokedHint")}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <select
                      aria-label={t("activity")}
                      className="max-w-full rounded border bg-background p-2"
                      value={activityId}
                      onChange={(e) => setActivityId(e.target.value)}
                    >
                      <option value="">{t("chooseActivity")}</option>
                      {activities
                        .filter((a) => !(a.id in grants))
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.title} · {a.displayUuid}
                          </option>
                        ))}
                    </select>
                    <Button
                      variant="outline"
                      disabled={!activityId}
                      onClick={() => {
                        setGrants({
                          ...grants,
                          [activityId]: [...ROLE_PRESETS[role]],
                        });
                        setActivityId("");
                      }}
                    >
                      {t("add")}
                    </Button>
                  </div>
                  {!Object.keys(grants).length && <p>{t("noActivities")}</p>}
                  {Object.entries(grants).map(([id, actions]) => (
                    <div key={id} className="space-y-3 rounded border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>
                          {activities.find((a) => a.id === id)?.title ?? id} ·
                          ID {id}
                        </strong>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() =>
                              setGrants({
                                ...grants,
                                [id]: [...ROLE_PRESETS[role]],
                              })
                            }
                          >
                            {t("applyPreset")}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() =>
                              setGrants((old) =>
                                Object.fromEntries(
                                  Object.entries(old).filter(
                                    ([key]) => key !== id,
                                  ),
                                ),
                              )
                            }
                          >
                            {t("remove")}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {COLLECTION_ACTIONS.map((action) => (
                          <label
                            key={action}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={actions.includes(action)}
                              onChange={(e) =>
                                toggle(id, action, e.target.checked)
                              }
                            />
                            {t(`actions.${action}`)}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <label className="block space-y-2">
                    <span>{t("note")}</span>
                    <Input
                      value={note}
                      maxLength={1000}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                </fieldset>
                <Button disabled={busy} onClick={save}>
                  {busy ? t("saving") : t("save")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
