import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listRewardContracts } from "@/lib/data";

export default async function RewardsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const contracts = await listRewardContracts(supabase, user.id);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase C</p>
          <h2>Rewards</h2>
          <p>Read-only rewards contracts are now active. Write/redeem actions come in the next increment.</p>
        </div>
      </header>

      <section className="panel">
        <h3>Reward Contracts</h3>
        <ul className="contract-list">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <strong>{contract.title}</strong>
              <small>
                {contract.rule_type} • {Math.round(contract.threshold * 100)}% threshold • {contract.is_active ? "active" : "inactive"}
              </small>
            </li>
          ))}
          {contracts.length === 0 ? <li className="empty">No reward contracts yet.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h3>Next Step</h3>
        <p className="muted">
          Next iteration adds `POST /api/rewards/contracts`, unlock generation logic, and redeem transitions.
        </p>
      </section>
    </section>
  );
}
