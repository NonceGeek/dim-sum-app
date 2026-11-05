import { NextRequest } from "next/server";
import { handleEntrySearch } from "@/lib/search/entry-search-handler";

export const GET = (req: NextRequest) => handleEntrySearch(req);
