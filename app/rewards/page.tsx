import { getCurrentUserOrRedirect } from "@/lib/auth";

export default async function RewardsPage() {
  await getCurrentUserOrRedirect();

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase C</p>
          <h2>Rewards</h2>
          <p>Rewards are intentionally paused in Phase B while core streak and data-model alignment is stabilized.</p>
        </div>
      </header>
      <section className="panel">
        <h3>Current status</h3>
        <p className="muted">
          Phase B focuses on `profiles`, `habits`, and `habit_logs`. Reward contract tables are out of scope for this phase.
        </p>
      </section>
    </section>
  );
}
