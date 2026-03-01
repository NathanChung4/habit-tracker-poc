import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listRewardContracts } from "@/lib/data";
import { RewardContractManager } from "@/components/reward-contract-manager";

export default async function RewardsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const contracts = await listRewardContracts(supabase, user.id);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase C</p>
          <h2>Rewards</h2>
          <p>Create and view reward contracts. Unlock/redeem transitions come in the next increment.</p>
        </div>
      </header>
      <RewardContractManager initialContracts={contracts} />
    </section>
  );
}
