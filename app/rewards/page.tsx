import { RewardManager } from "@/components/reward-manager";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listRewardContracts, listRewardUnlocks } from "@/lib/data";

export default async function RewardsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const [contracts, unlocks] = await Promise.all([
    listRewardContracts(supabase, user.id),
    listRewardUnlocks(supabase, user.id)
  ]);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Behavior Contracts</p>
          <h2>Rewards</h2>
          <p>Define what is unlocked only after your daily habits are complete.</p>
        </div>
      </header>
      <RewardManager initialContracts={contracts as any} initialUnlocks={unlocks as any} />
    </section>
  );
}
