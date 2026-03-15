import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { sessionStorageKey } from "./auth/session";


function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: Array<{ event: string; data: unknown }>) {
  const body = events
    .map((item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function requestPath(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return new URL(input).pathname;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return new URL(input.url).pathname;
}

function createSessionPayload() {
  return {
    user: {
      id: "user-1",
      family_space_id: "family-1",
      email: "owner@example.com",
      role: "admin",
      created_at: "2026-03-15T08:00:00Z",
    },
    member: {
      id: "member-1",
      family_space_id: "family-1",
      user_account_id: "user-1",
      name: "管理员",
      gender: "female",
      birth_date: "1990-01-01",
      height_cm: 165,
      blood_type: "O+",
      avatar_url: null,
      created_at: "2026-03-15T08:00:00Z",
      updated_at: "2026-03-15T08:00:00Z",
    },
    tokens: {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
    },
  };
}

function createMembers() {
  return [
    {
      id: "member-1",
      family_space_id: "family-1",
      user_account_id: "user-1",
      name: "管理员",
      gender: "female",
      birth_date: "1990-01-01",
      height_cm: 165,
      blood_type: "O+",
      avatar_url: null,
      created_at: "2026-03-15T08:00:00Z",
      updated_at: "2026-03-15T08:00:00Z",
    },
    {
      id: "member-2",
      family_space_id: "family-1",
      user_account_id: null,
      name: "张妈妈",
      gender: "female",
      birth_date: "1958-04-12",
      height_cm: 158,
      blood_type: "A+",
      avatar_url: null,
      created_at: "2026-03-15T08:00:00Z",
      updated_at: "2026-03-15T08:00:00Z",
    },
  ];
}

function createDashboard() {
  return {
    members: [
      {
        member: {
          id: "member-1",
          name: "管理员",
          gender: "female",
          avatar_url: null,
          blood_type: "O+",
        },
        health_summaries: [
          {
            id: "summary-1",
            member_id: "member-1",
            category: "lifestyle",
            label: "生活习惯",
            value: "最近一次睡眠 460 分钟，最近一次运动 48 分钟。",
            status: "good",
            generated_at: "2026-03-15T08:30:00+08:00",
            created_at: "2026-03-15T08:30:00+08:00",
          },
        ],
      },
      {
        member: {
          id: "member-2",
          name: "张妈妈",
          gender: "female",
          avatar_url: null,
          blood_type: "A+",
        },
        health_summaries: [
          {
            id: "summary-2",
            member_id: "member-2",
            category: "chronic-vitals",
            label: "慢病管理",
            value: "最新收缩压 126mmHg。",
            status: "neutral",
            generated_at: "2026-03-15T08:30:00+08:00",
            created_at: "2026-03-15T08:30:00+08:00",
          },
          {
            id: "summary-3",
            member_id: "member-2",
            category: "lifestyle",
            label: "生活习惯",
            value: "最近一次睡眠 460 分钟，最近一次运动 48 分钟。",
            status: "good",
            generated_at: "2026-03-15T08:30:00+08:00",
            created_at: "2026-03-15T08:30:00+08:00",
          },
          {
            id: "summary-4",
            member_id: "member-2",
            category: "body-vitals",
            label: "生理指标",
            value: "最近一次指标是 收缩压 126mmHg。",
            status: "neutral",
            generated_at: "2026-03-15T08:30:00+08:00",
            created_at: "2026-03-15T08:30:00+08:00",
          },
        ],
      },
    ],
    today_reminders: [
      {
        id: "plan-1",
        member_id: "member-2",
        member_name: "张妈妈",
        category: "medication-reminder",
        title: "早餐后服药",
        description: "08:30 服用降压药",
        status: "active",
        scheduled_at: "2026-03-15T08:30:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-14T20:00:00+08:00",
        updated_at: "2026-03-14T20:00:00+08:00",
      },
    ],
  };
}

function createProfileDetail(memberId: string) {
  return {
    member: {
      id: memberId,
      family_space_id: "family-1",
      user_account_id: null,
      name: "张妈妈",
      gender: "female",
      birth_date: "1958-04-12",
      height_cm: 158,
      blood_type: "A+",
      avatar_url: null,
      created_at: "2026-03-15T08:00:00Z",
      updated_at: "2026-03-15T08:00:00Z",
    },
    observations: [
      {
        id: "obs-1",
        member_id: memberId,
        category: "chronic-vitals",
        code: "bp-systolic",
        display_name: "收缩压",
        value: 126,
        value_string: null,
        unit: "mmHg",
        context: null,
        effective_at: "2026-03-15T08:00:00+08:00",
        source: "manual",
        device_name: null,
        notes: null,
        created_at: "2026-03-15T08:00:00+08:00",
        updated_at: "2026-03-15T08:00:00+08:00",
      },
    ],
    sleepRecords: [
      {
        id: "sleep-1",
        member_id: memberId,
        start_at: "2026-03-14T22:30:00+08:00",
        end_at: "2026-03-15T06:10:00+08:00",
        total_minutes: 460,
        deep_minutes: 90,
        rem_minutes: 110,
        light_minutes: 220,
        awake_minutes: 40,
        efficiency_score: 90,
        is_nap: false,
        source: "device",
        device_name: "Apple Watch",
        created_at: "2026-03-15T06:10:00+08:00",
      },
    ],
    workoutRecords: [
      {
        id: "workout-1",
        member_id: memberId,
        type: "walking",
        start_at: "2026-03-15T07:00:00+08:00",
        end_at: "2026-03-15T07:48:00+08:00",
        duration_minutes: 48,
        energy_burned: 180,
        distance_meters: 3500,
        avg_heart_rate: 110,
        source: "device",
        device_name: "Apple Watch",
        notes: "晨间快走",
        created_at: "2026-03-15T07:48:00+08:00",
      },
    ],
    conditions: [
      {
        id: "condition-1",
        member_id: memberId,
        category: "chronic",
        display_name: "高血压",
        clinical_status: "active",
        onset_date: "2020-01-01",
        source: "manual",
        notes: "长期监测",
        created_at: "2026-03-01T08:00:00+08:00",
        updated_at: "2026-03-01T08:00:00+08:00",
      },
    ],
    medications: [
      {
        id: "med-1",
        member_id: memberId,
        name: "降压药",
        indication: "控制血压",
        dosage_description: "早餐后 1 片",
        status: "active",
        start_date: "2025-01-01",
        end_date: null,
        source: "manual",
        created_at: "2026-03-01T08:00:00+08:00",
        updated_at: "2026-03-01T08:00:00+08:00",
      },
    ],
    encounters: [
      {
        id: "enc-1",
        member_id: memberId,
        type: "checkup",
        facility: "社区医院",
        department: "心内科",
        attending_physician: "李医生",
        date: "2026-03-10",
        summary: "复查血压",
        source: "manual",
        created_at: "2026-03-10T08:00:00+08:00",
        updated_at: "2026-03-10T08:00:00+08:00",
      },
    ],
    healthSummaries: createDashboard().members[1].health_summaries,
    carePlans: createDashboard().today_reminders,
  };
}

describe("App", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("renders login page when there is no session", () => {
    renderApp("/");
    expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  });

  it("renders dashboard using health summaries and reminders only", async () => {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(createSessionPayload()));

    fetchMock.mockImplementation(async (input) => {
      const pathname = requestPath(input);
      if (pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }
      throw new Error(`Unhandled request: ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByText("今日贴心提醒")).toBeInTheDocument();
    expect((await screen.findAllByText("慢病管理")).length).toBeGreaterThan(0);
    expect(screen.getByText("早餐后服药")).toBeInTheDocument();
    expect(screen.queryByText("等待活动记录")).not.toBeInTheDocument();
  });

  it("renders empty reminder state without future-phase wording", async () => {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(createSessionPayload()));

    fetchMock.mockImplementation(async (input) => {
      const pathname = requestPath(input);
      if (pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (pathname === "/api/dashboard") {
        return jsonResponse({
          ...createDashboard(),
          today_reminders: [],
        });
      }
      throw new Error(`Unhandled request: ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByText("今天还没有待办提醒")).toBeInTheDocument();
    expect(screen.queryByText(/后续 AI 阶段/)).not.toBeInTheDocument();
    expect(screen.getByText(/每日刷新时同步最新 AI 提醒/)).toBeInTheDocument();
  });

  it("opens member profile modal and loads current resources", async () => {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(createSessionPayload()));
    const detail = createProfileDetail("member-2");

    fetchMock.mockImplementation(async (input) => {
      const pathname = requestPath(input);
      if (pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }
      if (pathname === "/api/members/member-2") {
        return jsonResponse(detail.member);
      }
      if (pathname === "/api/members/member-2/observations") {
        return jsonResponse(detail.observations);
      }
      if (pathname === "/api/members/member-2/sleep-records") {
        return jsonResponse(detail.sleepRecords);
      }
      if (pathname === "/api/members/member-2/workout-records") {
        return jsonResponse(detail.workoutRecords);
      }
      if (pathname === "/api/members/member-2/conditions") {
        return jsonResponse(detail.conditions);
      }
      if (pathname === "/api/members/member-2/medications") {
        return jsonResponse(detail.medications);
      }
      if (pathname === "/api/members/member-2/encounters") {
        return jsonResponse(detail.encounters);
      }
      if (pathname === "/api/members/member-2/health-summaries") {
        return jsonResponse(detail.healthSummaries);
      }
      if (pathname === "/api/members/member-2/care-plans") {
        return jsonResponse(detail.carePlans);
      }
      throw new Error(`Unhandled request: ${pathname}`);
    });

    renderApp("/app");

    fireEvent.click(await screen.findByRole("button", { name: /张妈妈/ }));

    const dialog = await screen.findByRole("dialog", { name: "成员档案" });
    expect(within(dialog).getByText("基础信息")).toBeInTheDocument();
    expect(within(dialog).getByText("AI 健康摘要")).toBeInTheDocument();
    expect(within(dialog).getByText("今日提醒")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /健康数据/ }));

    expect(await within(dialog).findByText("慢病指标")).toBeInTheDocument();
    expect(within(dialog).getByText("睡眠")).toBeInTheDocument();
    expect(within(dialog).getByText("运动记录")).toBeInTheDocument();
  });

  it("streams chat draft cards and confirms them through confirm-draft endpoint", async () => {
    window.localStorage.setItem(sessionStorageKey, JSON.stringify(createSessionPayload()));

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }
      if (method === "POST" && pathname === "/api/chat/sessions") {
        return jsonResponse({
          id: "chat-1",
          user_id: "user-1",
          family_space_id: "family-1",
          member_id: "member-2",
          title: null,
          page_context: "home",
          created_at: "2026-03-15T08:00:00+08:00",
          updated_at: "2026-03-15T08:00:00+08:00",
        }, 201);
      }
      if (method === "POST" && pathname === "/api/chat/sessions/chat-1/messages") {
        return sseResponse([
          {
            event: "session.started",
            data: { session_id: "chat-1", member_id: "member-2" },
          },
          {
            event: "tool.draft",
            data: {
              tool_name: "draft_observations",
              tool_call_id: "tool-1",
              requires_confirmation: true,
              content: "已生成待确认草稿。",
              draft: {
                summary: "",
                observations: [
                  {
                    category: "body-vitals",
                    code: "heart-rate",
                    display_name: "心率",
                    value: 72,
                    unit: "bpm",
                    effective_at: "2026-03-15T08:00:00+08:00",
                  },
                ],
                conditions: [],
                medications: [],
                encounters: [],
              },
            },
          },
        ]);
      }
      if (method === "POST" && pathname === "/api/chat/chat-1/confirm-draft") {
        return jsonResponse({
          created_counts: {
            observations: 1,
            conditions: 0,
            medications: 0,
            encounters: 0,
          },
          assistant_message: "已将这条心率记录保存到健康档案。",
        });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    fireEvent.click(await screen.findByRole("button", { name: "对话" }));
    const dialog = await screen.findByRole("dialog", { name: "AI 健康助手" });

    fireEvent.change(within(dialog).getByLabelText("对话输入框"), {
      target: { value: "帮我记录张妈妈今天心率 72" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /发送/ }));

    expect(await within(dialog).findByText("待确认草稿")).toBeInTheDocument();
    expect(within(dialog).getByText("心率 72bpm")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "确认保存" }));

    expect(await within(dialog).findByText("已将这条心率记录保存到健康档案。")).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat/chat-1/confirm-draft"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
