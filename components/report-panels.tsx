interface DailyRow {
  date_local: string;
  completion_rate: number;
  scheduled_count: number;
  completed_count: number;
  streak_count: number;
  token_used: boolean;
}

interface WeeklyRow {
  weekStartDate: string;
  averageCompletionRate: number;
  scheduledCount: number;
  completedCount: number;
}

export function ReportPanels({ dailyRows, weeklyRows }: { dailyRows: DailyRow[]; weeklyRows: WeeklyRow[] }) {
  return (
    <div className="reports-layout">
      <section className="panel">
        <h2>Daily Consistency (14 days)</h2>
        <ul className="daily-report-list">
          {dailyRows.map((row) => (
            <li key={row.date_local}>
              <div>
                <strong>{row.date_local}</strong>
                <small>
                  {row.completed_count}/{row.scheduled_count} completed
                </small>
              </div>
              <div className="bar-wrap">
                <div className="bar" style={{ width: `${Math.round(row.completion_rate * 100)}%` }} />
              </div>
              <span>{Math.round(row.completion_rate * 100)}%</span>
            </li>
          ))}
          {dailyRows.length === 0 ? <li className="empty">No daily data yet.</li> : null}
        </ul>
      </section>

      <section className="panel">
        <h2>Weekly Consistency (8 weeks)</h2>
        <ul className="weekly-report-grid">
          {weeklyRows.map((row) => (
            <li key={row.weekStartDate}>
              <strong>{row.weekStartDate}</strong>
              <p>{Math.round(row.averageCompletionRate * 100)}% avg completion</p>
              <small>
                {row.completedCount}/{row.scheduledCount} total
              </small>
            </li>
          ))}
          {weeklyRows.length === 0 ? <li className="empty">No weekly data yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
