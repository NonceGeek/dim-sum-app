import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CorpusEditAccessError, EDITOR_CACHE_HEADERS, requireCorpusEditor } from "@/lib/services/corpus-edit-access";

export async function GET(req: NextRequest) {
  return requireAuth(req, async (req: NextRequest, userId: string) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const q = searchParams.get('q');
      const category = searchParams.get('category')?.trim() || 'zyzdv2';
      await requireCorpusEditor(userId, category);
      const offset = (page - 1) * limit;

      // Validate pagination parameters
      if (!Number.isSafeInteger(page) || !Number.isSafeInteger(limit) || page < 1 || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: "Invalid pagination parameters. Page must be >= 1, limit must be 1-100" },
          { status: 400 }
        );
      }

      // Build where clause with optional search
      const whereClause = {
        category,
        ...(q && {
          data: {
            contains: q,
            mode: 'insensitive' as const
          }
        })
      };

      // Get total count for pagination info
      const totalCount = await prisma.cantonese_corpus_all.count({
        where: whereClause
      });

      // Get the corpus items with pagination
      const items = await prisma.cantonese_corpus_all.findMany({
        where: whereClause,
        select: {
          id: true,
          data: true,
          note: true,
          category: true,
          created_at: true,
          unique_id: true,
          tags: true,
          editable_level: true,
          liked_num: true,
          bookmark_num: true,
          view_num: true
        },
        orderBy: {
          created_at: 'desc'
        },
        skip: offset,
        take: limit
      });

      const totalPages = Math.ceil(totalCount / limit);

      // Convert BigInt values to numbers for JSON serialization
      const serializedItems = items.map(item => ({
        ...item,
        id: Number(item.id),
        liked_num: Number(item.liked_num),
        bookmark_num: Number(item.bookmark_num),
        view_num: Number(item.view_num),
        editable_level: Number(item.editable_level)
      }));

      return NextResponse.json({
        data: serializedItems,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }, { headers: EDITOR_CACHE_HEADERS });

    } catch (error) {
      if (error instanceof CorpusEditAccessError) return NextResponse.json({ error: error.message }, { status: error.status, headers: EDITOR_CACHE_HEADERS });
      console.error("Error fetching corpus items:", error);
      return NextResponse.json(
        { error: "Failed to fetch corpus items" },
        { status: 500 }
      );
    }
  });
}