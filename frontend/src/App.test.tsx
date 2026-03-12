import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";


function renderApp(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}


function createAuthResponse(name: string, email: string, role = "member", memberId = "member-1", userId = "user-1") {
  return {
    user: {
      id: userId,
      family_space_id: "family-1",
      email,
      role,
      created_at: "2026-03-11T00:00:00Z",
    },
    member: {
      id: memberId,
      family_space_id: "family-1",
      user_account_id: userId,
      name,
      gender: "unknown",
      birth_date: null,
      blood_type: null,
      allergies: [],
      medical_history: [],
      avatar_url: null,
      created_at: "2026-03-11T00:00:00Z",
      updated_at: "2026-03-11T00:00:00Z",
    },
    tokens: {
      access_token: "access-token",
      refresh_token: "refresh-token",
      token_type: "bearer",
    },
  };
}

function createMember(id: string, name: string, linkedUserId: string | null = null) {
  return {
    id,
    family_space_id: "family-1",
    user_account_id: linkedUserId,
    name,
    gender: "unknown",
    birth_date: null,
    blood_type: null,
    allergies: [],
    medical_history: [],
    avatar_url: null,
    created_at: "2026-03-11T00:00:00Z",
    updated_at: "2026-03-11T00:00:00Z",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
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

function createDashboard(memberName = "管理员") {
  return {
    members: [
      {
        member: {
          id: "member-1",
          name: memberName,
          gender: "unknown",
          avatar_url: null,
          blood_type: "O+",
        },
        latest_observations: {
          "body-weight": {
            code: "body-weight",
            display_name: "体重",
            value: 61.5,
            value_string: null,
            unit: "kg",
            effective_at: "2026-03-11T07:30:00+08:00",
          },
        },
        active_conditions: [],
        active_medications_count: 0,
        latest_encounter: null,
      },
      {
        member: {
          id: "member-2",
          name: "张妈妈",
          gender: "female",
          avatar_url: null,
          blood_type: "A+",
        },
        latest_observations: {
          "bp-systolic": {
            code: "bp-systolic",
            display_name: "收缩压",
            value: 126,
            value_string: null,
            unit: "mmHg",
            effective_at: "2026-03-11T08:00:00+08:00",
          },
          "step-count": {
            code: "step-count",
            display_name: "步数",
            value: 4800,
            value_string: null,
            unit: "steps",
            effective_at: "2026-03-11T11:20:00+08:00",
          },
          "blood-oxygen": {
            code: "blood-oxygen",
            display_name: "血氧",
            value: 97,
            value_string: null,
            unit: "%",
            effective_at: "2026-03-11T09:10:00+08:00",
          },
        },
        active_conditions: ["高血压"],
        active_medications_count: 1,
        latest_encounter: {
          id: "enc-1",
          member_id: "member-2",
          type: "outpatient",
          facility: "社区医院",
          department: "心内科",
          date: "2026-03-08",
          summary: "复诊并调整降压药",
          source: "manual",
          source_ref: null,
          created_at: "2026-03-08T10:00:00+08:00",
          updated_at: "2026-03-08T10:00:00+08:00",
        },
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
        scheduled_at: "2026-03-11T08:30:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-10T20:00:00+08:00",
        updated_at: "2026-03-10T20:00:00+08:00",
      },
      {
        id: "plan-2",
        member_id: "member-2",
        member_name: "张妈妈",
        category: "followup-reminder",
        title: "午后复诊",
        description: "14:30 前往社区医院",
        status: "active",
        scheduled_at: "2026-03-11T14:30:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-10T20:00:00+08:00",
        updated_at: "2026-03-10T20:00:00+08:00",
      },
      {
        id: "plan-3",
        member_id: "member-1",
        member_name: memberName,
        category: "daily-tip",
        title: "晚间散步",
        description: "饭后散步 20 分钟",
        status: "active",
        scheduled_at: "2026-03-11T20:15:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-10T20:00:00+08:00",
        updated_at: "2026-03-10T20:00:00+08:00",
      },
    ],
  };
}

function createObservation(overrides: Record<string, unknown> = {}) {
  return {
    id: "obs-default",
    member_id: "member-2",
    category: "vital-signs",
    code: "bp-systolic",
    display_name: "收缩压",
    value: 126,
    value_string: null,
    unit: "mmHg",
    effective_at: "2026-03-11T08:00:00+08:00",
    source: "manual",
    source_ref: null,
    notes: "早餐后测量",
    encounter_id: null,
    created_at: "2026-03-11T08:00:00+08:00",
    updated_at: "2026-03-11T08:00:00+08:00",
    ...overrides,
  };
}

function createMedication(overrides: Record<string, unknown> = {}) {
  return {
    id: "med-default",
    member_id: "member-2",
    medication_name: "缬沙坦",
    dosage: "每日一次，每次 1 片",
    status: "active",
    start_date: "2026-03-01",
    end_date: null,
    reason: "高血压",
    prescribed_by: "社区医院",
    source: "manual",
    source_ref: null,
    notes: "早餐后服用",
    encounter_id: null,
    created_at: "2026-03-01T08:00:00+08:00",
    updated_at: "2026-03-01T08:00:00+08:00",
    ...overrides,
  };
}

function createEncounter(overrides: Record<string, unknown> = {}) {
  return {
    id: "enc-default",
    member_id: "member-2",
    type: "outpatient",
    facility: "社区医院",
    department: "心内科",
    date: "2026-03-08",
    summary: "复诊并调整降压药",
    source: "manual",
    source_ref: null,
    created_at: "2026-03-08T14:30:00+08:00",
    updated_at: "2026-03-08T14:30:00+08:00",
    ...overrides,
  };
}

function mockApi(
  handler: (request: { method: string; pathname: string; search: string; bodyText: string; request: Request }) => Promise<Response> | Response,
) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    return handler({
      method: request.method,
      pathname: new URL(request.url).pathname,
      search: new URL(request.url).search,
      bodyText: request.method === "GET" ? "" : await request.text(),
      request,
    });
  });
}


describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects the root route to the login page", async () => {
    renderApp("/");

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "免费注册" })).toBeInTheDocument();
  });

  it("renders the register page with the shared auth style", async () => {
    renderApp("/register");

    expect(await screen.findByRole("heading", { name: "注册" })).toBeInTheDocument();
    expect(screen.getByLabelText("家庭成员昵称")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建账号" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回登录" })).toBeInTheDocument();
  });

  it("submits the login form and enters the app shell", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createAuthResponse("王医生", "owner@example.com", "admin")), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([createMember("member-1", "王医生", "user-1")]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(createDashboard("王医生")),
      );

    renderApp("/login");

    fireEvent.change(screen.getByLabelText("电子邮箱"), {
      target: { value: "owner@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "立即登录" }));

    expect(await screen.findByRole("heading", { name: "家庭健康管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    expect(screen.getByText("清晨的叮嘱")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/login",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(window.localStorage.getItem("homevital.session")).toContain("owner@example.com");
  });

  it("submits the register form and enters the app shell", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createAuthResponse("李阿姨", "member@example.com")), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([createMember("member-1", "李阿姨", "user-1")]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(createDashboard("李阿姨")),
      );

    renderApp("/register");

    fireEvent.change(screen.getByLabelText("家庭成员昵称"), {
      target: { value: "李阿姨" },
    });
    fireEvent.change(screen.getByLabelText("电子邮箱"), {
      target: { value: "member@example.com" },
    });
    fireEvent.change(screen.getByLabelText("密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.change(screen.getByLabelText("确认密码"), {
      target: { value: "Secret123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    expect(screen.getByText("早餐后服药")).toBeInTheDocument();
  });

  it("renders the phase 3 dashboard and keeps admin management actions available", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    let deleteMemberCount = 0;
    const fetchMock = mockApi(({ bodyText, method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "张妈妈", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("管理员"));
      }
      if (method === "POST" && pathname === "/api/members") {
        const payload = JSON.parse(bodyText) as { name: string };
        return jsonResponse(createMember("member-3", payload.name), 201);
      }
      if (method === "DELETE" && pathname === "/api/members/member-2") {
        deleteMemberCount += 1;
        return emptyResponse();
      }
      if (method === "DELETE" && pathname === "/api/family-space") {
        return emptyResponse();
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    expect(screen.getByText("清晨的叮嘱")).toBeInTheDocument();
    expect(screen.getByText("午后的守候")).toBeInTheDocument();
    expect(screen.getByText("晚间小结")).toBeInTheDocument();
    expect(screen.getByText("张妈妈")).toBeInTheDocument();
    expect(screen.getByText("2 位成员")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加成员" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除 张妈妈" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注销整个家庭空间" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("新成员姓名"), {
      target: { value: "奶奶" },
    });
    fireEvent.click(screen.getByRole("button", { name: "添加成员" }));
    expect((await screen.findAllByText("奶奶")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "删除 张妈妈" }));
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(deleteMemberCount).toBe(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "注销整个家庭空间" }));
    expect(await screen.findByRole("heading", { name: "注册" })).toBeInTheDocument();
    expect(window.localStorage.getItem("homevital.session")).toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/family-space",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("shows all family members to regular members without admin controls", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("普通成员", "member@example.com", "member", "member-2", "user-2")),
    );

    mockApi(({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "普通成员", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("普通成员"));
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect((await screen.findAllByText("管理员")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("普通成员").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加成员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "注销整个家庭空间" })).not.toBeInTheDocument();
  });

  it("opens the ai chat overlay from the dashboard composer and streams real chat events", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    mockApi(({ bodyText, method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "张妈妈", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("管理员"));
      }
      if (method === "POST" && pathname === "/api/chat/sessions") {
        return jsonResponse({
          id: "chat-session-1",
          user_id: "user-1",
          family_space_id: "family-1",
          member_id: null,
          title: null,
          page_context: "home",
          created_at: "2026-03-12T10:00:00+08:00",
          updated_at: "2026-03-12T10:00:00+08:00",
        }, 201);
      }
      if (method === "POST" && pathname === "/api/chat/sessions/chat-session-1/messages") {
        expect(JSON.parse(bodyText)).toMatchObject({
          content: "张妈妈今天胃口不错，心情也很好。",
          page_context: "home",
        });
        return sseResponse([
          { event: "session.started", data: { session_id: "chat-session-1", member_id: null } },
          { event: "tool.started", data: { tool_name: "read_member_summary" } },
          { event: "tool.result", data: { tool_name: "read_member_summary", content: "张妈妈：最新指标 血压平稳", requires_confirmation: false, meta: {} } },
          { event: "message.delta", data: { content: "我已经帮你整理好张妈妈今天的状态。" } },
          { event: "message.completed", data: { content: "我已经帮你整理好张妈妈今天的状态。" } },
        ]);
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("说说今天家人的健康情况..."), {
      target: { value: "张妈妈今天胃口不错，心情也很好。" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 AI 消息" }));

    expect(await screen.findByRole("dialog", { name: "AI 健康助手" })).toBeInTheDocument();
    expect(screen.getByText("张妈妈：最新指标 血压平稳")).toBeInTheDocument();
    expect(screen.getByText("张妈妈今天胃口不错，心情也很好。")).toBeInTheDocument();
    expect(screen.getByText("我已经帮你整理好张妈妈今天的状态。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "关闭 AI 对话" }));
    expect(screen.queryByRole("dialog", { name: "AI 健康助手" })).not.toBeInTheDocument();
  });

  it("transcribes uploaded audio into the chat draft", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    mockApi(({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([createMember("member-1", "管理员", "user-1")]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("管理员"));
      }
      if (method === "POST" && pathname === "/api/chat/transcriptions") {
        return jsonResponse({ text: "奶奶今天胃口不错" });
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开 AI 助手" }));
    expect(await screen.findByRole("dialog", { name: "AI 健康助手" })).toBeInTheDocument();

    const audioInput = screen.getByLabelText("上传语音") as HTMLInputElement;
    const file = new File(["audio"], "voice.wav", { type: "audio/wav" });
    fireEvent.change(audioInput, { target: { files: [file] } });

    expect(await screen.findByDisplayValue("奶奶今天胃口不错")).toBeInTheDocument();
  });

  it("requires selecting a member before uploading a chat attachment", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    const fetchMock = mockApi(({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "张妈妈", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("管理员"));
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "今日贴心提醒" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "打开 AI 助手" }));
    expect(await screen.findByRole("dialog", { name: "AI 健康助手" })).toBeInTheDocument();

    const attachmentInput = screen.getByLabelText("上传附件") as HTMLInputElement;
    const file = new File(["{}"], "report.json", { type: "application/json" });
    fireEvent.change(attachmentInput, { target: { files: [file] } });

    expect(await screen.findByText("请先选择成员再上传附件。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uploads and confirms extracted documents from the member profile", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    let observations = [createObservation()];
    let carePlans = [
      {
        id: "plan-1",
        member_id: "member-2",
        category: "daily-tip",
        title: "旧提醒",
        description: "旧描述",
        status: "active",
        scheduled_at: "2026-03-11T20:15:00+08:00",
        completed_at: null,
        generated_by: "manual",
        created_at: "2026-03-10T20:00:00+08:00",
        updated_at: "2026-03-10T20:00:00+08:00",
      },
    ];

    mockApi(({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "张妈妈", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/members/member-2") {
        return jsonResponse({
          ...createMember("member-2", "张妈妈", "user-2"),
          gender: "female",
          birth_date: "1961-03-08",
          blood_type: "A+",
          allergies: ["青霉素"],
          medical_history: ["高血压"],
        });
      }
      if (method === "GET" && pathname === "/api/members/member-2/observations") {
        return jsonResponse(observations);
      }
      if (method === "GET" && pathname === "/api/members/member-2/conditions") {
        return jsonResponse([]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/medications") {
        return jsonResponse([]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/encounters") {
        return jsonResponse([]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/care-plans") {
        return jsonResponse(carePlans);
      }
      if (method === "POST" && pathname === "/api/members/member-2/documents/upload") {
        return jsonResponse({
          id: "doc-1",
          member_id: "member-2",
          uploaded_by: "user-1",
          doc_type: "checkup-report",
          file_path: "uploads/member-2/report.json",
          file_name: "report.json",
          mime_type: "application/json",
          extraction_status: "completed",
          extracted_at: "2026-03-12T10:00:00+08:00",
          raw_extraction: {
            summary: "体检报告显示血压略高。",
            observations: [
              {
                category: "vital-signs",
                code: "bp-systolic",
                display_name: "收缩压",
                value: 132,
                value_string: null,
                unit: "mmHg",
                effective_at: "2026-03-12T08:00:00+08:00",
                notes: null,
                encounter_id: null,
              },
            ],
            conditions: [],
            medications: [],
            encounters: [],
            care_plans: [
              {
                category: "followup-reminder",
                title: "继续监测血压",
                description: "未来 3 天持续记录晨间血压",
                status: "active",
                scheduled_at: "2026-03-13T08:00:00+08:00",
                completed_at: null,
                generated_by: "ai",
              },
            ],
          },
          created_at: "2026-03-12T10:00:00+08:00",
          updated_at: "2026-03-12T10:00:00+08:00",
        }, 201);
      }
      if (method === "GET" && pathname === "/api/documents/doc-1/extraction") {
        return jsonResponse({
          id: "doc-1",
          member_id: "member-2",
          file_name: "report.json",
          doc_type: "checkup-report",
          extraction_status: "completed",
          extracted_at: "2026-03-12T10:00:00+08:00",
          raw_extraction: {
            summary: "体检报告显示血压略高。",
            observations: [
              {
                category: "vital-signs",
                code: "bp-systolic",
                display_name: "收缩压",
                value: 132,
                value_string: null,
                unit: "mmHg",
                effective_at: "2026-03-12T08:00:00+08:00",
                notes: null,
                encounter_id: null,
              },
            ],
            conditions: [],
            medications: [],
            encounters: [],
            care_plans: [
              {
                category: "followup-reminder",
                title: "继续监测血压",
                description: "未来 3 天持续记录晨间血压",
                status: "active",
                scheduled_at: "2026-03-13T08:00:00+08:00",
                completed_at: null,
                generated_by: "ai",
              },
            ],
          },
        });
      }
      if (method === "POST" && pathname === "/api/documents/doc-1/confirm") {
        observations = [
          createObservation({
            id: "obs-new",
            value: 132,
            effective_at: "2026-03-12T08:00:00+08:00",
            source: "document-extract",
            source_ref: "doc-1",
          }),
          ...observations,
        ];
        carePlans = [
          {
            id: "plan-new",
            member_id: "member-2",
            category: "followup-reminder",
            title: "继续监测血压",
            description: "未来 3 天持续记录晨间血压",
            status: "active",
            scheduled_at: "2026-03-13T08:00:00+08:00",
            completed_at: null,
            generated_by: "ai",
            created_at: "2026-03-12T10:00:00+08:00",
            updated_at: "2026-03-12T10:00:00+08:00",
          },
          ...carePlans,
        ];
        return jsonResponse({
          document_id: "doc-1",
          created_counts: {
            observations: 1,
            conditions: 0,
            medications: 0,
            encounters: 0,
            care_plans: 1,
          },
        });
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app/members/member-2");

    expect(await screen.findByRole("heading", { name: "张妈妈" })).toBeInTheDocument();

    const uploadInput = screen.getByLabelText("上传健康文档") as HTMLInputElement;
    fireEvent.change(uploadInput, {
      target: {
        files: [new File(["{}"], "report.json", { type: "application/json" })],
      },
    });

    expect(await screen.findByText("体检报告显示血压略高。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认抽取并入库" }));

    expect(await screen.findByText("已写入 1 条指标和 1 条提醒。")).toBeInTheDocument();
    expect(await screen.findByText("继续监测血压")).toBeInTheDocument();
  });

  it("renders the member profile and records a new observation", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    let lastObservationPayload: Record<string, unknown> | null = null;
    mockApi(({ bodyText, method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([
          createMember("member-1", "管理员", "user-1"),
          createMember("member-2", "张妈妈", "user-2"),
        ]);
      }
      if (method === "GET" && pathname === "/api/members/member-2") {
        return jsonResponse({
          ...createMember("member-2", "张妈妈", "user-2"),
          gender: "female",
          birth_date: "1961-03-08",
          blood_type: "A+",
          allergies: ["青霉素"],
          medical_history: ["高血压"],
        });
      }
      if (method === "GET" && pathname === "/api/members/member-2/observations") {
        return jsonResponse([
          createObservation(),
          createObservation({
            id: "obs-weight",
            code: "body-weight",
            display_name: "体重",
            value: 58.2,
            unit: "kg",
            effective_at: "2026-03-10T07:20:00+08:00",
            notes: "晨起测量",
          }),
          createObservation({
            id: "obs-step",
            category: "activity",
            code: "step-count",
            display_name: "步数",
            value: 6200,
            unit: "steps",
            effective_at: "2026-03-10T20:00:00+08:00",
            notes: "全天活动",
          }),
        ]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/conditions") {
        return jsonResponse([
          {
            id: "cond-1",
            member_id: "member-2",
            category: "chronic",
            code: "hypertension",
            display_name: "高血压",
            clinical_status: "active",
            onset_date: "2020-05-01",
            abatement_date: null,
            severity: "moderate",
            source: "manual",
            source_ref: null,
            notes: "定期复诊",
            encounter_id: null,
            created_at: "2026-03-01T08:00:00+08:00",
            updated_at: "2026-03-01T08:00:00+08:00",
          },
        ]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/medications") {
        return jsonResponse([createMedication()]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/encounters") {
        return jsonResponse([createEncounter()]);
      }
      if (method === "GET" && pathname === "/api/members/member-2/care-plans") {
        return jsonResponse([]);
      }
      if (method === "POST" && pathname === "/api/members/member-2/observations") {
        lastObservationPayload = JSON.parse(bodyText) as Record<string, unknown>;
        return jsonResponse(
          createObservation({
            id: "obs-new",
            code: lastObservationPayload.code,
            display_name: lastObservationPayload.display_name,
            value: lastObservationPayload.value,
            unit: lastObservationPayload.unit,
            effective_at: lastObservationPayload.effective_at,
            notes: lastObservationPayload.notes,
          }),
          201,
        );
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app/members/member-2");

    expect(await screen.findByRole("heading", { name: "张妈妈" })).toBeInTheDocument();
    expect(screen.getByText("当前用药")).toBeInTheDocument();
    expect(screen.getByText("就医时间线")).toBeInTheDocument();
    expect(screen.getByText("手动录入")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("指标编码"), {
      target: { value: "heart-rate" },
    });
    fireEvent.change(screen.getByLabelText("指标名称"), {
      target: { value: "心率" },
    });
    fireEvent.change(screen.getByLabelText("数值"), {
      target: { value: "72" },
    });
    fireEvent.change(screen.getByLabelText("单位"), {
      target: { value: "bpm" },
    });
    fireEvent.change(screen.getByLabelText("测量时间"), {
      target: { value: "2026-03-11T19:15" },
    });
    fireEvent.change(screen.getByLabelText("备注"), {
      target: { value: "晚饭后补录" },
    });
    fireEvent.click(screen.getByRole("button", { name: "记录指标" }));

    expect(await screen.findByText("晚饭后补录")).toBeInTheDocument();
    expect(lastObservationPayload).toMatchObject({
      code: "heart-rate",
      display_name: "心率",
      value: 72,
      unit: "bpm",
      notes: "晚饭后补录",
    });
  });

  it("returns to the login page after signing out", async () => {
    window.localStorage.setItem(
      "homevital.session",
      JSON.stringify(createAuthResponse("管理员", "owner@example.com", "admin")),
    );

    mockApi(({ method, pathname }) => {
      if (method === "GET" && pathname === "/api/members") {
        return jsonResponse([createMember("member-1", "管理员", "user-1")]);
      }
      if (method === "GET" && pathname === "/api/dashboard") {
        return jsonResponse(createDashboard("管理员"));
      }
      throw new Error(`Unexpected request: ${method} ${pathname}`);
    });

    renderApp("/app");

    expect(await screen.findByRole("heading", { name: "家庭健康管理" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "退出" }));

    expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
    expect(window.localStorage.getItem("homevital.session")).toBeNull();
  });
});
