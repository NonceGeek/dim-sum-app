import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // 检查用户是否登录
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { uuid, note, category } = body;

    if (!uuid || !note) {
      return NextResponse.json(
        { error: "UUID and note are required" },
        { status: 400 }
      );
    }

    // 如果提供了 category，检查该分类的 editable_level
    if (category) {
      const categoryInfo = await prisma.cantonese_categories.findFirst({
        where: { name: category }
      });

      if (categoryInfo) {
        const editableLevel = Number(categoryInfo.editable_level);
        const userRole = session.user.role;

        // editable_level = 0: 不可编辑
        if (editableLevel === 0) {
          return NextResponse.json(
            { error: "This category is not editable" },
            { status: 403 }
          );
        }
        
        // editable_level = 1: 只有 TAGGER_PARTNER 和 TAGGER_OUTSOURCING 可以编辑
        if (editableLevel === 1) {
          if (userRole !== Role.TAGGER_PARTNER && userRole !== Role.TAGGER_OUTSOURCING) {
            return NextResponse.json(
              { error: "Permission denied. Marker role required." },
              { status: 403 }
            );
          }
        }
        
        // editable_level = 2: 所有登录用户都可以编辑（已通过上面的登录检查）
      }
    }

    // Get API key from server environment (not exposed to frontend)
    const apiKey = process.env.BACKEND_API_KEY;
    if (!apiKey) {
      console.error('BACKEND_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Make request to backend with server-side API key
    const response = await fetch(process.env.BACKEND_URL + '/dev/insert_corpus_item', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uuid,
        note,
        api_key: apiKey
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = 'API request failed';
      
      if (errorData && errorData.error) {
        switch (errorData.error) {
          case 'Invalid API key':
            errorMessage = 'Invalid API Key';
            break;
          case 'API key not approved':
            errorMessage = 'API Key Not Approved';
            break;
          case 'Corpus item not found':
            errorMessage = 'Corpus Item Not Found';
            break;
          default:
            errorMessage = errorData.error;
            break;
        }
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error updating corpus item:', error);
    return NextResponse.json(
      { error: "Failed to update corpus item" },
      { status: 500 }
    );
  }
}