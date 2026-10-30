import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeQuery } from "./events";

type Row = Prisma.analytics_eventsCreateManyInput;

/** Splits validated props into indexed columns and the remaining JSON. */
export function toRow(
  name: string,
  props: Record<string, unknown>,
  base: Omit<Row, "event_name" | "properties">,
): Row {
  const {
    entryId,
    section,
    query,
    mediaType,
    contentAttribute,
    ...rest
  } = props as Record<string, unknown>;
  return {
    ...base,
    event_name: name,
    entry_id: typeof entryId === "string" ? entryId : null,
    section: typeof section === "string" ? section : null,
    query: typeof query === "string" ? normalizeQuery(query) : null,
    media_type: typeof mediaType === "string" && mediaType ? mediaType : null,
    content_attribute:
      typeof contentAttribute === "string" ? contentAttribute : null,
    properties: rest as Prisma.InputJsonValue,
  };
}

/** Server-side events never block or fail the request that produced them. */
export async function recordServerEvent(
  name: "search_request",
  props: Record<string, unknown>,
) {
  try {
    await prisma.analytics_events.create({
      data: toRow(name, props, { source: "server" }),
    });
  } catch (error) {
    console.warn("analytics: failed to record server event", error);
  }
}
