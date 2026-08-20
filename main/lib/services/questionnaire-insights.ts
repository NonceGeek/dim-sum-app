import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CorpusCollectionAccess } from "@/lib/services/corpus-collection-access";
import { assertActivityAccess } from "@/lib/services/corpus-collection-access";
import { AGE_OPTIONS, CULTURE_REGION_OPTIONS, INTEREST_TYPE_OPTIONS } from "@/lib/services/questionnaire-schema";

const MIN_SAMPLE = 10;

type InsightsFilters = {
  dateStart: Date;
  dateEnd: Date;
  activityId: bigint | null;
  submissionStatus: "all" | "submitted" | "not_submitted";
  registrationType: "all" | "first_time" | "reused";
};

const labelMaps = {
  age: new Map(AGE_OPTIONS),
  region: new Map(CULTURE_REGION_OPTIONS),
  interest: new Map(INTEREST_TYPE_OPTIONS),
};

export function parseInsightsFilters(url: URL, access: CorpusCollectionAccess): InsightsFilters {
  const now = new Date();
  const defaultStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const dateStart = url.searchParams.get("dateStart") ? new Date(url.searchParams.get("dateStart")!) : defaultStart;
  const dateEnd = url.searchParams.get("dateEnd") ? new Date(url.searchParams.get("dateEnd")!) : now;
  if (
    Number.isNaN(dateStart.getTime()) ||
    Number.isNaN(dateEnd.getTime()) ||
    dateStart > dateEnd ||
    dateEnd.getTime() - dateStart.getTime() > 365 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("INVALID_DATE_RANGE");
  }
  const activityValue = url.searchParams.get("activityId");
  const activityId = activityValue && /^\d+$/.test(activityValue) ? BigInt(activityValue) : null;
  assertActivityAccess(access, activityId);
  const submissionStatus = url.searchParams.get("submissionStatus") ?? "all";
  const registrationType = url.searchParams.get("registrationType") ?? "all";
  if (!["all", "submitted", "not_submitted"].includes(submissionStatus)) throw new Error("INVALID_FILTER");
  if (!["all", "first_time", "reused"].includes(registrationType)) throw new Error("INVALID_FILTER");
  return {
    dateStart,
    dateEnd,
    activityId,
    submissionStatus: submissionStatus as InsightsFilters["submissionStatus"],
    registrationType: registrationType as InsightsFilters["registrationType"],
  };
}

function percent(numerator: number, denominator: number) {
  return denominator ? Math.round((numerator / denominator) * 1000) / 10 : 0;
}

function uniqueUsers(rows: Array<{ user_id: string }>) {
  return new Set(rows.map((row) => row.user_id)).size;
}

function dimensionRows(
  values: string[],
  labels: Map<string, string>,
  submittedUsers: Set<string>,
  usersByValue: Map<string, Set<string>>,
) {
  return values.map((value) => {
    const users = usersByValue.get(value) ?? new Set<string>();
    const submitted = [...users].filter((userId) => submittedUsers.has(userId)).length;
    return {
      code: value,
      label: labels.get(value) ?? value,
      count: users.size,
      submittedCount: users.size < MIN_SAMPLE ? null : submitted,
      submissionRate: users.size < MIN_SAMPLE ? null : percent(submitted, users.size),
      suppressed: users.size < MIN_SAMPLE,
    };
  }).sort((a, b) => b.count - a.count);
}

export async function getQuestionnaireOverview(
  access: CorpusCollectionAccess,
  filters: InsightsFilters,
) {
  const allowedActivityIds = filters.activityId
    ? [filters.activityId]
    : access.activityIds ?? undefined;
  const where: Prisma.corpus_collection_questionnaire_journeysWhereInput = {
    started_at: { gte: filters.dateStart, lte: filters.dateEnd },
    activity_id: allowedActivityIds ? { in: allowedActivityIds } : undefined,
    registration_type: filters.registrationType === "all" ? undefined : filters.registrationType,
    status:
      filters.submissionStatus === "submitted"
        ? "submitted"
        : filters.submissionStatus === "not_submitted"
          ? { not: "submitted" }
          : undefined,
  };
  const [journeys, availableActivities] = await Promise.all([
    prisma.corpus_collection_questionnaire_journeys.findMany({
      where,
      include: {
        events: { select: { event_name: true } },
        activity: { select: { id: true, title: true, tags: true, status: true, starts_at: true, ends_at: true, created_at: true } },
      },
    }),
    prisma.corpus_collection_activities.findMany({
      where: access.activityIds ? { id: { in: access.activityIds } } : undefined,
      select: { id: true, title: true },
      orderBy: { created_at: "desc" },
    }),
  ]);
  const userIds = [...new Set(journeys.map((journey) => journey.user_id))];
  const profiles = userIds.length
    ? await prisma.corpus_collection_questionnaire_profiles.findMany({
        where: { user_id: { in: userIds } },
        select: { user_id: true, age_range: true, culture_region: true, interest_types: true },
      })
    : [];

  const submittedUsers = new Set(journeys.filter((journey) => journey.status === "submitted").map((journey) => journey.user_id));
  const completedFirstTime = journeys.filter(
    (journey) => journey.flow_type === "full_questionnaire" && Boolean(journey.completed_at),
  );
  const entered = journeys.filter((journey) => Boolean(journey.entered_submission_at));
  const reusedEntered = entered.filter((journey) => journey.flow_type === "reused");
  const completedRegistrations = uniqueUsers(completedFirstTime);
  const submittedAfterRegistration = new Set(
    completedFirstTime.filter((journey) => journey.status === "submitted").map((journey) => journey.user_id),
  ).size;

  const eventCount = (rows: typeof journeys, eventName: string) =>
    uniqueUsers(rows.filter((journey) => journey.events.some((event) => event.event_name === eventName)));
  const firstTime = journeys.filter((journey) => journey.flow_type === "full_questionnaire");
  const reused = journeys.filter((journey) => journey.registration_type === "reused");
  const funnels = {
    firstTime: [
      { key: "click_submit_cta", label: "点击“我要投稿”", count: eventCount(firstTime, "click_submit_cta") },
      { key: "open_questionnaire", label: "访问问卷弹窗", count: eventCount(firstTime, "open_questionnaire") },
      { key: "complete_questionnaire", label: "完成问卷", count: eventCount(firstTime, "complete_questionnaire") },
      { key: "enter_submission_page", label: "进入投稿页", count: eventCount(firstTime, "enter_submission_page") },
      { key: "submit_submission_success", label: "成功提交作品", count: eventCount(firstTime, "submit_submission_success") },
    ],
    reused: [
      { key: "click_submit_cta", label: "点击“我要投稿”", count: eventCount(reused, "click_submit_cta") },
      { key: "enter_submission_page", label: "复用资料进入投稿页", count: eventCount(reused, "enter_submission_page") },
      { key: "submit_submission_success", label: "成功提交作品", count: eventCount(reused, "submit_submission_success") },
    ],
  };

  const ageUsers = new Map<string, Set<string>>();
  const regionUsers = new Map<string, Set<string>>();
  const interestUsers = new Map<string, Set<string>>();
  for (const profile of profiles) {
    if (!ageUsers.has(profile.age_range)) ageUsers.set(profile.age_range, new Set());
    ageUsers.get(profile.age_range)!.add(profile.user_id);
    if (!regionUsers.has(profile.culture_region)) regionUsers.set(profile.culture_region, new Set());
    regionUsers.get(profile.culture_region)!.add(profile.user_id);
    const interests = Array.isArray(profile.interest_types) ? profile.interest_types : [];
    for (const interest of interests) {
      if (typeof interest !== "string") continue;
      if (!interestUsers.has(interest)) interestUsers.set(interest, new Set());
      interestUsers.get(interest)!.add(profile.user_id);
    }
  }

  const activityMap = new Map<string, typeof journeys>();
  for (const journey of journeys) {
    const key = journey.activity_id.toString();
    activityMap.set(key, [...(activityMap.get(key) ?? []), journey]);
  }
  const activities = [...activityMap.values()].map((rows) => {
    const activity = rows[0].activity;
    const registeredUsers = new Set(rows.filter((row) => Boolean(row.completed_at)).map((row) => row.user_id));
    const submitted = new Set(rows.filter((row) => row.status === "submitted").map((row) => row.user_id)).size;
    const profileRows = profiles.filter((profile) => registeredUsers.has(profile.user_id));
    const ageCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    profileRows.forEach((profile) => {
      ageCounts.set(profile.age_range, (ageCounts.get(profile.age_range) ?? 0) + 1);
      regionCounts.set(profile.culture_region, (regionCounts.get(profile.culture_region) ?? 0) + 1);
    });
    const top = (counts: Map<string, number>, labels: Map<string, string>) => {
      const code = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      return code ? labels.get(code) ?? code : "—";
    };
    return {
      id: activity.id.toString(),
      title: activity.title,
      status: activity.status,
      registrationCount: registeredUsers.size,
      submissionRate: registeredUsers.size < MIN_SAMPLE ? null : percent(submitted, registeredUsers.size),
      suppressed: registeredUsers.size < MIN_SAMPLE,
      topAgeRange: top(ageCounts, labelMaps.age),
      topCultureRegion: top(regionCounts, labelMaps.region),
      activityTag: Array.isArray(activity.tags) && typeof activity.tags[0] === "string" ? activity.tags[0] : "—",
    };
  }).sort((a, b) => (b.submissionRate ?? -1) - (a.submissionRate ?? -1));

  return {
    filters: {
      dateStart: filters.dateStart.toISOString(),
      dateEnd: filters.dateEnd.toISOString(),
      activityId: filters.activityId?.toString() ?? null,
      submissionStatus: filters.submissionStatus,
      registrationType: filters.registrationType,
    },
    kpis: {
      completedRegistrations,
      postRegistrationSubmissionRate: percent(submittedAfterRegistration, completedRegistrations),
      profileReuseRate: percent(uniqueUsers(reusedEntered), uniqueUsers(entered)),
    },
    availableActivities: availableActivities.map((activity) => ({
      id: activity.id.toString(),
      title: activity.title,
    })),
    funnels,
    profile: {
      ageRanges: dimensionRows(AGE_OPTIONS.map(([code]) => code), labelMaps.age, submittedUsers, ageUsers),
      cultureRegions: dimensionRows(CULTURE_REGION_OPTIONS.map(([code]) => code), labelMaps.region, submittedUsers, regionUsers),
      interestTypes: dimensionRows(INTEREST_TYPE_OPTIONS.map(([code]) => code), labelMaps.interest, submittedUsers, interestUsers),
    },
    activities,
    privacy: { minimumSampleSize: MIN_SAMPLE },
  };
}
