import assert from "node:assert/strict";

const baseUrl = process.env.S6_SEARCH_BASE_URL ?? "http://localhost:3000";

type Entry = {
  corpusId: number;
  entryName: string;
  contentAttribute: "unclassified" | "oral" | "cultural_knowledge";
  mediaTypes: string[];
  assets: { model3dUrl: string | null };
};

type SearchResponse = {
  primary: Entry | null;
  similar: Entry[];
  recommended: Entry[];
};

async function request(
  params: Record<string, string>,
): Promise<{ response: Response; body: SearchResponse | { error: string } }> {
  const url = new URL("/api/search/entries", baseUrl);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  const response = await fetch(url);
  return { response, body: await response.json() };
}

async function main() {
  const defaultPrimary = await request({ q: "船", section: "primary" });
  assert.equal(defaultPrimary.response.status, 200);
  assert.equal((defaultPrimary.body as SearchResponse).primary?.entryName, "船");

  const culturalPrimary = await request({
    q: "船",
    section: "primary",
    contentAttribute: "cultural_knowledge",
  });
  assert.equal(culturalPrimary.response.status, 200);
  assert.equal(
    (culturalPrimary.body as SearchResponse).primary?.contentAttribute,
    "cultural_knowledge",
  );

  const oralPrimary = await request({
    q: "船",
    section: "primary",
    contentAttribute: "oral",
  });
  assert.equal(oralPrimary.response.status, 200);
  const oralSeed = (oralPrimary.body as SearchResponse).primary;
  assert.equal(oralSeed?.contentAttribute, "oral");
  assert.ok(oralSeed);

  const oralSemantic = await request({
    q: "船",
    section: "semantic",
    primaryCorpusId: String(oralSeed.corpusId),
    contentAttribute: "oral",
    mediaType: "audio",
  });
  assert.equal(oralSemantic.response.status, 200);
  const oralSemanticBody = oralSemantic.body as SearchResponse;
  assert.ok(
    oralSemanticBody.similar.every(
      (entry) =>
        entry.contentAttribute === "oral" && entry.mediaTypes.includes("audio"),
    ),
  );
  assert.ok(
    oralSemanticBody.recommended.every(
      (entry) => entry.contentAttribute === "oral",
    ),
  );

  const oralSemanticUnfiltered = await request({
    q: "船",
    section: "semantic",
    primaryCorpusId: String(oralSeed.corpusId),
    contentAttribute: "oral",
  });
  assert.equal(oralSemanticUnfiltered.response.status, 200);
  assert.deepEqual(
    oralSemanticBody.recommended.map((entry) => entry.corpusId),
    (oralSemanticUnfiltered.body as SearchResponse).recommended.map(
      (entry) => entry.corpusId,
    ),
  );

  const ship = await request({
    q: "帆船",
    section: "primary",
    contentAttribute: "cultural_knowledge",
  });
  assert.equal(ship.response.status, 200);
  const shipEntry = (ship.body as SearchResponse).primary;
  assert.equal(shipEntry?.entryName, "帆船（哥德堡一号）");
  assert.deepEqual(shipEntry?.mediaTypes, ["text", "audio", "model3d"]);
  assert.equal(shipEntry?.assets.model3dUrl, "https://oss.aidimsum.com/vox-ship");

  const invalidAttribute = await request({
    q: "船",
    section: "primary",
    contentAttribute: "unclassified",
  });
  assert.equal(invalidAttribute.response.status, 400);

  const invalidMedia = await request({
    q: "船",
    section: "primary",
    mediaType: "document",
  });
  assert.equal(invalidMedia.response.status, 400);

  console.log(
    JSON.stringify({
      defaultPrimary: (defaultPrimary.body as SearchResponse).primary?.entryName,
      culturalPrimary: (culturalPrimary.body as SearchResponse).primary?.entryName,
      oralPrimary: oralSeed.entryName,
      oralSimilarCount: oralSemanticBody.similar.length,
      oralRecommendedCount: oralSemanticBody.recommended.length,
      mediaFilterKeepsRecommendedStable: true,
      shipMediaTypes: shipEntry?.mediaTypes,
      invalidAttributeStatus: invalidAttribute.response.status,
      invalidMediaStatus: invalidMedia.response.status,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
