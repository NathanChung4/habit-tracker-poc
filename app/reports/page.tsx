import { ReportPanels } from "@/components/report-panels";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getDailyReport, getWeeklyReport } from "@/lib/data";

export default async function ReportsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const [dailyRows, weeklyRows] = await Promise.all([
    getDailyReport(supabase, user.id),
    getWeeklyReport(supabase, user.id, 8)
  ]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Performance</p>
          <h2>Reports</h2>
          <p>Track daily completion and weekly consistency trends.</p>
        </div>
        <a href="/reports/decisions" className="pill">
          Decision Reports
        </a>
      </header>
      <ReportPanels dailyRows={dailyRows as any} weeklyRows={weeklyRows} />
    </section>
  );
}
