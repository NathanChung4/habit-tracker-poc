import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTodayDashboard } from "@/lib/data";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { TodayChecklist } from "@/components/today-checklist";

export default async function TodayPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const dashboard = await getTodayDashboard(supabase, user.id);

  const completionPercent = Math.round(dashboard.summary.completionRate * 100);
  const pendingCount = dashboard.instances.filter((instance) => instance.status === "pending").length;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{dashboard.dateLocal}</p>
          <h2>Today</h2>
          <p>Consistency compounds when you finish what you planned.</p>
        </div>
        <ProgressRing value={dashboard.summary.completionRate} label="Completion" />
      </header>

      <div className="stats-grid">
        <StatCard label="Daily completion" value={`${completionPercent}%`} hint="Target 100% for reward unlocks" />
        <StatCard
          label="Streak"
          value={`${dashboard.summary.streakCount} days`}
          hint={dashboard.summary.tokenUsed ? "A protection token was used" : "No token used today"}
          accent="orange"
        />
        <StatCard
          label="XP / Level"
          value={`${dashboard.profile.xp} XP • L${dashboard.profile.level}`}
          hint={`Today +${dashboard.summary.xpAwarded} XP`}
          accent="blue"
        />
      </div>

      <TodayChecklist
        initialItems={dashboard.instances.map((instance) => ({
          id: instance.id,
          title: instance.title,
          notes: instance.notes,
          status: instance.status
        }))}
      />

      {pendingCount > 0 ? (
        <section className="panel">
          <h2>In-App Reminder</h2>
          <p className="muted">
            You still have {pendingCount} pending habit{pendingCount === 1 ? "" : "s"} today. Completing them keeps
            your consistency score and reward unlocks on track.
          </p>
        </section>
      ) : null}

      <section className="panel">
        <h2>Reward Status</h2>
        <ul className="unlock-list">
          {dashboard.rewardUnlocks.map((unlock) => (
            <li key={unlock.id}>
              <div>
                <strong>{unlock.title}</strong>
                <small>{unlock.status === "locked" ? "Locked until completion goal" : "Unlocked for today"}</small>
              </div>
              <span className={`tag status-${unlock.status}`}>{unlock.status}</span>
            </li>
          ))}
          {dashboard.rewardUnlocks.length === 0 ? <li className="empty">Create a reward contract to start gating rewards.</li> : null}
        </ul>
      </section>
    </section>
  );
}
