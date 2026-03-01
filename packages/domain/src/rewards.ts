import { DailySummary, RewardRuleConfig } from "./types";

export function defaultRewardRuleConfig(): RewardRuleConfig {
  return {
    threshold: 1
  };
}

export function evaluateRewardUnlock(
  summary: Pick<DailySummary, "completionRate">,
  ruleConfig: RewardRuleConfig
): boolean {
  return summary.completionRate >= normalizeThreshold(ruleConfig.threshold);
}

function normalizeThreshold(raw: number): number {
  if (!Number.isFinite(raw)) {
    return 1;
  }

  return Math.max(0, Math.min(1, raw));
}
