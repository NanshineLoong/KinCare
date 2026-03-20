import type { HealthSummaryRecord } from "./api/health";

export type HealthSummaryCard = {
  content: string;
  label: string | null;
  status: HealthSummaryRecord["status"] | undefined;
};

export const MAX_HEALTH_SUMMARY_CARDS = 4;

export function buildHealthSummaryCards(
  summaries: HealthSummaryRecord[] | undefined,
  emptySummaryText: string,
): HealthSummaryCard[] {
  const cards =
    summaries?.slice(0, MAX_HEALTH_SUMMARY_CARDS).map((item) => ({
      label: item.label,
      content: item.value,
      status: item.status,
    })) ?? [];

  if (cards.length > 0) {
    return cards;
  }

  return [
    {
      label: null,
      content: emptySummaryText,
      status: undefined,
    },
  ];
}
