import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function run() {
  const { PrismaClient } = await import("@prisma/client");
  const { importLegacyApplications } = await import(
    "../../lib/app-store/import-legacy"
  );
  const db = new PrismaClient();
  try {
    if (process.env.APP_STORE_WRITES_ENABLED === "true")
      throw new Error("Disable App Store writes before importing");
    console.log(
      JSON.stringify(
        await importLegacyApplications(db, process.argv.includes("--apply")),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  process.exitCode = 1;
});
