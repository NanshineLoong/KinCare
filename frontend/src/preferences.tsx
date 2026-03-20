import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";


export type AppLanguage = "zh" | "en";
export type AppTheme = "light" | "dark" | "system";

type TemplateVariables = Record<string, string | number>;
type TranslationValue = string | ((variables?: TemplateVariables) => string);

type PreferencesContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  resolvedTheme: "light" | "dark";
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
};

const translations = {
  zh: {
    appShellFamilyDashboard: "家庭仪表盘",
    appShellMemberProfile: "成员档案",
    appShellHistory: "历史会话",
    appShellNewSession: "新建会话",
    appShellLoading: "加载中...",
    appShellNoSessions: "暂无历史会话",
    appShellUntitledSession: "未命名会话",
    appShellUserMenu: "用户菜单",
    appShellAdmin: "管理员",
    appShellMember: "家庭成员",
    appShellSettings: "设置",
    appShellSignOut: "退出登录",
    appShellJustNow: "刚刚",
    appShellMinutesAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 分钟前`,
    appShellHoursAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 小时前`,
    appShellYesterday: "昨天",
    appShellDaysAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 天前`,
    appShellHomeSuffix: "的家",
    appShellTodayCare: "今日温馨守护中",
    settingsTitle: "设置",
    settingsTabPreferences: "偏好",
    settingsTabMembers: "成员管理",
    settingsTabAdmin: "管理员配置",
    settingsClose: "关闭设置",
    settingsSidebarDescription: "管理您的家庭账户",
    settingsPreferencesEyebrow: "偏好",
    settingsPreferencesTitle: "偏好设置",
    settingsPreferencesDescription: "自定义当前设备上的语言设置，切换后即时生效。",
    settingsSectionLanguage: "语言",
    settingsSectionLanguageDescription: "切换当前设备上的界面语言，保存到本地浏览器。",
    settingsLanguageCardTitle: "通用设置",
    settingsLanguageCardDescription: "语言偏好",
    settingsLanguageInstant: "语言切换后即时生效",
    settingsLanguageCurrentTag: "当前系统语言",
    settingsLanguageEnglishTag: "英语",
    settingsSectionAppearance: "外观",
    settingsSectionAppearanceDescription: "切换浅色、深色或跟随系统主题。",
    settingsMembersEyebrow: "成员管理",
    settingsMembersTitle: "家庭成员与权限",
    settingsMembersDescription: "管理家庭圈的成员、绑定状态与数据可见范围。",
    settingsMembersAdd: "添加新成员",
    settingsMembersNamePlaceholder: "成员姓名",
    settingsMembersAddCancel: "取消",
    settingsMembersAddSubmit: "确认添加",
    settingsMembersAddSubmitting: "添加中...",
    settingsMembersDeleteMember: "删除成员",
    settingsMembersDeleteMemberAria: (variables?: TemplateVariables) =>
      `删除成员 ${variables?.name ?? ""}`,
    settingsMembersDeleteConfirm: (variables?: TemplateVariables) =>
      `确定要删除成员「${String(variables?.name ?? "")}」吗？此操作不可撤销。`,
    settingsMembersDeleteError: "删除成员失败，请稍后重试。",
    settingsAdminEyebrow: "管理员配置",
    settingsAdminTitle: "系统运行配置",
    settingsAdminDescription: "配置系统核心参数、更新频率及 AI 模型服务，保存后后续请求会直接使用最新设置。",
    settingsAdminScheduleTitle: "每日更新节奏",
    settingsAdminScheduleDescription: "设置每日计划和健康状态的自动更新时间。",
    settingsTimeHealthSummaryDescription: "控制成员健康摘要的每日生成时间。",
    settingsTimeCarePlanDescription: "控制首页与成员页提醒计划的每日生成时间。",
    settingsAdminScheduleHint: "调度保存后会在后续生成任务中生效。",
    settingsLanguageChinese: "中文",
    settingsLanguageEnglish: "English",
    settingsThemeLight: "浅色",
    settingsThemeDark: "深色",
    settingsThemeSystem: "跟随系统",
    settingsTimeHealthSummary: "每日健康状态更新时间",
    settingsTimeCarePlan: "每日计划更新时间",
    settingsTimeSave: "保存时间设置",
    settingsTimeSaving: "保存中...",
    settingsTimeSaved: "刷新时间已更新。",
    settingsTimeAdminOnly: "仅管理员可配置每日刷新时间。",
    settingsTimeLoadError: "时间配置加载失败，请稍后重试。",
    settingsTimeSaveError: "时间配置保存失败，请稍后重试。",
    settingsAiEyebrow: "AI 配置",
    settingsAiTitle: "运行时模型与转录参数",
    settingsAiDescription: "配置对话模型与语音转录参数，保存后下一次对话或转录请求立即生效。",
    settingsAiSave: "保存 AI 配置",
    settingsAiSaving: "保存中...",
    settingsAiSaved: "AI 配置已更新。",
    settingsAiLoadError: "AI 配置加载失败，请稍后重试。",
    settingsAiSaveError: "AI 配置保存失败，请稍后重试。",
    settingsAiSectionTranscription: "语音转录",
    settingsAiSectionTranscriptionDescription: "配置 STT provider、语言、模型和超时参数。",
    settingsAiSectionChatModel: "对话模型",
    settingsAiSectionChatModelDescription: "配置聊天与日更生成复用的 OpenAI-compatible 模型参数。",
    settingsAiTranscriptionProvider: "转录 Provider",
    settingsAiTranscriptionProviderOpenAI: "OpenAI API",
    settingsAiTranscriptionProviderLocal: "本地 Whisper 模型",
    settingsAiProviderSwitched: "转录提供商已更新。",
    settingsAiTranscriptionApiKey: "转录 API Key",
    settingsAiTranscriptionModel: "转录模型",
    settingsAiTranscriptionLanguage: "转录语言",
    settingsAiTranscriptionTimeout: "转录超时时间（秒）",
    settingsAiLocalWhisperModel: "Local Whisper 模型",
    settingsAiLocalWhisperDevice: "Local Whisper 设备",
    settingsAiLocalWhisperComputeType: "Local Whisper 精度",
    settingsAiLocalWhisperDownloadRoot: "Local Whisper 下载目录",
    settingsAiChatBaseUrl: "对话 Base URL",
    settingsAiChatApiKey: "对话 API Key",
    settingsAiChatModel: "对话模型",
    homeFamilyStatus: "家人状态",
    homeTodayReminders: "今日提醒",
    homeRefresh: "刷新",
    homeRefreshing: "刷新中…",
    homeComposerPlaceholder: "说说今天家人的健康情况...",
    loginTitle: "登录",
    loginDescription: "欢迎回到您的个人健康中心",
    loginAlternateLabel: "还没有账号？",
    loginAlternateAction: "免费注册",
    loginRemember: "记住我的登录状态",
    loginSubmit: "立即登录",
    loginEmail: "电子邮箱",
    loginPassword: "密码",
    loginEmailPlaceholder: "请输入您的邮箱地址",
    loginPasswordPlaceholder: "请输入您的登录密码",
    loginShowPassword: "显示密码",
    loginHidePassword: "隐藏密码",
    loginFallbackError: "登录失败，请重试。",
    registerTitle: "注册",
    registerDescription: "创建属于您家庭的健康管理空间",
    registerAlternateLabel: "已经有账号？",
    registerAlternateAction: "返回登录",
    registerSubmit: "创建账号",
    registerName: "家庭成员昵称",
    registerEmail: "电子邮箱",
    registerPassword: "密码",
    registerConfirmPassword: "确认密码",
    registerNamePlaceholder: "例如：李阿姨",
    registerEmailPlaceholder: "请输入您的邮箱地址",
    registerPasswordPlaceholder: "至少 8 位密码",
    registerConfirmPasswordPlaceholder: "请再次输入密码",
    registerPasswordMismatch: "两次输入的密码不一致。",
    registerFallbackError: "注册失败，请重试。",
    authBrand: "家庭健康管理助手",
    authSubmitting: "处理中...",
    authFooter: "© 2026 家庭健康管理助手. 您的健康，我们的承诺.",
    chatInputLabel: "对话输入框",
    chatInputAddAttachment: "添加附件",
    chatInputNoMember: "自动识别成员",
    chatInputFocusMember: (variables?: TemplateVariables) =>
      `当前咨询人：${variables?.member ?? ""}`,
    chatInputAutoMember: "自动识别咨询人",
    chatInputCancelVoice: "取消录音",
    chatInputFinishVoice: "结束录音并发送",
    chatInputVoice: "语音输入",
    chatInputSend: "发送文本",
    chatInputMicError: (variables?: TemplateVariables) =>
      `无法访问麦克风: ${variables?.message ?? ""}`,
    chatFocusSwitched: (variables?: TemplateVariables) =>
      `已切换咨询人到${variables?.member ?? ""}`,
    chatFocusInferred: (variables?: TemplateVariables) =>
      `已自动识别当前咨询人为${variables?.member ?? ""}`,
    chatOverlayLabel: "AI 健康助手",
    chatOverlayUploadAudio: "上传语音",
    chatOverlayClose: "关闭 AI 对话",
    chatOverlayDraft: "待确认草稿",
    chatOverlayAnalysis: "分析结果",
  },
  en: {
    appShellFamilyDashboard: "Family Dashboard",
    appShellMemberProfile: "Member Profile",
    appShellHistory: "Session History",
    appShellNewSession: "New Session",
    appShellLoading: "Loading...",
    appShellNoSessions: "No session history yet",
    appShellUntitledSession: "Untitled session",
    appShellUserMenu: "User menu",
    appShellAdmin: "Admin",
    appShellMember: "Family member",
    appShellSettings: "Settings",
    appShellSignOut: "Sign out",
    appShellJustNow: "Just now",
    appShellMinutesAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} min ago`,
    appShellHoursAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} hr ago`,
    appShellYesterday: "Yesterday",
    appShellDaysAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} days ago`,
    appShellHomeSuffix: "'s home",
    appShellTodayCare: "Caring for today",
    settingsTitle: "Settings",
    settingsTabPreferences: "Preferences",
    settingsTabMembers: "Members",
    settingsTabAdmin: "Admin Config",
    settingsClose: "Close settings",
    settingsSidebarDescription: "Manage your household account",
    settingsPreferencesEyebrow: "Preferences",
    settingsPreferencesTitle: "Personal preferences",
    settingsPreferencesDescription: "Customize this device's language with immediate effect.",
    settingsSectionLanguage: "Language",
    settingsSectionLanguageDescription: "Switch the interface language for this browser and save it locally.",
    settingsLanguageCardTitle: "General settings",
    settingsLanguageCardDescription: "Language preference",
    settingsLanguageInstant: "Language changes apply immediately",
    settingsLanguageCurrentTag: "Current system language",
    settingsLanguageEnglishTag: "English",
    settingsSectionAppearance: "Appearance",
    settingsSectionAppearanceDescription: "Choose light, dark, or follow the system theme.",
    settingsMembersEyebrow: "Members",
    settingsMembersTitle: "Household members and permissions",
    settingsMembersDescription: "Manage household members, account binding, and data visibility ranges.",
    settingsMembersAdd: "Add member",
    settingsMembersNamePlaceholder: "Member name",
    settingsMembersAddCancel: "Cancel",
    settingsMembersAddSubmit: "Add member",
    settingsMembersAddSubmitting: "Adding...",
    settingsMembersDeleteMember: "Remove member",
    settingsMembersDeleteMemberAria: (variables?: TemplateVariables) =>
      `Remove member ${variables?.name ?? ""}`,
    settingsMembersDeleteConfirm: (variables?: TemplateVariables) =>
      `Remove member “${String(variables?.name ?? "")}”? This cannot be undone.`,
    settingsMembersDeleteError: "Could not remove the member. Please try again.",
    settingsAdminEyebrow: "Admin Config",
    settingsAdminTitle: "Runtime configuration",
    settingsAdminDescription: "Configure core system timings and AI services. Saved values apply to subsequent requests immediately.",
    settingsAdminScheduleTitle: "Daily schedule",
    settingsAdminScheduleDescription: "Set when daily plans and health status refresh automatically.",
    settingsTimeHealthSummaryDescription: "Controls when member health summaries are generated each day.",
    settingsTimeCarePlanDescription: "Controls when dashboard and member reminder plans are generated each day.",
    settingsAdminScheduleHint: "Saved schedule changes apply to later generation runs.",
    settingsLanguageChinese: "中文",
    settingsLanguageEnglish: "English",
    settingsThemeLight: "Light",
    settingsThemeDark: "Dark",
    settingsThemeSystem: "System",
    settingsTimeHealthSummary: "Daily health status refresh time",
    settingsTimeCarePlan: "Daily plan refresh time",
    settingsTimeSave: "Save refresh times",
    settingsTimeSaving: "Saving...",
    settingsTimeSaved: "Refresh times updated.",
    settingsTimeAdminOnly: "Only admins can configure daily refresh times.",
    settingsTimeLoadError: "Failed to load refresh settings. Please try again later.",
    settingsTimeSaveError: "Failed to save refresh settings. Please try again later.",
    settingsAiEyebrow: "AI Config",
    settingsAiTitle: "Runtime model and transcription settings",
    settingsAiDescription: "Configure chat model and speech transcription settings. The next chat or transcription request uses the saved values immediately.",
    settingsAiSave: "Save AI settings",
    settingsAiSaving: "Saving...",
    settingsAiSaved: "AI settings updated.",
    settingsAiLoadError: "Failed to load AI settings. Please try again later.",
    settingsAiSaveError: "Failed to save AI settings. Please try again later.",
    settingsAiSectionTranscription: "Speech Transcription",
    settingsAiSectionTranscriptionDescription: "Configure the STT provider, language, model, and timeout.",
    settingsAiSectionChatModel: "Chat Model",
    settingsAiSectionChatModelDescription: "Configure the OpenAI-compatible model used for chat and daily generation.",
    settingsAiTranscriptionProvider: "Transcription Provider",
    settingsAiTranscriptionProviderOpenAI: "OpenAI API",
    settingsAiTranscriptionProviderLocal: "Local Whisper",
    settingsAiProviderSwitched: "Transcription provider updated.",
    settingsAiTranscriptionApiKey: "Transcription API Key",
    settingsAiTranscriptionModel: "Transcription Model",
    settingsAiTranscriptionLanguage: "Transcription Language",
    settingsAiTranscriptionTimeout: "Transcription Timeout (seconds)",
    settingsAiLocalWhisperModel: "Local Whisper Model",
    settingsAiLocalWhisperDevice: "Local Whisper Device",
    settingsAiLocalWhisperComputeType: "Local Whisper Precision",
    settingsAiLocalWhisperDownloadRoot: "Local Whisper Download Root",
    settingsAiChatBaseUrl: "Chat Base URL",
    settingsAiChatApiKey: "Chat API Key",
    settingsAiChatModel: "Chat Model",
    homeFamilyStatus: "Family Status",
    homeTodayReminders: "Today's Reminders",
    homeRefresh: "Refresh",
    homeRefreshing: "Refreshing…",
    homeComposerPlaceholder: "Share today's family health updates...",
    loginTitle: "Login",
    loginDescription: "Welcome back to your personal health hub",
    loginAlternateLabel: "Don't have an account?",
    loginAlternateAction: "Create one",
    loginRemember: "Keep me signed in",
    loginSubmit: "Sign in",
    loginEmail: "Email",
    loginPassword: "Password",
    loginEmailPlaceholder: "Enter your email address",
    loginPasswordPlaceholder: "Enter your password",
    loginShowPassword: "Show password",
    loginHidePassword: "Hide password",
    loginFallbackError: "Login failed. Please try again.",
    registerTitle: "Register",
    registerDescription: "Create a health space for your family",
    registerAlternateLabel: "Already have an account?",
    registerAlternateAction: "Back to login",
    registerSubmit: "Create account",
    registerName: "Family nickname",
    registerEmail: "Email",
    registerPassword: "Password",
    registerConfirmPassword: "Confirm password",
    registerNamePlaceholder: "For example: Aunt Li",
    registerEmailPlaceholder: "Enter your email address",
    registerPasswordPlaceholder: "At least 8 characters",
    registerConfirmPasswordPlaceholder: "Enter your password again",
    registerPasswordMismatch: "The passwords do not match.",
    registerFallbackError: "Registration failed. Please try again.",
    authBrand: "Family Health Companion",
    authSubmitting: "Working...",
    authFooter: "© 2026 Family Health Companion. Your health, our promise.",
    chatInputLabel: "Chat input",
    chatInputAddAttachment: "Add attachment",
    chatInputNoMember: "Auto-detect member",
    chatInputFocusMember: (variables?: TemplateVariables) =>
      `Current member: ${variables?.member ?? ""}`,
    chatInputAutoMember: "Auto-detecting member",
    chatInputCancelVoice: "Cancel recording",
    chatInputFinishVoice: "Finish recording and send",
    chatInputVoice: "Voice input",
    chatInputSend: "Send text",
    chatInputMicError: (variables?: TemplateVariables) =>
      `Microphone unavailable: ${variables?.message ?? ""}`,
    chatFocusSwitched: (variables?: TemplateVariables) =>
      `Switched focus to ${variables?.member ?? ""}`,
    chatFocusInferred: (variables?: TemplateVariables) =>
      `Automatically identified ${variables?.member ?? ""} as the current member`,
    chatOverlayLabel: "AI Health Assistant",
    chatOverlayUploadAudio: "Upload audio",
    chatOverlayClose: "Close AI chat",
    chatOverlayDraft: "Draft pending review",
    chatOverlayAnalysis: "Analysis",
  },
} as const;

export type TranslationKey = keyof typeof translations.zh;

type StoredPreferences = {
  language?: AppLanguage;
  theme?: AppTheme;
};

const defaultPreferences: Required<StoredPreferences> = {
  language: "zh",
  theme: "system",
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const appPreferencesStorageKey = "homevital.preferences";

function readStoredPreferences(): Required<StoredPreferences> {
  if (typeof window === "undefined") {
    return defaultPreferences;
  }
  try {
    const rawValue = window.localStorage.getItem(appPreferencesStorageKey);
    if (!rawValue) {
      return defaultPreferences;
    }
    const parsed = JSON.parse(rawValue) as StoredPreferences;
    return {
      language: parsed.language === "en" ? "en" : "zh",
      theme:
        parsed.theme === "light" || parsed.theme === "dark"
          ? parsed.theme
          : "system",
    };
  } catch {
    return defaultPreferences;
  }
}

function detectSystemTheme(): "light" | "dark" {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

function interpolate(
  value: TranslationValue,
  variables?: Record<string, string | number>,
): string {
  if (typeof value === "function") {
    return value(variables);
  }
  return value;
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const stored = readStoredPreferences();
  const [language, setLanguage] = useState<AppLanguage>(stored.language);
  const [theme, setTheme] = useState<AppTheme>(stored.theme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(detectSystemTheme);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    window.localStorage.setItem(
      appPreferencesStorageKey,
      JSON.stringify({ language, theme }),
    );
  }, [language, theme]);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () =>
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    handleChange();
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage,
      theme,
      setTheme,
      resolvedTheme,
      t: (key, variables) =>
        interpolate(translations[language][key], variables),
    }),
    [language, resolvedTheme, theme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider.");
  }
  return context;
}
