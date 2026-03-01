import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getConsistencyEvents, getDecisionDiagnosticsSettings } from "@/lib/data";
import { DecisionReportPanels } from "@/components/decision-report-panels";

export default async function DecisionReportsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const [events, settings] = await Promise.all([
    getConsistencyEvents(supabase, user.id, { limit: 50 }),
    getDecisionDiagnosticsSettings(supabase, user.id)
  ]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Diagnostics</p>
          <h2>Decision Reports</h2>
          <p>Inspect streak and reward decision events grouped by day with anomaly flags.</p>
        </div>
        <a href="/reports" className="pill">
          Back to Reports
        </a>
      </header>
      <DecisionReportPanels events={events} initialSettings={settings} />
    </section>
  );
}
