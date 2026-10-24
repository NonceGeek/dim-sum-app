"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { UserRound, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ScopeObjectSelect } from "./scope-object-select";
import {
  COLLECTION_ACTIONS,
  ROLE_PRESETS,
  type CollectionRole,
} from "@/lib/collection-permissions";
import type { ScopeType } from "@/lib/admin/policy";
import {
  businessRole,
  managementTypes,
  objectsFor,
  scopeLabel,
  isAlreadyAdmin,
  type PermissionData,
  type PermissionGrant,
  type PermissionChange,
  type PermissionUser,
  type SaveResult,
} from "@/lib/admin/permission-ui";

const actionLabels: Record<string, [string, string]> = {
  view: ["查看", "View"],
  approve: ["通过审核", "Approve"],
  reject: ["拒绝投稿", "Reject"],
  review_needed: ["转人工审核", "Flag for review"],
  feature: ["精选", "Feature"],
  home: ["首页展示", "Home display"],
  ai_review: ["AI 审核", "AI review"],
  award: ["获奖标记", "Award"],
  visibility: ["可见性", "Visibility"],
};
type Tab = "overview" | "administrators" | "operators";
type Confirmation = {
  title: string;
  description: string;
  names: string[];
  changes: PermissionChange[];
};

export function BusinessPermissionsWorkspace({
  data,
  user,
  busy,
  onSave,
}: {
  data: PermissionData;
  user: PermissionUser;
  busy: boolean;
  onSave: (changes: PermissionChange[], note: string) => Promise<SaveResult[]>;
}) {
  const en = useLocale() === "en";
  const t = (zh: string, english: string) => (en ? english : zh);
  const [tab, setTab] = useState<Tab>("overview");
  const types = managementTypes(data);
  const [scopeType, setScopeType] = useState<ScopeType>(types[0] ?? "dataset");
  const type = types.includes(scopeType) ? scopeType : (types[0] ?? "dataset");
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [actionState, setActionState] = useState<Record<string, string[]>>({});
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [results, setResults] = useState<SaveResult[]>([]);
  const isTargetPlatform = !!(user.isSuperAdmin || user.isSystemAdmin);
  const canConfigure =
    !isTargetPlatform && (!user.status || user.status === "ACTIVE");
  const canAdmin = data.isPlatformAdmin && canConfigure;
  const canOperate = types.length > 0 && canConfigure;
  const shownTab =
    (tab === "administrators" && !canAdmin) ||
    (tab === "operators" && !canOperate)
      ? "overview"
      : tab;
  const editorKey = `${shownTab}:${type}`;
  const selectedIds = selections[editorKey] ?? [];
  const note = notes[editorKey] ?? "";
  const actions = actionState[editorKey] ?? [...ROLE_PRESETS.ACTIVITY_REVIEWER];
  const setSelected = (ids: string[]) =>
    setSelections((prev) => ({ ...prev, [editorKey]: ids }));
  const setActions = (next: string[]) =>
    setActionState((prev) => ({ ...prev, [editorKey]: next }));
  const roleActive = data.roles.some(
    (r) => r.role === businessRole(type) && r.active,
  );
  const grants = data.grants.filter((g) => g.scope_type === type);
  const adminGrants = grants.filter((g) => g.role === "ADMIN");
  const operatorGrants = grants.filter((g) => g.role === "OPERATOR");
  const labels = {
    dataset: t("语料集", "Dataset"),
    activity: t("活动", "Activity"),
  };
  const roleName = (kind: ScopeType) =>
    kind === "dataset"
      ? t("语料管理员", "Dataset admin")
      : t("活动管理员", "Activity admin");
  const operatorName = (kind: ScopeType) =>
    kind === "dataset"
      ? t("语料运营", "Dataset operator")
      : t("活动运营", "Activity operator");
  const describeRole = (kind: ScopeType) =>
    kind === "dataset"
      ? t(
          "可以创建语料集，管理本人创建及被授权的语料集，并安排语料运营人员；同时负责贡献审核与入库待办。",
          "Can create datasets, manage datasets they create or are assigned, assign operators, review contributions and handle ingestion leads.",
        )
      : t(
          "可以创建活动，管理本人创建及被授权的活动，并安排活动运营人员。",
          "Can create activities, manage activities they create or are assigned, and assign activity operators.",
        );
  const changeFor = (
    g: PermissionGrant,
    active: boolean,
  ): PermissionChange => ({
    kind: "scope",
    scopeType: g.scope_type,
    scopeId: g.scope_id,
    role: g.role,
    actions: [],
    active,
  });
  const run = async (changes: PermissionChange[]) => {
    const result = await onSave(changes, note);
    setResults(result);
    return result;
  };
  const removeGrant = (grant: PermissionGrant) =>
    setConfirmation({
      title:
        grant.role === "ADMIN"
          ? t("移除这项管理权限？", "Remove this management assignment?")
          : t("撤销这项运营权限？", "Revoke these operating permissions?"),
      description:
        grant.role === "ADMIN"
          ? t(
              "只移除此项管理权限，保留管理员角色、新建能力及其他已授权内容。",
              "Only removes this assignment. The admin role, creation rights and other assignments remain.",
            )
          : t(
              "该用户将不能再运营这项内容，其他授权不受影响。",
              "The user will no longer operate this item. Other permissions remain.",
            ),
      names: [scopeLabel(data, grant.scope_type, grant.scope_id)],
      changes: [changeFor(grant, false)],
    });
  const revokeRole = () =>
    setConfirmation({
      title: t(
        `撤销${roleName(type)}角色？`,
        `Revoke the ${roleName(type)} role?`,
      ),
      description:
        type === "dataset"
          ? t(
              "将失去新建语料集、贡献审核与入库待办处理能力，并撤销所有语料集的管理员权限。当前管理列表如下；单独授予的运营权限和活动管理员权限保留。",
              "Removes dataset creation, contribution review and ingestion capabilities, and every dataset admin assignment. Current assignments are listed below. Separately assigned operator access and activity admin access remain.",
            )
          : t(
              "将失去新建活动的能力，并撤销所有活动的管理员权限。当前管理列表如下；单独授予的运营权限和语料管理员权限保留。",
              "Removes activity creation and every activity admin assignment. Current assignments are listed below. Separately assigned operator access and dataset admin access remain.",
            ),
      names: adminGrants.map((g) => scopeLabel(data, type, g.scope_id)),
      changes: [{ kind: "business", role: businessRole(type), active: false }],
    });
  const saveAssignments = async () => {
    const administrator = shownTab === "administrators";
    const ids = selectedIds.filter((id) => !isAlreadyAdmin(data, type, id));
    const changes: PermissionChange[] = ids.map((id) => ({
      kind: "scope",
      scopeType: type,
      scopeId: id,
      role: administrator ? "ADMIN" : "OPERATOR",
      active: true,
      actions: type === "activity" && !administrator ? actions : [],
    }));
    if (!changes.length) {
      setSelected([]);
      return;
    }
    if (administrator) {
      const upgrade = ids.some((id) =>
        operatorGrants.some((g) => g.scope_id === id),
      );
      setConfirmation({
        title: t("确认分配管理员权限？", "Assign management permissions?"),
        description: upgrade
          ? t(
              "该用户将管理以下内容，其中已有的运营授权会替换为管理员权限。",
              "The user will manage these items. Existing operator assignments will be replaced by admin assignments.",
            )
          : t(
              "该用户将可以管理以下内容，并安排对应的运营人员。",
              "The user will manage these items and may assign their operators.",
            ),
        names: ids.map((id) => scopeLabel(data, type, id)),
        changes,
      });
    } else {
      const result = await run(changes);
      setSelected(
        result
          .filter((r) => !r.ok && r.change.kind === "scope")
          .map((r) => (r.change.kind === "scope" ? r.change.scopeId : "")),
      );
    }
  };
  const grantList = (items: PermissionGrant[], editable = false) =>
    items.length ? (
      <ul className="space-y-2">
        {items.map((g) => (
          <li
            key={`${g.scope_type}:${g.scope_id}`}
            className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="break-words font-medium">
                {scopeLabel(data, g.scope_type, g.scope_id)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {g.role === "ADMIN"
                  ? roleName(g.scope_type)
                  : operatorName(g.scope_type)}
                {g.role === "OPERATOR" &&
                  g.scope_type === "activity" &&
                  ` · ${g.actions.map((a) => (actionLabels[a] ? t(...actionLabels[a]) : a)).join(t("、", ", "))}`}
              </p>
            </div>
            {editable && (
              <div className="flex shrink-0 gap-2">
                {g.role === "OPERATOR" && g.scope_type === "activity" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setSelected([g.scope_id]);
                      setActions(g.actions);
                      setResults([]);
                    }}
                  >
                    {t("调整操作", "Edit actions")}
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => removeGrant(g)}
                >
                  {g.role === "ADMIN"
                    ? t("移除管理权限", "Remove management")
                    : t("撤销运营权限", "Revoke operations")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">
        {t("暂无授权。", "No assignments.")}
      </p>
    );
  const openTab = (next: Tab, nextType?: ScopeType) => {
    setTab(next);
    if (nextType) setScopeType(nextType);
    setResults([]);
  };
  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex items-center gap-3 pt-6">
          {user.image ? (
            <img
              src={user.image}
              alt=""
              className="size-12 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserRound className="size-10 shrink-0 rounded-full bg-muted p-2" />
          )}
          <div className="min-w-0">
            <p className="font-semibold break-words">
              {user.name || t("未设置昵称", "Unnamed user")}
            </p>
            <p className="break-all text-xs text-muted-foreground">
              UID: {user.id}
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto shrink-0">
            {user.isSuperAdmin
              ? t("超级管理员", "Super admin")
              : user.isSystemAdmin
                ? t("平台管理员", "Platform admin")
                : t("普通用户", "User")}
          </Badge>
        </CardContent>
      </Card>
      <Tabs
        value={shownTab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setResults([]);
        }}
      >
        <div className="overflow-x-auto pb-1">
          <TabsList aria-label={t("用户权限设置", "User permissions")}>
            <TabsTrigger value="overview" disabled={busy}>
              {t("用户概况", "User overview")}
            </TabsTrigger>
            {canAdmin && (
              <TabsTrigger value="administrators" disabled={busy}>
                {t("业务管理员管理", "Business admin management")}
              </TabsTrigger>
            )}
            {canOperate && (
              <TabsTrigger value="operators" disabled={busy}>
                {t("运营管理", "Operator management")}
              </TabsTrigger>
            )}
          </TabsList>
        </div>
        <TabsContent value="overview" className="space-y-5 pt-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("基本信息", "Basic information")}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">
                    {t("邮箱", "Email")}
                  </dt>
                  <dd className="mt-1 break-all">
                    {user.emailHint || t("未提供", "Not provided")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("手机号", "Phone")}
                  </dt>
                  <dd className="mt-1">
                    {user.phoneHint || t("未提供", "Not provided")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">
                    {t("账号状态", "Account status")}
                  </dt>
                  <dd className="mt-1">
                    {user.status === "ACTIVE"
                      ? t("正常", "Active")
                      : user.status || t("未提供", "Not provided")}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {isTargetPlatform ? (
            <Card>
              <CardContent className="pt-6 text-sm">
                {t(
                  "该用户拥有全平台管理权限，无需分配业务管理员或运营权限。平台角色仅超级管理员可在「平台管理员管理」中调整。",
                  "This user has platform-wide access and needs no business or operator grants. Only super admins can change platform roles in Platform administrators.",
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("管理员角色", "Administrator roles")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.isPlatformAdmin ? (
                    <>
                      {(["dataset", "activity"] as const).map((kind) => (
                        <div
                          key={kind}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <span>{roleName(kind)}</span>
                          <Badge variant="secondary">
                            {data.roles.some(
                              (r) => r.role === businessRole(kind) && r.active,
                            )
                              ? t("已授予", "Granted")
                              : t("未授予", "Not granted")}
                          </Badge>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => openTab("administrators")}
                      >
                        {t("设置管理员角色", "Set admin roles")}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "仅展示你有权管理的语料集和活动。业务管理员角色由平台管理员配置。",
                        "Only assignments within your management scope are shown. Business roles are managed by platform admins.",
                      )}
                    </p>
                  )}
                </CardContent>
              </Card>
              {(["dataset", "activity"] as const)
                .filter((kind) => data.isPlatformAdmin || types.includes(kind))
                .map((kind) => (
                  <Card key={kind}>
                    <CardHeader>
                      <CardTitle>
                        {kind === "dataset"
                          ? t("已授权的语料集", "Assigned datasets")
                          : t("已授权的活动", "Assigned activities")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {grantList(
                        data.grants.filter((g) => g.scope_type === kind),
                      )}
                      <div className="flex flex-wrap gap-2">
                        {canAdmin && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => openTab("administrators", kind)}
                          >
                            {t("设置管理员权限", "Manage admin assignments")}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => openTab("operators", kind)}
                        >
                          {t("设置运营权限", "Manage operator assignments")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </>
          )}
          {data.isPlatformAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("问卷数据权限", "Questionnaire data access")}
                </CardTitle>
                <CardDescription>
                  {t(
                    "问卷查看、导出单独授权，不随活动管理员角色自动授予。",
                    "Questionnaire view/export permissions are granted separately.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isTargetPlatform ? (
                  <p className="text-sm">
                    {t(
                      "拥有全部活动的问卷查看与导出权限。",
                      "May view and export questionnaire insights for all activities.",
                    )}
                  </p>
                ) : data.questionnaireGrants?.length ? (
                  <ul className="space-y-2 text-sm">
                    {data.questionnaireGrants.map((g) => (
                      <li key={g.activity_id}>
                        {scopeLabel(data, "activity", g.activity_id)} ·{" "}
                        {g.can_view_insights
                          ? t("可查看", "View")
                          : t("不可查看", "No view")}
                        {g.can_export_insights ? t("、可导出", ", export") : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {data.questionnaireGrants
                      ? t("暂无问卷数据授权。", "No questionnaire data grants.")
                      : t(
                          "请到活动问卷权限管理页查看。",
                          "See Questionnaire data permissions.",
                        )}
                  </p>
                )}
                <a
                  className="text-sm text-primary underline underline-offset-4"
                  href={`/${en ? "en" : "zh-CN"}/admin/corpus-collection/questionnaire-permissions`}
                >
                  {t(
                    "前往活动问卷权限管理",
                    "Open Activity Questionnaire Permission Management",
                  )}
                </a>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {(["administrators", "operators"] as const)
          .filter((name) => (name === "administrators" ? canAdmin : canOperate))
          .map((name) => (
            <TabsContent key={name} value={name} className="space-y-5 pt-3">
              <Tabs
                value={type}
                onValueChange={(v) => {
                  setScopeType(v as ScopeType);
                  setResults([]);
                }}
              >
                <TabsList aria-label={t("业务类型", "Content type")}>
                  {types.map((kind) => (
                    <TabsTrigger key={kind} value={kind} disabled={busy}>
                      {labels[kind]}
                    </TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={type} className="space-y-5 pt-3">
                  {name === "administrators" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>{roleName(type)}</CardTitle>
                        <CardDescription>{describeRole(type)}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Badge variant="secondary">
                          {roleActive
                            ? t("已授予角色", "Role granted")
                            : t("尚未授予角色", "Role not granted")}
                        </Badge>
                        {!roleActive && (
                          <p className="text-sm">
                            {t(
                              `先授予${roleName(type)}角色，再分配一个或多个已有${labels[type]}的管理权限。新建的内容会自动获得管理权限。`,
                              `Grant the ${roleName(type)} role first, then assign existing ${type === "dataset" ? "datasets" : "activities"}. New items they create are assigned automatically.`,
                            )}
                          </p>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor={`role-note-${type}`}>
                            {t("授权备注（可选）", "Note (optional)")}
                          </Label>
                          <Textarea
                            id={`role-note-${type}`}
                            maxLength={1000}
                            disabled={busy}
                            value={note}
                            onChange={(e) =>
                              setNotes((prev) => ({
                                ...prev,
                                [editorKey]: e.target.value,
                              }))
                            }
                            placeholder={t(
                              "说明授予或撤销原因",
                              "Reason for granting or revoking",
                            )}
                          />
                        </div>
                        <Button
                          variant={roleActive ? "outline" : "default"}
                          disabled={busy}
                          onClick={() =>
                            roleActive
                              ? revokeRole()
                              : void run([
                                  {
                                    kind: "business",
                                    role: businessRole(type),
                                    active: true,
                                  },
                                ])
                          }
                        >
                          {roleActive
                            ? t(
                                `撤销${roleName(type)}角色`,
                                `Revoke ${roleName(type)} role`,
                              )
                            : t(
                                `授予${roleName(type)}角色`,
                                `Grant ${roleName(type)} role`,
                              )}
                        </Button>
                        <div className="space-y-3">
                          <h3 className="font-medium">
                            {type === "dataset"
                              ? t(
                                  "目前管理的语料集",
                                  "Datasets currently managed",
                                )
                              : t(
                                  "目前管理的活动",
                                  "Activities currently managed",
                                )}
                          </h3>
                          {grantList(adminGrants, true)}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  {(name === "operators" || roleActive) && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {name === "administrators"
                            ? t("分配管理权限", "Assign management permissions")
                            : t("分配运营权限", "Assign operator permissions")}
                        </CardTitle>
                        <CardDescription>
                          {name === "administrators"
                            ? t(
                                "选择一项或多项内容。授予角色不会自动获得所有已有内容的管理权。",
                                "Choose one or more items. An admin role does not automatically grant access to all existing content.",
                              )
                            : type === "dataset"
                              ? t(
                                  "仅在已授权语料集内执行上传、清洗、异常处理、确认入库及内容编辑、审核；不可创建或删除语料集，不可配置人员权限。",
                                  "May operate only within assigned datasets. Cannot create/delete datasets or assign staff permissions.",
                                )
                              : t(
                                  "仅在已授权活动内执行选定的投稿审核及内容运营；不可创建或删除活动，不可配置人员权限。",
                                  "May review submissions and operate content in assigned activities using the selected actions. Cannot create/delete activities or assign staff permissions.",
                                )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="scope-object">
                            {type === "dataset"
                              ? t(
                                  "选择语料集（可多选）",
                                  "Choose datasets (multiple allowed)",
                                )
                              : t(
                                  "选择活动（可多选）",
                                  "Choose activities (multiple allowed)",
                                )}
                          </Label>
                          <ScopeObjectSelect
                            key={`${name}:${type}`}
                            disabled={busy}
                            objects={objectsFor(data, type)}
                            value=""
                            onChange={(id) => {
                              setResults([]);
                              if (
                                !selectedIds.includes(id) &&
                                !isAlreadyAdmin(data, type, id)
                              )
                                setSelected([...selectedIds, id]);
                            }}
                            label={
                              type === "dataset"
                                ? t("选择语料集", "Choose datasets")
                                : t("选择活动", "Choose activities")
                            }
                            placeholder={t("搜索并添加…", "Search and add…")}
                            searchPlaceholder={t(
                              "按名称或编号搜索…",
                              "Search by name or ID…",
                            )}
                            emptyLabel={t(
                              "未找到匹配内容",
                              "No matching items",
                            )}
                            disabledIds={adminGrants.map((g) => g.scope_id)}
                            disabledLabel={
                              name === "operators"
                                ? t(
                                    "已是管理员，包含运营权限，无需重复分配",
                                    "Already an admin; includes operator access",
                                  )
                                : t("已拥有管理权限", "Already assigned")
                            }
                          />
                        </div>
                        {selectedIds.length > 0 && (
                          <ul className="space-y-2">
                            {selectedIds.map((id) => (
                              <li
                                key={id}
                                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                              >
                                <span className="min-w-0 break-words">
                                  {scopeLabel(data, type, id)}
                                </span>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  disabled={busy}
                                  aria-label={t(
                                    `取消选择 ${scopeLabel(data, type, id)}`,
                                    `Remove selection ${scopeLabel(data, type, id)}`,
                                  )}
                                  onClick={() =>
                                    setSelected(
                                      selectedIds.filter((x) => x !== id),
                                    )
                                  }
                                >
                                  <X />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                        {name === "operators" && adminGrants.length > 0 && (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                              {t(
                                `该用户已管理 ${adminGrants.length} 项内容，已包含运营权限，无需重复分配。`,
                                `The user already manages ${adminGrants.length} items and needs no duplicate operator grant.`,
                              )}
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {adminGrants.map((g) => (
                                <li key={g.scope_id}>
                                  {scopeLabel(data, type, g.scope_id)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        {name === "operators" && type === "activity" && (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="activity-preset">
                                {t("运营操作预设", "Operator action preset")}
                              </Label>
                              <Select
                                value={
                                  Object.keys(ROLE_PRESETS).find((r) => {
                                    const preset =
                                      ROLE_PRESETS[r as CollectionRole];
                                    return (
                                      preset.length === actions.length &&
                                      preset.every((a) => actions.includes(a))
                                    );
                                  }) ?? "custom"
                                }
                                onValueChange={(v) =>
                                  setActions([
                                    ...ROLE_PRESETS[v as CollectionRole],
                                  ])
                                }
                                disabled={busy}
                              >
                                <SelectTrigger
                                  id="activity-preset"
                                  className="w-full sm:w-72"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="custom" disabled>
                                    {t("自定义操作", "Custom actions")}
                                  </SelectItem>
                                  {Object.keys(ROLE_PRESETS).map((r) => (
                                    <SelectItem key={r} value={r}>
                                      {r === "ACTIVITY_REVIEWER"
                                        ? t("投稿审核", "Submission review")
                                        : r === "ACTIVITY_OPERATOR"
                                          ? t("内容运营", "Content operations")
                                          : t(
                                              "全部运营操作",
                                              "All operator actions",
                                            )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <fieldset className="space-y-3">
                              <legend className="text-sm font-medium">
                                {t("允许的操作", "Allowed actions")}
                              </legend>
                              <div className="grid gap-3 sm:grid-cols-3">
                                {COLLECTION_ACTIONS.map((a) => (
                                  <div
                                    key={a}
                                    className="flex items-center gap-2"
                                  >
                                    <Checkbox
                                      id={`action-${a}`}
                                      disabled={busy || a === "view"}
                                      checked={actions.includes(a)}
                                      onCheckedChange={(checked) =>
                                        setActions(
                                          checked === true
                                            ? [
                                                ...new Set([
                                                  ...actions,
                                                  "view",
                                                  a,
                                                ]),
                                              ]
                                            : actions.filter((x) => x !== a),
                                        )
                                      }
                                    />
                                    <Label htmlFor={`action-${a}`}>
                                      {t(...actionLabels[a])}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t(
                                  "活动运营必须允许查看。以上操作适用于本次选择的所有活动；保存会替换它们原有的运营操作。",
                                  "Activity operators need view access. These actions apply to all selected activities and replace their previous operator actions.",
                                )}
                              </p>
                            </fieldset>
                          </>
                        )}
                        {name === "operators" && (
                          <div className="space-y-2">
                            <Label htmlFor="operator-note">
                              {t("授权备注（可选）", "Note (optional)")}
                            </Label>
                            <Textarea
                              id="operator-note"
                              maxLength={1000}
                              disabled={busy}
                              value={note}
                              onChange={(e) =>
                                setNotes((prev) => ({
                                  ...prev,
                                  [editorKey]: e.target.value,
                                }))
                              }
                              placeholder={t(
                                "说明授予或撤销原因",
                                "Reason for granting or revoking",
                              )}
                            />
                          </div>
                        )}
                        <Button
                          disabled={busy || !selectedIds.length}
                          onClick={() => void saveAssignments()}
                        >
                          {busy
                            ? t("正在保存…", "Saving…")
                            : name === "administrators"
                              ? t("分配管理员权限", "Assign admin permissions")
                              : t("保存运营权限", "Save operator permissions")}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                  {name === "operators" && (
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          {type === "dataset"
                            ? t(
                                "已授权的语料运营",
                                "Dataset operator assignments",
                              )
                            : t(
                                "已授权的活动运营",
                                "Activity operator assignments",
                              )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {grantList(operatorGrants, true)}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </TabsContent>
          ))}
      </Tabs>
      {results.length > 0 && (
        <div
          role={results.some((r) => !r.ok) ? "alert" : "status"}
          className="space-y-2 rounded-lg border p-4 text-sm"
        >
          <p className="font-medium">
            {t(
              `已成功 ${results.filter((r) => r.ok).length} 项，失败 ${results.filter((r) => !r.ok).length} 项。`,
              `Saved ${results.filter((r) => r.ok).length}; failed ${results.filter((r) => !r.ok).length}.`,
            )}
          </p>
          {results
            .filter((r) => !r.ok)
            .map((r, i) => (
              <p key={i} className="break-words text-destructive">
                {r.change.kind === "scope"
                  ? scopeLabel(data, r.change.scopeType, r.change.scopeId)
                  : t("管理员角色", "Admin role")}
                ：{r.error}
              </p>
            ))}
          {results.some((r) => !r.ok) && (
            <p>
              {t(
                "成功项已生效；失败项仍保留选择，请核对后重试。",
                "Successful changes are active. Failed items remain selected for review and retry.",
              )}
            </p>
          )}
        </div>
      )}
      <AlertDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
      >
        <AlertDialogContent
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation && (
            <>
              <p className="text-sm font-medium">
                {t("用户：", "User: ")}
                {user.name || user.id}
              </p>
              {confirmation.names.length > 0 && (
                <ul className="max-h-52 space-y-2 overflow-y-auto rounded-md bg-muted p-3 text-sm">
                  {confirmation.names.map((name, i) => (
                    <li key={i} className="break-words">
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("取消", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmation) return;
                const changes = confirmation.changes;
                const result = await run(changes);
                if (changes.some((c) => c.kind === "scope" && c.active))
                  setSelected(
                    result
                      .filter((r) => !r.ok && r.change.kind === "scope")
                      .map((r) =>
                        r.change.kind === "scope" ? r.change.scopeId : "",
                      ),
                  );
                setConfirmation(null);
              }}
            >
              {busy
                ? t("正在保存…", "Saving…")
                : confirmation?.changes.some((change) => !change.active)
                  ? t("确认撤销", "Confirm revocation")
                  : t("确认分配", "Confirm assignment")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
