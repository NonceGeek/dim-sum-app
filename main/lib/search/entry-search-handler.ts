import { NextRequest, NextResponse, after } from "next/server";
import { recordServerEvent } from "@/lib/analytics/server";
import { publicApi } from "@/lib/auth";
import { databaseErrorResponse, isPrismaStatementTimeout, isPrismaTransientDatabaseError } from "@/lib/prisma-errors";
import { getQueryEmbeddingText } from "@/lib/search/query-embedding";
import type { EntrySearchResponse } from "@/lib/search/entry-identity";
import {
  SEARCH_CACHE_HEADERS, SEARCH_NO_STORE_HEADERS,
  type AggregatedSearchRow, type EntrySearchSection, type SemanticPart,
  parseDatasets, parseContentAttribute, parseMediaType, parseCursor,
  buildResponse, fetchPrimarySearchRows, fetchAggregatedSearchRows, fetchSemanticSearchRows,
} from "@/lib/search/entry-search";

type SemanticReason =
  | "embedding_failed"
  | "semantic_failed"
  | "statement_timeout_similar_only"
  | "transient_db_error"
  | "fallback_failed";

export async function handleEntrySearch(req: NextRequest, analytics: { app?: "search-app"; requestId?: string; recordWebSearch?: boolean } = {}) {
  const startedAt = performance.now();
  return publicApi(req, async () => {
    const { searchParams } = new URL(req.url);
    const query = (searchParams.get("q") ?? "").trim();
    const datasets = parseDatasets(searchParams.get("dataset"));
    const contentAttribute = parseContentAttribute(
      searchParams.get("contentAttribute"),
    );
    if (contentAttribute === "invalid") {
      return NextResponse.json(
        { error: "Invalid contentAttribute; expected oral or cultural_knowledge" },
        { status: 400 },
      );
    }
    const mediaType = parseMediaType(searchParams.get("mediaType"));
    if (mediaType === "invalid") {
      return NextResponse.json(
        {
          error:
            "Invalid mediaType; expected text, audio, video, image, or model3d",
        },
        { status: 400 },
      );
    }
    const sectionParam = searchParams.get("section");
    const section: EntrySearchSection =
      sectionParam === "primary" || sectionParam === "semantic"
        ? sectionParam
        : "all";
    const semanticPartParam = searchParams.get("semanticPart");
    const semanticPart: SemanticPart =
      semanticPartParam === "similar" || semanticPartParam === "recommended"
        ? semanticPartParam
        : "all";
    const primaryCorpusIdParam = searchParams.get("primaryCorpusId");
    let primaryCorpusId: bigint | null | undefined;
    if (primaryCorpusIdParam === "none") {
      primaryCorpusId = null;
    } else if (primaryCorpusIdParam !== null) {
      if (!/^[1-9]\d*$/.test(primaryCorpusIdParam)) {
        return NextResponse.json(
          { error: "Invalid primaryCorpusId" },
          { status: 400 },
        );
      }
      primaryCorpusId = BigInt(primaryCorpusIdParam);
    }
    const similarOffset = parseCursor(searchParams.get("similarCursor"));
    const recommendedOffset = parseCursor(searchParams.get("recommendedCursor"));

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: q" },
        { status: 400 },
      );
    }

    /** Logs one search_request after the response is sent; never delays users. */
    const logSearch = (
      response: EntrySearchResponse | null,
      extra: { semanticReason?: SemanticReason; error?: string } = {},
    ) => {
      if (!analytics.app && analytics.recordWebSearch === false) return;
      const latencyMs = Math.round(performance.now() - startedAt);
      after(() =>
        recordServerEvent("search_request", {
          ...(analytics.app ? { app: analytics.app, requestId: analytics.requestId } : {}),
          query,
          // primary | semantic | all — the API request section, not a result section.
          section,
          mediaType: mediaType ?? undefined,
          contentAttribute: contentAttribute ?? undefined,
          semanticPart,
          latencyMs,
          // Semantic-only requests carry no primary section.
          primaryCount: response && section !== "semantic" ? (response.primary ? 1 : 0) : null,
          similarCount: response?.similar.length ?? null,
          recommendedCount: response?.recommended.length ?? null,
          semanticStatus: response?.sectionStatus.semantic ?? null,
          paged: Boolean(similarOffset || recommendedOffset) || (analytics.app === "search-app" && section !== "all"),
          ...(analytics.app === "search-app" && response?.sectionStatus?.semantic === "error" ? { error: "semantic_failed" } : {}),
          ...extra,
        }),
      );
    };

    const fetchSemantic = async (): Promise<{
      rows: AggregatedSearchRow[];
      status: EntrySearchResponse["sectionStatus"]["semantic"];
      reason?: SemanticReason;
    }> => {
      const filterRows = (rows: AggregatedSearchRow[]) =>
        rows.filter(
          (row) => semanticPart === "all" || row.section === semanticPart,
        );
      const fetchFallback = async () => {
        const fallbackRows = await fetchAggregatedSearchRows({
          query,
          similarOffset,
          recommendedOffset,
          contentAttribute,
          mediaType,
        });
        return {
          rows: filterRows(
            fallbackRows.filter((row) => row.section !== "primary"),
          ),
          status: "fallback" as const,
          reason: (queryEmbeddingText ? "semantic_failed" : "embedding_failed") as SemanticReason,
        };
      };

      let queryEmbeddingText: string | null = null;
      try {
        queryEmbeddingText = await getQueryEmbeddingText(query);
      } catch (error) {
        console.error("Query embedding failed; using search fallback:", error);
      }

      if (queryEmbeddingText) {
        try {
          const rows = await fetchSemanticSearchRows({
            query,
            queryEmbeddingText,
            primaryCorpusId,
            similarOffset,
            recommendedOffset,
            semanticPart,
            contentAttribute,
            mediaType,
          });

          return {
            rows: filterRows(rows),
            status: "success",
          };
        } catch (error) {
          console.error("Semantic entry search failed:", error);
          if (isPrismaStatementTimeout(error) && semanticPart === "all") {
            try {
              const similarRows = await fetchSemanticSearchRows({
                query,
                queryEmbeddingText,
                primaryCorpusId,
                similarOffset,
                recommendedOffset,
                semanticPart: "similar",
                contentAttribute,
                mediaType,
              });
              return {
                rows: similarRows,
                status: "fallback",
                reason: "statement_timeout_similar_only",
              };
            } catch (similarError) {
              console.error("Similar-only semantic fallback failed:", similarError);
            }
          }
          if (isPrismaTransientDatabaseError(error)) {
            return { rows: [], status: "error", reason: "transient_db_error" };
          }
        }
      }

      try {
        return await fetchFallback();
      } catch (error) {
        console.error("Entry search fallback failed:", error);
        if (isPrismaTransientDatabaseError(error)) {
          return { rows: [], status: "error", reason: "fallback_failed" };
        }
        throw error;
      }
    };

    if (section === "primary") {
      try {
        const primaryRows = await fetchPrimarySearchRows(
          query,
          datasets,
          contentAttribute,
        );
        const response = buildResponse({
          query,
          primaryRows,
          similarOffset,
          recommendedOffset,
          semanticStatus: "idle",
        });
        logSearch(response);
        return NextResponse.json(response, { headers: SEARCH_CACHE_HEADERS });
      } catch (error) {
        logSearch(null, { error: "primary_failed" });
        console.error("Primary entry search failed:", error);
        return databaseErrorResponse(error, "Entry primary search failed");
      }
    }

    if (section === "semantic") {
      const semantic = await fetchSemantic();
      const response = buildResponse({
        query,
        semanticRows: semantic.rows,
        similarOffset,
        recommendedOffset,
        semanticStatus: semantic.status,
      });
      logSearch(response, { semanticReason: semantic.reason });
      return NextResponse.json(
        response,
        {
          headers:
            semantic.status === "error"
              ? SEARCH_NO_STORE_HEADERS
              : SEARCH_CACHE_HEADERS,
        },
      );
    }

    const [primaryRows, semantic] = await Promise.all([
      fetchPrimarySearchRows(query, datasets, contentAttribute),
      fetchSemantic(),
    ]);

    const response = buildResponse({
      query,
      primaryRows,
      semanticRows: semantic.rows,
      similarOffset,
      recommendedOffset,
      semanticStatus: semantic.status,
    });
    logSearch(response, { semanticReason: semantic.reason });
    return NextResponse.json(
      response,
      {
        headers:
          semantic.status === "error"
            ? SEARCH_NO_STORE_HEADERS
            : SEARCH_CACHE_HEADERS,
      },
    );
  });
}
