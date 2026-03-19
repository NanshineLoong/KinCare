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
    settingsTabMembers: "成员管理",
    settingsTabPreferences: "偏好",
    settingsTabAi: "AI 配置",
    settingsPreferencesEyebrow: "偏好",
    settingsPreferencesTitle: "个人偏好与系统刷新",
    settingsPreferencesDescription: "语言和外观会即时应用到当前界面，时间刷新设置仅管理员可编辑。",
    settingsSectionLanguage: "语言",
    settingsSectionLanguageDescription: "切换当前设备上的界面语言，保存到本地浏览器。",
    settingsSectionTime: "时间",
    settingsSectionTimeDescription: "配置每日健康状态和提醒的自动刷新时间。",
    settingsSectionAppearance: "外观",
    settingsSectionAppearanceDescription: "切换浅色、深色或跟随系统主题。",
    settingsLanguageChinese: "中文",
    settingsLanguageEnglish: "English",
    settingsThemeLight: "浅色",
    settingsThemeDark: "深色",
    settingsThemeSystem: "跟随系统",
    settingsTimeHealthSummary: "每日健康状态刷新时间",
    settingsTimeCarePlan: "每日提醒刷新时间",
    settingsTimeSave: "保存时间设置",
    settingsTimeSaving: "保存中...",
    settingsTimeSaved: "刷新时间已更新。",
    settingsTimeAdminOnly: "仅管理员可配置每日刷新时间。",
    settingsTimeLoadError: "时间配置加载失败，请稍后重试。",
    settingsTimeSaveError: "时间配置保存失败，请稍后重试。",
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
    chatInputNoMember: "暂不指定成员",
    chatInputCancelVoice: "取消录音",
    chatInputFinishVoice: "结束录音并发送",
    chatInputVoice: "语音输入",
    chatInputSend: "发送文本",
    chatInputMicError: (variables?: TemplateVariables) =>
      `无法访问麦克风: ${variables?.message ?? ""}`,
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
    settingsTabMembers: "Members",
    settingsTabPreferences: "Preferences",
    settingsTabAi: "AI Config",
    settingsPreferencesEyebrow: "Preferences",
    settingsPreferencesTitle: "Personal preferences and refresh schedule",
    settingsPreferencesDescription: "Language and appearance apply immediately on this device. Refresh times are editable by admins only.",
    settingsSectionLanguage: "Language",
    settingsSectionLanguageDescription: "Switch the interface language for this browser and save it locally.",
    settingsSectionTime: "Time",
    settingsSectionTimeDescription: "Configure when daily health summaries and reminders refresh automatically.",
    settingsSectionAppearance: "Appearance",
    settingsSectionAppearanceDescription: "Choose light, dark, or follow the system theme.",
    settingsLanguageChinese: "中文",
    settingsLanguageEnglish: "English",
    settingsThemeLight: "Light",
    settingsThemeDark: "Dark",
    settingsThemeSystem: "System",
    settingsTimeHealthSummary: "Daily health summary refresh time",
    settingsTimeCarePlan: "Daily reminder refresh time",
    settingsTimeSave: "Save refresh times",
    settingsTimeSaving: "Saving...",
    settingsTimeSaved: "Refresh times updated.",
    settingsTimeAdminOnly: "Only admins can configure daily refresh times.",
    settingsTimeLoadError: "Failed to load refresh settings. Please try again later.",
    settingsTimeSaveError: "Failed to save refresh settings. Please try again later.",
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
    chatInputNoMember: "No member selected",
    chatInputCancelVoice: "Cancel recording",
    chatInputFinishVoice: "Finish recording and send",
    chatInputVoice: "Voice input",
    chatInputSend: "Send text",
    chatInputMicError: (variables?: TemplateVariables) =>
      `Microphone unavailable: ${variables?.message ?? ""}`,
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
