import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { sessionStorageKey } from "./auth/session";
import { PreferencesProvider } from "./preferences";

function renderApp(initialPath = "/") {
  return render(
    <PreferencesProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </PreferencesProvider>,
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
    .map(
      (item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`,
    )
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function chunkedSseResponse(
  firstEvents: Array<{ event: string; data: unknown }>,
  restEvents: Array<{ event: string; data: unknown }>,
  waitForRest: Promise<void>,
) {
  const encoder = new TextEncoder();
  const firstChunk = firstEvents
    .map(
      (item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`,
    )
    .join("");
  const restChunk = restEvents
    .map(
      (item) => `event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`,
    )
    .join("");

  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(firstChunk));
      await waitForRest;
      controller.enqueue(encoder.encode(restChunk));
      controller.close();
    },
  });

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

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  if (input instanceof Request) {
    return input.headers;
  }
  return new Headers(init?.headers);
}

function createJwt(expOffsetSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const payload = btoa(JSON.stringify({ exp: now + expOffsetSeconds }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `header.${payload}.signature`;
}

function createSessionPayload(
  overrides?: Partial<{ accessToken: string; refreshToken: string }>,
) {
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
      permission_level: "manage",
    },
    tokens: {
      access_token: overrides?.accessToken ?? createJwt(3600),
      refresh_token: overrides?.refreshToken ?? "refresh-token",
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
      permission_level: "manage",
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
      permission_level: "none",
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
            status: "warning",
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
            status: "alert",
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
        assignee_member_id: "member-2",
        category: "medication-reminder",
        icon_key: "medication",
        time_slot: "清晨",
        title: "早餐后服药",
        description: "08:30 服用降压药",
        notes: "饭后服用",
        status: "active",
        scheduled_at: "2026-03-15T08:30:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-14T20:00:00+08:00",
        updated_at: "2026-03-14T20:00:00+08:00",
      },
    ],
    reminder_groups: [
      {
        time_slot: "清晨",
        reminders: [
          {
            id: "plan-1",
            member_id: "member-2",
            member_name: "张妈妈",
            assignee_member_id: "member-2",
            category: "medication-reminder",
            icon_key: "medication",
            time_slot: "清晨",
            title: "早餐后服药",
            description: "08:30 服用降压药",
            notes: "饭后服用",
            status: "active",
            scheduled_at: "2026-03-15T08:30:00+08:00",
            completed_at: null,
            generated_by: "manual",
            created_at: "2026-03-14T20:00:00+08:00",
            updated_at: "2026-03-14T20:00:00+08:00",
          },
        ],
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
      permission_level: "read",
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
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

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

    expect(await screen.findByText("家人状态")).toBeInTheDocument();
    expect((await screen.findAllByText("慢病管理")).length).toBeGreaterThan(0);
    expect(screen.getByText("早餐后服药")).toBeInTheDocument();
    expect(screen.queryByText("等待活动记录")).not.toBeInTheDocument();
  });

  it("renders empty reminder state without future-phase wording", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

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

  it("switches language and theme from preferences with immediate app-wide effect", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      if (pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }
      if (pathname === "/api/admin/settings" && (!init?.method || init.method === "GET")) {
        return jsonResponse({
          health_summary_refresh_time: "05:00",
          care_plan_refresh_time: "06:00",
        });
      }
      throw new Error(`Unhandled request: ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByText("家人状态")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "用户菜单" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /设置/ }));
    fireEvent.click(await screen.findByRole("button", { name: "偏好" }));
    fireEvent.click(await screen.findByRole("button", { name: "English" }));

    expect(await screen.findByText("Family Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Language" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("opens member profile modal and loads current resources", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );
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

    fireEvent.click(
      await screen.findByRole("button", { name: /查看 张妈妈 档案/ }),
    );

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
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

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
        return jsonResponse(
          {
            id: "chat-1",
            user_id: "user-1",
            family_space_id: "family-1",
            member_id: "member-2",
            title: null,
            summary: null,
            page_context: "home",
            created_at: "2026-03-15T08:00:00+08:00",
            updated_at: "2026-03-15T08:00:00+08:00",
          },
          201,
        );
      }
      if (
        method === "POST" &&
        pathname === "/api/chat/sessions/chat-1/messages"
      ) {
        return sseResponse([
          {
            event: "session.started",
            data: { session_id: "chat-1", member_id: "member-2" },
          },
          {
            event: "tool.draft",
            data: {
              tool_name: "draft_health_record_actions",
              tool_call_id: "tool-1",
              requires_confirmation: true,
              content: "已生成待确认草稿。",
              draft: {
                summary: "",
                actions: [
                  {
                    action: "create",
                    resource: "observations",
                    target_member_id: "member-2",
                    payload: {
                      category: "body-vitals",
                      code: "heart-rate",
                      display_name: "心率",
                      value: 72,
                      unit: "bpm",
                      effective_at: "2026-03-15T08:00:00+08:00",
                    },
                  },
                ],
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

    fireEvent.click(await screen.findByRole("button", { name: "历史会话" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建会话" }));
    const dialog = await screen.findByRole("dialog", { name: "AI 健康助手" });

    fireEvent.change(within(dialog).getByLabelText("对话输入框"), {
      target: { value: "帮我记录张妈妈今天心率 72" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /发送/ }));

    expect(await within(dialog).findByText("待确认草稿")).toBeInTheDocument();
    expect(within(dialog).getByText("心率 72bpm")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "确认保存" }));

    expect(
      await within(dialog).findByText("已将这条心率记录保存到健康档案。"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/chat/chat-1/confirm-draft"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("renders assistant text before the SSE stream completes", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

    let releaseStream!: () => void;
    const waitForRest = new Promise<void>((resolve) => {
      releaseStream = resolve;
    });

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
        return jsonResponse(
          {
            id: "chat-1",
            user_id: "user-1",
            family_space_id: "family-1",
            member_id: "member-2",
            title: null,
            summary: null,
            page_context: "home",
            created_at: "2026-03-15T08:00:00+08:00",
            updated_at: "2026-03-15T08:00:00+08:00",
          },
          201,
        );
      }
      if (
        method === "POST" &&
        pathname === "/api/chat/sessions/chat-1/messages"
      ) {
        return chunkedSseResponse(
          [
            {
              event: "session.started",
              data: { session_id: "chat-1", member_id: "member-2" },
            },
            {
              event: "message.delta",
              data: { content: "奶奶今天血压整体稳定，" },
            },
          ],
          [
            {
              event: "message.delta",
              data: { content: "晚间继续按时服药即可。" },
            },
            {
              event: "message.completed",
              data: { content: "奶奶今天血压整体稳定，晚间继续按时服药即可。" },
            },
          ],
          waitForRest,
        );
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    fireEvent.click(await screen.findByRole("button", { name: "历史会话" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建会话" }));
    const dialog = await screen.findByRole("dialog", { name: "AI 健康助手" });

    fireEvent.change(within(dialog).getByLabelText("对话输入框"), {
      target: { value: "总结一下奶奶今天情况" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /发送/ }));

    expect(await within(dialog).findByText("奶奶今天血压整体稳定，")).toBeInTheDocument();
    expect(within(dialog).queryByText("晚间继续按时服药即可。")).not.toBeInTheDocument();

    releaseStream();

    expect(
      await within(dialog).findByText("奶奶今天血压整体稳定，晚间继续按时服药即可。"),
    ).toBeInTheDocument();
  });

  it("opens chat without a preset assistant intro message", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    fireEvent.click(await screen.findByRole("button", { name: "历史会话" }));
    fireEvent.click(await screen.findByRole("button", { name: "新建会话" }));
    await screen.findByRole("dialog", { name: "AI 健康助手" });

    expect(
      screen.queryByText(
        "您好，我是 HomeVital 助手。请先选择成员，或直接询问当前的健康摘要与提醒。",
      ),
    ).not.toBeInTheDocument();
  });

  it("submits remember_me when the login checkbox is selected", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && pathname === "/api/auth/login") {
        expect(JSON.parse(String(init?.body))).toEqual({
          email: "owner@example.com",
          password: "Secret123!",
          remember_me: true,
        });
        return jsonResponse(createSessionPayload());
      }
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/login");

    fireEvent.change(screen.getByLabelText("电子邮箱"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByLabelText("记住我的登录状态"));
    fireEvent.click(screen.getByRole("button", { name: "立即登录" }));

    expect(await screen.findByText("家人状态")).toBeInTheDocument();
  });

  it("refreshes an expired stored session before loading protected data", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(
        createSessionPayload({
          accessToken: createJwt(-60),
          refreshToken: "refresh-token",
        }),
      ),
    );

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";
      const authorization = requestHeaders(input, init).get("Authorization");

      if (method === "POST" && pathname === "/api/auth/refresh") {
        expect(JSON.parse(String(init?.body))).toEqual({
          refresh_token: "refresh-token",
        });
        return jsonResponse({
          access_token: "fresh-access-token",
          refresh_token: "fresh-refresh-token",
          token_type: "bearer",
        });
      }
      if (method === "GET" && pathname === "/api/members") {
        expect(authorization).toBe("Bearer fresh-access-token");
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        expect(authorization).toBe("Bearer fresh-access-token");
        return jsonResponse(createDashboard());
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByText("家人状态")).toBeInTheDocument();

    const persistedSession = JSON.parse(
      window.localStorage.getItem(sessionStorageKey) ?? "{}",
    );
    expect(persistedSession.tokens.access_token).toBe("fresh-access-token");
    expect(persistedSession.tokens.refresh_token).toBe("fresh-refresh-token");
  });

  it("retries concurrent unauthorized requests after a single refresh", async () => {
    const staleAccessToken = createJwt(3600);
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(
        createSessionPayload({
          accessToken: staleAccessToken,
          refreshToken: "refresh-token",
        }),
      ),
    );

    let refreshCount = 0;
    let activeAccessToken = staleAccessToken;

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";
      const authorization = requestHeaders(input, init).get("Authorization");

      if (method === "POST" && pathname === "/api/auth/refresh") {
        refreshCount += 1;
        activeAccessToken = "fresh-access-token";
        return jsonResponse({
          access_token: "fresh-access-token",
          refresh_token: "fresh-refresh-token",
          token_type: "bearer",
        });
      }
      if (method === "GET" && pathname === "/api/members") {
        if (authorization === `Bearer ${staleAccessToken}`) {
          return jsonResponse({ detail: "Token expired." }, 401);
        }
        expect(authorization).toBe(`Bearer ${activeAccessToken}`);
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        if (authorization === `Bearer ${staleAccessToken}`) {
          return jsonResponse({ detail: "Token expired." }, 401);
        }
        expect(authorization).toBe(`Bearer ${activeAccessToken}`);
        return jsonResponse(createDashboard());
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByText("家人状态")).toBeInTheDocument();
    expect(refreshCount).toBe(1);
  });

  it("clears the stored session when refresh fails on app boot", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(
        createSessionPayload({
          accessToken: createJwt(-60),
          refreshToken: "expired-refresh-token",
        }),
      ),
    );

    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";

      if (method === "POST" && pathname === "/api/auth/refresh") {
        return jsonResponse({ detail: "Token expired." }, 401);
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(
      await screen.findByRole("heading", { name: "登录" }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(sessionStorageKey)).toBeNull();
  });

  it("handles edit mode permissions and CRUD operations for MemberProfileModal", async () => {
    window.localStorage.setItem(
      sessionStorageKey,
      JSON.stringify(createSessionPayload()),
    );

    let createSleepCount = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const pathname = requestPath(input);
      const method = init?.method ?? "GET";

      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse(createMembers());
      }
      if (method === "GET" && pathname === "/api/members/member-2") {
        return jsonResponse(createMembers()[1]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard());
      }
      if (method === "GET" && (
        pathname.endsWith("/observations") ||
        pathname.endsWith("/sleep-records") ||
        pathname.endsWith("/workout-records") ||
        pathname.endsWith("/conditions") ||
        pathname.endsWith("/medications") ||
        pathname.endsWith("/encounters") ||
        pathname.endsWith("/health-summaries") ||
        pathname.endsWith("/care-plans")
      )) {
        return jsonResponse([]);
      }
      if (method === "POST" && pathname.endsWith("/sleep-records")) {
        createSleepCount += 1;
        return jsonResponse({ id: "sleep-1" });
      }

      throw new Error(`Unhandled request: ${method} ${pathname}`);
    });

    renderApp("/app");

    // Click member card to open Profile
    const openProfileBtn = await screen.findByRole("button", { name: "查看 张妈妈 档案" });
    fireEvent.click(openProfileBtn);
    
    // Await for dialog to open
    let dialog: HTMLElement;
    try {
      dialog = await screen.findByRole("dialog", { name: "成员档案" });
    } catch (e) {
      screen.debug();
      throw e;
    }
    expect(dialog).toBeInTheDocument();

    // The user 'owner@example.com' has role='admin' and member 'member-1' has permission 'manage'
    // Edit mode toggle should be visible
    const editToggle = await within(dialog).findByRole("checkbox");
    expect(editToggle).toBeInTheDocument();

    // Activate edit mode
    fireEvent.click(editToggle);

    // Navigate to Health Data tab
    fireEvent.click(within(dialog).getByText("健康数据"));

    // Find the add button inside the sleep section
    const addButton = await within(dialog).findAllByRole("button", { name: /新增/ });
    fireEvent.click(addButton[0]);

    // ResourceFormModal opens
    const formDialog = await screen.findByRole("dialog", { name: /新增.*记录/ });
    expect(formDialog).toBeInTheDocument();

    // Fill the inputs (start, end)
    const inputs = formDialog.querySelectorAll('input[type="datetime-local"]');
    if (inputs.length >= 2) {
      fireEvent.change(inputs[0], { target: { value: "2026-03-15T22:00" } });
      fireEvent.change(inputs[1], { target: { value: "2026-03-16T06:00" } });
    }

    // Submit form
    fireEvent.click(within(formDialog).getByRole("button", { name: "保存" }));

    // Verify API called
    await waitFor(() => {
      expect(createSleepCount).toBe(1);
    });
  });
});
