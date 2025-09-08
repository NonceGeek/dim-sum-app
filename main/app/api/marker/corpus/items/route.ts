import { NextRequest, NextResponse } from "next/server";
import { requireMarker } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  return requireMarker(req, async (req: NextRequest, userId: string) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '20');
      const q = searchParams.get('q');
      const offset = (page - 1) * limit;

      // Validate pagination parameters
      if (page < 1 || limit < 1 || limit > 100) {
        return NextResponse.json(
          { error: "Invalid pagination parameters. Page must be >= 1, limit must be 1-100" },
          { status: 400 }
        );
      }

      // Build where clause with optional search
      const whereClause = {
        category: 'zyzdv2',
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
        view_num: Number(item.view_num)
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
      });

    } catch (error) {
      console.error('Error fetching corpus items:', error);
      return NextResponse.json(
        { error: "Failed to fetch corpus items" },
        { status: 500 }
      );
    }
  });
}