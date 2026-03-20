import { describe, expect, it } from "vitest";

import { buildHealthSummaryCards, MAX_HEALTH_SUMMARY_CARDS } from "./healthSummaryCards";

describe("buildHealthSummaryCards", () => {
  it("returns at most four cards in the incoming order", () => {
    const cards = buildHealthSummaryCards(
      Array.from({ length: 5 }, (_, index) => ({
        id: `summary-${index + 1}`,
        member_id: "member-1",
        category: `category-${index + 1}`,
        label: `摘要 ${index + 1}`,
        value: `内容 ${index + 1}`,
        status: "good" as const,
        generated_at: "2026-03-20T08:00:00+08:00",
        created_at: `2026-03-20T08:00:0${index}+08:00`,
      })),
      "期待新纪录",
    );

    expect(cards).toHaveLength(MAX_HEALTH_SUMMARY_CARDS);
    expect(cards.map((item) => item.label)).toEqual([
      "摘要 1",
      "摘要 2",
      "摘要 3",
      "摘要 4",
    ]);
  });

  it("returns a single untitled placeholder when there are no summaries", () => {
    expect(buildHealthSummaryCards([], "期待新纪录")).toEqual([
      {
        label: null,
        content: "期待新纪录",
        status: undefined,
      },
    ]);
  });
});
