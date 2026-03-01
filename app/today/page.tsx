import { getCurrentUserOrRedirect } from "@/lib/auth";
import { getTodayDashboard } from "@/lib/data";
import { ProgressRing } from "@/components/progress-ring";
import { StatCard } from "@/components/stat-card";
import { TodayChecklist } from "@/components/today-checklist";
import { TodayRewardUnlocks } from "@/components/today-reward-unlocks";

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
          hint={dashboard.summary.streakExplanation}
          accent="orange"
        />
        <StatCard
          label="Protection tokens"
          value={`${dashboard.profile.protection_tokens}`}
          hint="A token can preserve streak on a missed threshold day"
          accent="blue"
        />
        <StatCard
          label="Weekly redeemed"
          value={`${dashboard.summary.weeklyRedeemedCount}`}
          hint="Reward redemptions in the last 7 days"
          accent="teal"
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

      <TodayRewardUnlocks
        initialUnlocks={dashboard.rewardUnlocks.map((unlock) => ({
          id: unlock.id,
          title: unlock.title,
          threshold: unlock.threshold,
          status: unlock.status,
          explanation: unlock.explanation
        }))}
      />

      <section className="panel">
        <h2>Why This Status?</h2>
        <ul className="explanation-list">
          <li>
            <strong>Streak</strong>
            <p>{dashboard.summary.streakExplanation}</p>
          </li>
          {dashboard.rewardUnlocks.map((unlock) => (
            <li key={`explain-${unlock.id}`}>
              <strong>{unlock.title}</strong>
              <p>{unlock.explanation}</p>
            </li>
          ))}
          {dashboard.rewardUnlocks.length === 0 ? <li className="empty">No reward status decisions yet.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Recent Decisions</h2>
        <ul className="explanation-list">
          {dashboard.recentEvents.map((event) => (
            <li key={event.id}>
              <strong>{event.eventType}</strong>
              <small>{event.dateLocal}</small>
              <p>{event.message}</p>
            </li>
          ))}
          {dashboard.recentEvents.length === 0 ? <li className="empty">No decisions logged yet.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Recent Redemptions</h2>
        <ul className="unlock-list">
          {dashboard.rewardHistory.map((entry) => (
            <li key={entry.id}>
              <div>
                <strong>{entry.title}</strong>
                <small>Redeemed for {entry.date_local}</small>
              </div>
              <span className="tag status-redeemed">redeemed</span>
            </li>
          ))}
          {dashboard.rewardHistory.length === 0 ? <li className="empty">No redemptions yet.</li> : null}
        </ul>
      </section>
    </section>
  );
}
