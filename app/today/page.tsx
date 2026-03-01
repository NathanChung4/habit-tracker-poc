import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTodayDashboard } from "@/lib/data";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { TodayChecklist } from "@/components/today-checklist";

export default async function TodayPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const dashboard = await getTodayDashboard(supabase, user.id);

  const completionPercent = Math.round(dashboard.summary.completionRate * 100);
  const pendingCount = dashboard.habits.filter((habit) => habit.status === "pending").length;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{dashboard.dateLocal}</p>
          <h2>Today</h2>
          <p>Binary consistency loop: complete scheduled habits for the current local day.</p>
        </div>
        <ProgressRing value={dashboard.summary.completionRate} label="Completion" />
      </header>

      <div className="stats-grid">
        <StatCard
          label="Daily completion"
          value={`${completionPercent}%`}
          hint={`Streak threshold is fixed at ${Math.round(dashboard.summary.threshold * 100)}%`}
        />
        <StatCard
          label="Current streak"
          value={`${dashboard.summary.streakCount} days`}
          hint={dashboard.summary.tokenUsed ? "A protection token was used in the streak window" : "No token consumed today"}
          accent="orange"
        />
        <StatCard
          label="Protection tokens"
          value={`${dashboard.profile.protection_tokens}`}
          hint="A token can preserve streak on a missed threshold day"
          accent="blue"
        />
      </div>

      <TodayChecklist
        initialItems={dashboard.habits.map((habit) => ({
          id: habit.id,
          name: habit.name,
          description: habit.description,
          status: habit.status
        }))}
      />

      {pendingCount > 0 ? (
        <section className="panel">
          <h2>In-App Reminder</h2>
          <p className="muted">
            You still have {pendingCount} pending habit{pendingCount === 1 ? "" : "s"}. Hitting at least 80%
            completion keeps the streak alive.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <h2>Today&apos;s Reward Unlocks</h2>
        <ul className="unlock-list">
          {dashboard.rewardUnlocks.map((unlock) => (
            <li key={unlock.id}>
              <div>
                <strong>{unlock.title}</strong>
                <small>Needs {Math.round(unlock.threshold * 100)}% completion</small>
              </div>
              <span className={`tag status-${unlock.status}`}>{unlock.status}</span>
            </li>
          ))}
          {dashboard.rewardUnlocks.length === 0 ? <li className="empty">No active reward contracts yet.</li> : null}
        </ul>
      </section>
    </section>
  );
}
