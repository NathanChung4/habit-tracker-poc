import { describe, expect, it } from "vitest";
import {
  buildDecisionDailySummaries,
  countEventsInLastDays,
  detectDecisionAnomalies
} from "../../lib/decision-analytics";

const events = [
  {
    id: "e1",
    eventType: "streak_evaluated" as const,
    dateLocal: "2026-03-07",
    createdAt: "2026-03-07T13:00:00.000Z",
    message: "streak"
  },
  {
    id: "e2",
    eventType: "token_consumed" as const,
    dateLocal: "2026-03-06",
    createdAt: "2026-03-06T13:00:00.000Z",
    message: "token"
  },
  {
    id: "e3",
    eventType: "token_consumed" as const,
    dateLocal: "2026-03-05",
    createdAt: "2026-03-05T13:00:00.000Z",
    message: "token"
  },
  {
    id: "e4",
    eventType: "reward_redeemed" as const,
    dateLocal: "2026-03-04",
    createdAt: "2026-03-04T13:00:00.000Z",
    message: "redeemed"
  },
  {
    id: "e5",
    eventType: "reward_unlocked" as const,
    dateLocal: "2026-03-04",
    createdAt: "2026-03-04T10:00:00.000Z",
    message: "unlocked"
  }
];

describe("decision analytics", () => {
  it("groups events by date and aggregates counts", () => {
    const grouped = buildDecisionDailySummaries(events);

    expect(grouped[0]?.dateLocal).toBe("2026-03-07");
    expect(grouped[0]?.counts.streak_evaluated).toBe(1);
    expect(grouped.find((row) => row.dateLocal === "2026-03-04")?.total).toBe(2);
  });

  it("counts events in rolling windows", () => {
    const tokenCount = countEventsInLastDays(events, "token_consumed", 7, "2026-03-07");
    const unlockCount = countEventsInLastDays(events, "reward_unlocked", 3, "2026-03-07");

    expect(tokenCount).toBe(2);
    expect(unlockCount).toBe(0);
  });

  it("flags expected anomalies", () => {
    const anomalies = detectDecisionAnomalies(
      [
        ...events.filter((event) => event.id !== "e5"), // keep redeemed but remove unlocked
        {
          id: "e6",
          eventType: "token_consumed",
          dateLocal: "2026-03-03",
          createdAt: "2026-03-03T11:00:00.000Z",
          message: "token"
        }
      ],
      "2026-03-07"
    );

    expect(anomalies.join(" ")).toContain("High token usage");
    expect(anomalies.join(" ")).toContain("Redeem/unlock mismatch");
  });
});
