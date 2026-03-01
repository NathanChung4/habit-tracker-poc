import { SettingsForm } from "@/components/settings-form";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { ensureProfile } from "@/lib/data";

export default async function SettingsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const profile = await ensureProfile(supabase, user.id);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuration</p>
          <h2>Settings</h2>
          <p>Control timezone, day rollover cutoff, and token protection strategy.</p>
        </div>
      </header>
      <SettingsForm
        timezone={profile.timezone}
        cutoffTime={profile.cutoff_time}
        protectionTokens={profile.protection_tokens}
      />
    </section>
  );
}
