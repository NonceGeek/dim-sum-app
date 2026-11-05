import { z } from "zod";

/** Public dataset vocabularies. Labels live in messages under Library.options. */
export const DATASET_MODALITIES = [
  "text",
  "audio",
  "image_video",
  "multimodal",
] as const;
export const DATASET_USE_CASES = [
  "training",
  "safety_eval",
  "asr_tts",
  "culture_research",
] as const;
/** There is intentionally no download mode. */
export const DATASET_ACCESS_MODES = [
  "metadata_only",
  "request_access",
  "external",
] as const;
export const DATASET_QUALITY_FLAGS = ["official", "verified"] as const;
export const DATASET_SORTS = ["relevance", "newest"] as const;

export type DatasetModality = (typeof DATASET_MODALITIES)[number];
export type DatasetUseCase = (typeof DATASET_USE_CASES)[number];
export type DatasetAccessMode = (typeof DATASET_ACCESS_MODES)[number];
export type DatasetQualityFlag = (typeof DATASET_QUALITY_FLAGS)[number];
export type DatasetSort = (typeof DATASET_SORTS)[number];

/** Contribution form vocabularies (PRD step 1–3). */
export const CONTRIBUTION_KINDS = ["dataset", "partnership"] as const;
export const CONTRIBUTOR_TYPES = [
  "individual",
  "research",
  "enterprise",
  "cultural_rights_holder",
] as const;
export const CONTRIBUTION_MODALITIES = [
  "text",
  "audio",
  "image",
  "video",
  "multimodal",
  "dictionary",
] as const;
export const CONTRIBUTION_USE_CASES = [
  "training",
  "asr_tts",
  "safety_eval",
  "retrieval",
  "linguistics",
  "culture",
  "other",
] as const;
export const RIGHTS_STATUSES = [
  "full_rights",
  "written_authorization",
  "partially_pending",
  "uncertain",
] as const;
export const SUBMITTER_AUTHORITIES = [
  "rights_holder",
  "authorized_representative",
  "member_pending_authorization",
  "other",
] as const;
export const INTENDED_ACCESS_MODES = [
  "controlled",
  "after_review",
  "metadata_only",
  "to_discuss",
] as const;
export const LICENSE_STATUSES = [
  "has_license",
  "platform_template",
  "custom_agreement",
  "undecided",
] as const;
export const PRIVACY_STATUSES = [
  "no_personal_info",
  "deidentified",
  "may_contain",
  "uncertain",
] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

/** Shared by the client form and POST /api/public/contribution-applications. */
export const contributionStepSchemas = [
  z.object({
    contributorType: z.enum(CONTRIBUTOR_TYPES),
    contactName: text(100),
    contactEmail: z.string().trim().email().max(200),
    organizationName: text(200),
    contactRole: optionalText(100),
    region: optionalText(100),
    otherContact: optionalText(200),
  }),
  z.object({
    datasetName: text(200),
    shortDescription: text(140),
    modalities: z.array(z.enum(CONTRIBUTION_MODALITIES)).min(1).max(6),
    useCase: z.enum(CONTRIBUTION_USE_CASES),
    scaleDescription: text(200),
    sourceCollectionMethod: text(2000),
  }),
  z.object({
    rightsStatus: z.enum(RIGHTS_STATUSES),
    rightsHolder: text(200),
    submitterAuthority: z.enum(SUBMITTER_AUTHORITIES),
    intendedAccessMode: z.enum(INTENDED_ACCESS_MODES),
    licenseStatus: z.enum(LICENSE_STATUSES),
    licenseNameOrUrl: optionalText(500),
    privacyStatus: z.enum(PRIVACY_STATUSES),
  }),
  z.object({
    referenceUrl: optionalText(1000),
    applicantNote: optionalText(2000),
    declarations: z.object({
      accurate: z.literal(true),
      authorized: z.literal(true),
      noAutoPublish: z.literal(true),
    }),
  }),
] as const;

export const contributionApplicationSchema = z
  .object({
    contributionKind: z.enum(CONTRIBUTION_KINDS),
    locale: optionalText(10),
    // Honeypot: real users never see or fill this field.
    website: z.string().max(200).optional(),
  })
  .merge(contributionStepSchemas[0])
  .merge(contributionStepSchemas[1])
  .merge(contributionStepSchemas[2])
  .merge(contributionStepSchemas[3]);
export type ContributionApplicationInput = z.infer<
  typeof contributionApplicationSchema
>;

export const DATASET_CONTACT_REQUEST_TYPES = ["access_request", "contact"] as const;
export const datasetContactRequestSchema = z.object({
  datasetSlug: text(200),
  requestType: z.enum(DATASET_CONTACT_REQUEST_TYPES),
  contactName: text(100),
  contactEmail: z.string().trim().email().max(200),
  organizationName: optionalText(200),
  message: text(2000),
  website: z.string().max(200).optional(),
});
export type DatasetContactRequestInput = z.infer<
  typeof datasetContactRequestSchema
>;
