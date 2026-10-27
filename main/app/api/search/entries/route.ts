import { NextRequest } from "next/server";
import { handleEntrySearch } from "@/lib/search/entry-search-handler";

// Keep main's existing Web analytics behavior; v2 still records search-app events.
export const GET = (req: NextRequest) => handleEntrySearch(req, { recordWebSearch: false });
