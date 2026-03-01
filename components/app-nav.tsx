import Link from "next/link";

interface AppNavProps {
  isAuthenticated: boolean;
}

export function AppNav({ isAuthenticated }: AppNavProps) {
  if (!isAuthenticated) {
    return null;
  }

  return (
    <nav className="app-nav">
      <Link href="/today">Today</Link>
      <Link href="/habits">Habits</Link>
      <Link href="/reports">Reports</Link>
      <Link href="/rewards">Rewards</Link>
      <Link href="/settings">Settings</Link>
    </nav>
  );
}
