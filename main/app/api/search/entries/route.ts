import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest) {
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

    const fetchSemantic = async (): Promise<{
      rows: AggregatedSearchRow[];
      status: EntrySearchResponse["sectionStatus"]["semantic"];
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
              return { rows: similarRows, status: "fallback" };
            } catch (similarError) {
              console.error("Similar-only semantic fallback failed:", similarError);
            }
          }
          if (isPrismaTransientDatabaseError(error)) {
            return { rows: [], status: "error" };
          }
        }
      }

      try {
        return await fetchFallback();
      } catch (error) {
        console.error("Entry search fallback failed:", error);
        if (isPrismaTransientDatabaseError(error)) {
          return { rows: [], status: "error" };
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
        return NextResponse.json(
          buildResponse({
            query,
            primaryRows,
            similarOffset,
            recommendedOffset,
            semanticStatus: "idle",
          }),
          { headers: SEARCH_CACHE_HEADERS },
        );
      } catch (error) {
        console.error("Primary entry search failed:", error);
        return databaseErrorResponse(error, "Entry primary search failed");
      }
    }

    if (section === "semantic") {
      const semantic = await fetchSemantic();
      return NextResponse.json(
        buildResponse({
          query,
          semanticRows: semantic.rows,
          similarOffset,
          recommendedOffset,
          semanticStatus: semantic.status,
        }),
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

    return NextResponse.json(
      buildResponse({
        query,
        primaryRows,
        semanticRows: semantic.rows,
        similarOffset,
        recommendedOffset,
        semanticStatus: semantic.status,
      }),
      {
        headers:
          semantic.status === "error"
            ? SEARCH_NO_STORE_HEADERS
            : SEARCH_CACHE_HEADERS,
      },
    );
  });
}
