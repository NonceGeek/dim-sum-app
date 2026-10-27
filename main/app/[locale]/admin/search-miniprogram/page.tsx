import { redirect } from "@/i18n/navigation";

export default async function LegacySearchMiniprogramPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/admin/analytics?tab=miniprogram", locale });
}
