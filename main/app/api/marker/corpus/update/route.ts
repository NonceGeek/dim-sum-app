import { NextRequest, NextResponse } from "next/server";
import { requireMarker } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return requireMarker(req, async (req: NextRequest, userId: string) => {
    try {
      const body = await req.json();
      const { uuid, note } = body;

      if (!uuid || !note) {
        return NextResponse.json(
          { error: "UUID and note are required" },
          { status: 400 }
        );
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
  });
}