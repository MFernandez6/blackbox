import { notFound, redirect } from "next/navigation";
import { getSession, canEdit } from "@/lib/auth";
import { blackletterAppUrl } from "@/lib/integrations/blackletter";
import { loadSummaryReportPayload } from "@/lib/reports/summary-report-server";
import { SummaryReportWorkspace } from "@/components/reports/summary-report-workspace";

export const dynamic = "force-dynamic";

export default async function SummaryReportPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const loaded = await loadSummaryReportPayload({ id: params.id });
  if (!loaded) notFound();

  const { assignedAdjusterId, ...payload } = loaded;
  if (session.user.role === "ADJUSTER" && assignedAdjusterId !== session.user.id) {
    redirect("/dashboard");
  }

  const letter = blackletterAppUrl();

  return (
    <SummaryReportWorkspace
      payload={payload}
      editable={canEdit(session.user.role)}
      backHref={`/claims/${payload.claim.id}?tab=reports`}
      siblingHref={letter ? `${letter}/claims/${payload.claim.id}/summary-report` : undefined}
      siblingLabel="Open in BLACKLETTER"
    />
  );
}
