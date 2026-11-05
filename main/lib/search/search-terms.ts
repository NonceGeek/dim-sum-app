import * as OpenCC from "opencc-js";

const toSimplified = OpenCC.Converter({ from: "hk", to: "cn" });
const toTraditional = OpenCC.Converter({ from: "cn", to: "hk" });

export function getPrimarySearchTerms(query: string): string[] {
  const normalized = query.trim();
  return Array.from(
    new Set(
      [normalized, toSimplified(normalized), toTraditional(normalized)]
        .map((term) => term.trim())
        .filter(Boolean),
    ),
  );
}
