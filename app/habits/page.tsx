import { HabitManager } from "@/components/habit-manager";
import { getCurrentUserOrRedirect } from "@/lib/auth";
import { listHabits } from "@/lib/data";

export default async function HabitsPage() {
  const { user, supabase } = await getCurrentUserOrRedirect();
  const habits = await listHabits(supabase, user.id);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Habit System</p>
          <h2>Habits</h2>
          <p>Configure recurring habits with flexible schedules.</p>
        </div>
      </header>
      <HabitManager initialHabits={habits as any} />
    </section>
  );
}
