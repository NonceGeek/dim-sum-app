import { NextRequest, NextResponse } from "next/server";
import { requireMarker } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return requireMarker(req, async (req: NextRequest, userId: string) => {
    try {
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
      const response = await fetch(process.env.BACKEND_URL + '/dev/editable_items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
      console.error('Error fetching editable items:', error);
      return NextResponse.json(
        { error: "Failed to fetch editable items" },
        { status: 500 }
      );
    }
  });
}