import { Suspense } from "react";
import { LibraryExplorer } from "@/components/library/library-explorer";

export default function LibraryPage() {
  return (
    <Suspense>
      <LibraryExplorer />
    </Suspense>
  );
}
