import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const { user } = await getCurrentUser();

  if (user) {
    redirect("/today");
  }

  return (
    <section className="page auth-page">
      <div>
        <h2>Build Momentum Daily</h2>
        <p>
          Track habits, protect your streak, and unlock rewards only after your daily commitments are complete.
        </p>
      </div>
      <AuthCard />
    </section>
  );
}
