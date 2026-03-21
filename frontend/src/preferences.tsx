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
    settingsMembersPermissionHeading: "管理权限",
    settingsMembersUnboundNoPermissions: "未绑定账号，无法配置权限",
    settingsMembersPermissionLoading: "权限加载中...",
    settingsMembersPermissionLoadError: "权限加载失败，请稍后重试。",
    settingsMembersPermissionSaveError: "权限保存失败，请稍后重试。",
    settingsPermissionNotSet: "未设置",
    settingsPermissionEveryone: "所有人",
    settingsPermissionWriteInheritedHint: "已由写权限继承",
    settingsPermissionPickTargetsAria: (variables?: TemplateVariables) =>
      `选择 ${variables?.memberName ?? ""} 的${variables?.label ?? ""}对象`,
    settingsPermissionToggleEveryoneAria: (variables?: TemplateVariables) =>
      `切换 ${variables?.label ?? ""} 对象 所有人`,
    settingsPermissionToggleMemberAria: (variables?: TemplateVariables) =>
      `切换 ${variables?.label ?? ""} 对象 ${variables?.name ?? ""}`,
    settingsMembersToggleManageAllAria: (variables?: TemplateVariables) =>
      `切换 ${variables?.name ?? ""} 的管理全部成员权限`,
    settingsMembersExpandPermissionsAria: (variables?: TemplateVariables) =>
      `展开 ${variables?.name ?? ""} 的权限设置`,
    settingsMembersCollapsePermissionsAria: (variables?: TemplateVariables) =>
      `收起 ${variables?.name ?? ""} 的权限设置`,
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
    homeSummaryUpdatedJustNow: "刚刚更新",
    homeSummaryUpdatedMinutesAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 分钟前更新`,
    homeSummaryUpdatedHoursAgo: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 小时前更新`,
    homeSummaryUpdatedOnDate: (variables?: TemplateVariables) =>
      `${variables?.date ?? ""} 更新`,
    homePanelRefreshedAt: (variables?: TemplateVariables) =>
      `${variables?.time ?? ""} 已刷新`,
    homeReminderGroupMorning: "清晨的叮嘱",
    homeReminderGroupAfternoon: "午后的守候",
    homeReminderGroupEvening: "晚间小结",
    homeReminderPendingSchedule: "待安排",
    homePermissionManage: "可管理",
    homePermissionWrite: "可写入",
    homePermissionRead: "可读取",
    homePermissionBound: "已绑定",
    homePermissionNotBound: "未绑定",
    homePermissionIncomplete: "待完善",
    homeHealthSummaryAwaiting: "期待新纪录",
    homeDashboardLoadError: "首页聚合数据加载失败，请重试。",
    homeNoSummaryYet: "暂无健康摘要",
    homeViewProfile: "查看档案",
    homeViewProfileAria: (variables?: TemplateVariables) =>
      `查看 ${variables?.name ?? ""} 档案`,
    homeRefreshMemberAria: (variables?: TemplateVariables) =>
      `刷新 ${variables?.name ?? ""} 的数据`,
    homeMemberCountBadge: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 位成员`,
    homeLoadingMembers: "正在加载家庭成员…",
    homeReminderTasksLine: (variables?: TemplateVariables) =>
      `共 ${variables?.total ?? 0} 项健康任务，覆盖 ${variables?.slots ?? 0} 个时段`,
    homeNoRemindersSubtitle: "暂无今日提醒",
    homeAttachmentAnalysisPrompt: (variables?: TemplateVariables) =>
      `请结合我刚上传的 ${variables?.count ?? 0} 个附件继续分析。`,
    homeAiSummaryRefreshError: "AI 健康摘要刷新失败，请稍后重试。",
    homeRemindersRefreshError: "今日提醒刷新失败，请稍后重试。",
    homeLoadingReminders: "正在整理今日提醒…",
    homeEmptyRemindersTitle: "今天还没有待办提醒",
    homeEmptyRemindersBody:
      "可以先进入成员档案补充用药、复诊和指标记录，系统会在每日刷新时同步最新 AI 提醒。",
    homeReminderCountInGroup: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} 项提醒`,
    homeReminderForMember: (variables?: TemplateVariables) =>
      `给 ${variables?.name ?? ""}`,
    homeViewReminderMemberAria: (variables?: TemplateVariables) =>
      `查看 ${variables?.name ?? ""} 档案`,
    homeCareTimeEarlyMorning: "清晨",
    homeCareTimeMorning: "上午",
    homeCareTimeAfternoon: "午后",
    homeCareTimeEvening: "晚间",
    homeCareTimeBedtime: "睡前",
    commonClose: "关闭",
    commonCancel: "取消",
    commonSave: "保存",
    commonRetry: "重试",
    commonLoading: "加载中...",
    commonYes: "是",
    commonNo: "否",
    confirmDeleteTitle: "删除确认",
    confirmDeleteDefaultMessage: "此操作不可恢复，确定要删除吗？",
    confirmDeleteRecordMessage: "删除后将无法恢复，确定要删除此记录吗？",
    confirmDeleteButton: "确认删除",
    memberProfileAria: "成员档案",
    memberProfileLastUpdated: (variables?: TemplateVariables) =>
      `最近更新：${variables?.date ?? "—"}`,
    memberProfileEditMode: "编辑模式",
    memberProfileLoadingData: "正在加载数据...",
    memberProfileLoadError: "加载失败",
    memberProfileTabOverview: "概览",
    memberProfileTabHealthData: "健康数据",
    memberProfileTabHealthRecords: "健康档案",
    memberProfileTabEncounters: "就诊记录",
    memberProfileTabMedications: "药品管理",
    memberProfileEditAction: "编辑",
    memberProfileDeleteAction: "删除",
    memberProfileBasicInfo: "基础信息",
    memberProfileName: "姓名",
    memberProfileNamePlaceholder: "成员姓名",
    memberProfileGender: "性别",
    memberProfileGenderMale: "男",
    memberProfileGenderFemale: "女",
    memberProfileGenderOther: "其他",
    memberProfileBirthDate: "出生日期",
    memberProfileHeightCm: "身高 (cm)",
    memberProfileHeightPlaceholder: "例如 170",
    memberProfileBloodType: "血型",
    memberProfileBloodUnknown: "未知",
    memberProfileBloodTypeA: "A型",
    memberProfileBloodTypeB: "B型",
    memberProfileBloodTypeAB: "AB型",
    memberProfileBloodTypeO: "O型",
    memberProfileSaveBasic: "保存基础信息",
    memberProfileHeightWeight: "身高/体重",
    memberProfileAge: "年龄",
    memberProfileAllergies: "过敏史",
    memberProfileAiSummaryTitle: "AI 健康摘要",
    memberProfileAiSummaryBadge: "AI 每日生成 · 只读",
    memberProfileTodayReminders: "今日提醒",
    memberProfileNoRemindersToday: "暂无今日提醒",
    memberProfileAgeYears: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0}岁`,
    memberProfileHealthChronicMetrics: "慢病指标",
    memberProfileNoChronicData: "暂无慢病指标数据",
    memberProfileLabelBloodPressure: "血压",
    memberProfileLabelBloodGlucose: "血糖",
    memberProfileVitalMetrics: "生理指标",
    memberProfileNoVitalData: "暂无生理指标数据",
    memberProfileLabelHeartRate: "心率",
    memberProfileLabelSpO2: "血氧",
    memberProfileLabelWeight: "体重",
    memberProfileLabelTemperature: "体温",
    memberProfileLifestyle: "生活习惯",
    memberProfileSteps: "步数",
    memberProfileGoalPrefix: (variables?: TemplateVariables) =>
      `目标: ${variables?.value ?? ""}`,
    memberProfileActiveMinutes: "运动时长",
    memberProfileMinutes: "分钟",
    memberProfileSleep: "睡眠",
    memberProfileWorkouts: "运动记录",
    memberProfileAdd: "新增",
    memberProfileNoSleepData: "暂无睡眠数据",
    memberProfileSleepColPeriod: "起止时间",
    memberProfileSleepColDuration: "总时长",
    memberProfileSleepColNap: "午休",
    memberProfileColActions: "操作",
    memberProfileNoWorkoutData: "暂无运动记录",
    memberProfileWorkoutDuration: (variables?: TemplateVariables) =>
      `${variables?.minutes ?? 0} 分钟${variables?.extra ? ` ${variables.extra}` : ""}`,
    memberProfileModalEditSleep: "编辑睡眠记录",
    memberProfileModalAddSleep: "新增睡眠记录",
    memberProfileSleepStart: "入睡时间",
    memberProfileSleepEnd: "醒来时间",
    memberProfileSleepIsNap: "是否为午休",
    memberProfileModalEditWorkout: "编辑运动记录",
    memberProfileModalAddWorkout: "新增运动记录",
    memberProfileWorkoutType: "运动类型",
    memberProfileWorkoutTypePlaceholder: "例如：跑步、游泳",
    memberProfileWorkoutStart: "开始时间",
    memberProfileWorkoutEnd: "结束时间",
    memberProfileHealthCurrentIllness: "现病",
    memberProfileHealthPastIllness: "既往病史",
    memberProfileHealthFamilyHistory: "家族病史",
    memberProfileHealthAllergies: "过敏与禁忌",
    memberProfileNoRecords: "暂无记录",
    memberProfileOnsetDate: (variables?: TemplateVariables) =>
      `发病日期：${variables?.date ?? "—"}`,
    memberProfileRecordDate: (variables?: TemplateVariables) =>
      `记录日期：${variables?.date ?? "—"}`,
    memberProfileStatusResolved: "已治愈",
    memberProfileStatusInactiveLabel: "已停用",
    memberProfileModalEditCondition: "编辑记录",
    memberProfileModalAddCondition: "新增记录",
    memberProfileConditionName: "疾病/过敏名称 *",
    memberProfileConditionNamePlaceholder: "例如：高血压",
    memberProfileCategory: "分类",
    memberProfileCategoryChronic: "慢病/既往病史",
    memberProfileCategoryDiagnosis: "诊断",
    memberProfileCategoryAllergy: "过敏禁忌",
    memberProfileCategoryFamilyHistory: "家族病史",
    memberProfileClinicalStatus: "状态",
    memberProfileStatusActiveChronic: "现病/生效中",
    memberProfileStatusResolvedOption: "已治愈",
    memberProfileStatusInactiveOption: "已停用",
    memberProfileOnsetOrRecordDate: "发病/记录日期",
    memberProfileNotes: "备注",
    memberProfileNotesPlaceholder: "填写更多细节...",
    memberProfileTodayAt: (variables?: TemplateVariables) =>
      `今天 ${variables?.time ?? ""}`,
    memberProfileEncountersTitle: "历史就诊记录",
    memberProfileEncounterAdd: "新增记录",
    memberProfileNoEncounters: "暂无就诊记录",
    memberProfileFacilityUnset: "未记录机构",
    memberProfileEncounterDoctor: "接诊医生",
    memberProfileEncounterDetail: "详细记录/诊断",
    memberProfileModalEditEncounter: "编辑就诊记录",
    memberProfileModalAddEncounter: "新增就诊记录",
    memberProfileEncounterDate: "就诊日期 *",
    memberProfileEncounterType: "类型",
    memberProfileEncounterTypeOutpatient: "门诊",
    memberProfileEncounterTypeInpatient: "住院",
    memberProfileEncounterTypeCheckup: "复查/体检",
    memberProfileEncounterTypeEmergency: "急诊",
    memberProfileFacility: "医疗机构",
    memberProfileFacilityPlaceholder: "例如：市第一医院",
    memberProfileDepartment: "科室",
    memberProfileDepartmentPlaceholder: "例如：心内科",
    memberProfileDoctorPlaceholder: "例如：张医生",
    memberProfileEncounterSummaryPlaceholder: "诊断结果、医嘱...",
    encounterTypeFollowUp: "复查",
    encounterTypeOutpatient: "门诊",
    encounterTypeExam: "检查",
    encounterTypeInpatient: "住院",
    encounterTypeEmergency: "急诊",
    encounterTypeDefault: "就诊",
    memberProfileMedicationAdd: "新增药品",
    memberProfileMedicationTaking: "正在服用",
    memberProfileNoActiveMeds: "暂无正在服用的药品",
    memberProfileMedicationActiveBadge: "服用中",
    memberProfileMedicationStopped: "已停用",
    memberProfileMedicationPurpose: (variables?: TemplateVariables) =>
      `功能：${variables?.value ?? "—"}`,
    memberProfileMedicationStoppedDateLabel: "停止日期",
    memberProfileMedicationStartedLabel: "开始服用时间",
    memberProfileModalEditMedication: "编辑药品",
    memberProfileModalAddMedication: "新增药品",
    memberProfileMedicationName: "药品名称 *",
    memberProfileMedicationNamePlaceholder: "例如：阿司匹林",
    memberProfileMedicationStatus: "服用状态",
    memberProfileMedicationStatusActive: "服用中",
    memberProfileMedicationStatusStopped: "已停用",
    memberProfileDosage: "用法用量",
    memberProfileDosagePlaceholder: "例如：每日1次，每次1片",
    memberProfileIndication: "治疗功能/主治",
    memberProfileIndicationPlaceholder: "例如：降血压",
    memberProfileMedicationStartDate: "开始服用日期",
    memberProfileMedicationEndDate: "停止服用日期",
    loginTitle: "登录",
    loginDescription: "欢迎回到您的家庭健康中心",
    loginAlternateLabel: "还没有账号？",
    loginAlternateAction: "免费注册",
    loginRemember: "记住我的登录状态",
    loginSubmit: "立即登录",
    loginUsername: "用户名",
    loginPassword: "密码",
    loginUsernamePlaceholder: "请输入用户名",
    loginPasswordPlaceholder: "请输入您的登录密码",
    loginShowPassword: "显示密码",
    loginHidePassword: "隐藏密码",
    loginFallbackError: "登录失败，请重试。",
    registerTitle: "注册",
    registerDescription: "创建属于您家庭的健康管理空间",
    registerAlternateLabel: "已经有账号？",
    registerAlternateAction: "返回登录",
    registerSubmit: "创建账号",
    registerUsername: "用户名",
    registerEmail: "电子邮箱（可选）",
    registerPassword: "密码",
    registerConfirmPassword: "确认密码",
    registerUsernamePlaceholder: "支持中文、字母、数字、_ 和 -",
    registerEmailPlaceholder: "请输入联系邮箱地址（可选）",
    registerPasswordPlaceholder: "至少 8 位密码",
    registerConfirmPasswordPlaceholder: "请再次输入密码",
    registerPasswordMismatch: "两次输入的密码不一致。",
    registerFallbackError: "注册失败，请重试。",
    authUsernameInvalid: "用户名只能包含中文、字母、数字、下划线或连字符，长度为 3-24。",
    authBrand: "家庭健康管理助手",
    authCardHeroAlt: "一家人快乐运动的场景插画",
    authSubmitting: "处理中...",
    authFooter: "© 2026 KinCare",
    chatInputLabel: "对话输入框",
    chatInputAddAttachment: "添加附件",
    chatInputNoMember: "自动识别成员",
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
    settingsMembersPermissionHeading: "Manage permissions",
    settingsMembersUnboundNoPermissions:
      "No account linked yet. Permissions cannot be configured.",
    settingsMembersPermissionLoading: "Loading permissions…",
    settingsMembersPermissionLoadError: "Could not load permissions. Please try again.",
    settingsMembersPermissionSaveError: "Could not save permissions. Please try again.",
    settingsPermissionNotSet: "Not set",
    settingsPermissionEveryone: "Everyone",
    settingsPermissionWriteInheritedHint: "Inherited from edit access",
    settingsPermissionPickTargetsAria: (variables?: TemplateVariables) =>
      `Choose ${variables?.label ?? ""} targets for ${variables?.memberName ?? ""}`,
    settingsPermissionToggleEveryoneAria: (variables?: TemplateVariables) =>
      `Toggle everyone for ${variables?.label ?? ""}`,
    settingsPermissionToggleMemberAria: (variables?: TemplateVariables) =>
      `Toggle ${variables?.name ?? ""} for ${variables?.label ?? ""}`,
    settingsMembersToggleManageAllAria: (variables?: TemplateVariables) =>
      `Toggle manage-all household permission for ${variables?.name ?? ""}`,
    settingsMembersExpandPermissionsAria: (variables?: TemplateVariables) =>
      `Expand permission settings for ${variables?.name ?? ""}`,
    settingsMembersCollapsePermissionsAria: (variables?: TemplateVariables) =>
      `Collapse permission settings for ${variables?.name ?? ""}`,
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
    homeSummaryUpdatedJustNow: "Updated just now",
    homeSummaryUpdatedMinutesAgo: (variables?: TemplateVariables) =>
      `Updated ${variables?.count ?? 0} min ago`,
    homeSummaryUpdatedHoursAgo: (variables?: TemplateVariables) =>
      `Updated ${variables?.count ?? 0} hr ago`,
    homeSummaryUpdatedOnDate: (variables?: TemplateVariables) =>
      `Updated ${variables?.date ?? ""}`,
    homePanelRefreshedAt: (variables?: TemplateVariables) =>
      `Refreshed at ${variables?.time ?? ""}`,
    homeReminderGroupMorning: "Morning notes",
    homeReminderGroupAfternoon: "Afternoon care",
    homeReminderGroupEvening: "Evening wrap-up",
    homeReminderPendingSchedule: "To be scheduled",
    homePermissionManage: "Can manage",
    homePermissionWrite: "Can edit",
    homePermissionRead: "Can view",
    homePermissionBound: "Linked",
    homePermissionNotBound: "Not linked",
    homePermissionIncomplete: "Incomplete",
    homeHealthSummaryAwaiting: "Awaiting new records",
    homeDashboardLoadError: "Could not load dashboard data. Please try again.",
    homeNoSummaryYet: "No health summary yet",
    homeViewProfile: "View profile",
    homeViewProfileAria: (variables?: TemplateVariables) =>
      `View profile for ${variables?.name ?? ""}`,
    homeRefreshMemberAria: (variables?: TemplateVariables) =>
      `Refresh data for ${variables?.name ?? ""}`,
    homeMemberCountBadge: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} members`,
    homeLoadingMembers: "Loading family members…",
    homeReminderTasksLine: (variables?: TemplateVariables) =>
      `${variables?.total ?? 0} care tasks across ${variables?.slots ?? 0} time blocks`,
    homeNoRemindersSubtitle: "No reminders for today",
    homeAttachmentAnalysisPrompt: (variables?: TemplateVariables) =>
      `Please continue the analysis with the ${variables?.count ?? 0} attachment(s) I just uploaded.`,
    homeAiSummaryRefreshError: "Could not refresh AI health summary. Please try again later.",
    homeRemindersRefreshError: "Could not refresh today's reminders. Please try again later.",
    homeLoadingReminders: "Loading today's reminders…",
    homeEmptyRemindersTitle: "No reminders scheduled today",
    homeEmptyRemindersBody:
      "Open a member profile to add medications, follow-ups, and vitals. The system syncs the latest AI reminders on the next daily refresh.",
    homeReminderCountInGroup: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} reminder(s)`,
    homeReminderForMember: (variables?: TemplateVariables) =>
      `For ${variables?.name ?? ""}`,
    homeViewReminderMemberAria: (variables?: TemplateVariables) =>
      `View profile for ${variables?.name ?? ""}`,
    homeCareTimeEarlyMorning: "Early morning",
    homeCareTimeMorning: "Morning",
    homeCareTimeAfternoon: "Afternoon",
    homeCareTimeEvening: "Evening",
    homeCareTimeBedtime: "Before bed",
    commonClose: "Close",
    commonCancel: "Cancel",
    commonSave: "Save",
    commonRetry: "Retry",
    commonLoading: "Loading...",
    commonYes: "Yes",
    commonNo: "No",
    confirmDeleteTitle: "Confirm deletion",
    confirmDeleteDefaultMessage: "This cannot be undone. Delete anyway?",
    confirmDeleteRecordMessage:
      "This cannot be undone. Are you sure you want to delete this record?",
    confirmDeleteButton: "Delete",
    memberProfileAria: "Member profile",
    memberProfileLastUpdated: (variables?: TemplateVariables) =>
      `Last updated: ${variables?.date ?? "—"}`,
    memberProfileEditMode: "Edit mode",
    memberProfileLoadingData: "Loading data...",
    memberProfileLoadError: "Failed to load profile",
    memberProfileTabOverview: "Overview",
    memberProfileTabHealthData: "Health data",
    memberProfileTabHealthRecords: "Health records",
    memberProfileTabEncounters: "Visits",
    memberProfileTabMedications: "Medications",
    memberProfileEditAction: "Edit",
    memberProfileDeleteAction: "Delete",
    memberProfileBasicInfo: "Basic info",
    memberProfileName: "Name",
    memberProfileNamePlaceholder: "Member name",
    memberProfileGender: "Gender",
    memberProfileGenderMale: "Male",
    memberProfileGenderFemale: "Female",
    memberProfileGenderOther: "Other",
    memberProfileBirthDate: "Date of birth",
    memberProfileHeightCm: "Height (cm)",
    memberProfileHeightPlaceholder: "e.g. 170",
    memberProfileBloodType: "Blood type",
    memberProfileBloodUnknown: "Unknown",
    memberProfileBloodTypeA: "Type A",
    memberProfileBloodTypeB: "Type B",
    memberProfileBloodTypeAB: "Type AB",
    memberProfileBloodTypeO: "Type O",
    memberProfileSaveBasic: "Save basic info",
    memberProfileHeightWeight: "Height / weight",
    memberProfileAge: "Age",
    memberProfileAllergies: "Allergies",
    memberProfileAiSummaryTitle: "AI health summary",
    memberProfileAiSummaryBadge: "AI-generated daily · read-only",
    memberProfileTodayReminders: "Today's reminders",
    memberProfileNoRemindersToday: "No reminders for today",
    memberProfileAgeYears: (variables?: TemplateVariables) =>
      `${variables?.count ?? 0} yrs`,
    memberProfileHealthChronicMetrics: "Chronic conditions",
    memberProfileNoChronicData: "No chronic metrics yet",
    memberProfileLabelBloodPressure: "Blood pressure",
    memberProfileLabelBloodGlucose: "Blood glucose",
    memberProfileVitalMetrics: "Vitals",
    memberProfileNoVitalData: "No vital signs yet",
    memberProfileLabelHeartRate: "Heart rate",
    memberProfileLabelSpO2: "SpO₂",
    memberProfileLabelWeight: "Weight",
    memberProfileLabelTemperature: "Temperature",
    memberProfileLifestyle: "Lifestyle",
    memberProfileSteps: "Steps",
    memberProfileGoalPrefix: (variables?: TemplateVariables) =>
      `Goal: ${variables?.value ?? ""}`,
    memberProfileActiveMinutes: "Active minutes",
    memberProfileMinutes: "min",
    memberProfileSleep: "Sleep",
    memberProfileWorkouts: "Workouts",
    memberProfileAdd: "Add",
    memberProfileNoSleepData: "No sleep data yet",
    memberProfileSleepColPeriod: "Start–end",
    memberProfileSleepColDuration: "Duration",
    memberProfileSleepColNap: "Nap",
    memberProfileColActions: "Actions",
    memberProfileNoWorkoutData: "No workouts yet",
    memberProfileWorkoutDuration: (variables?: TemplateVariables) =>
      `${variables?.minutes ?? 0} min${variables?.extra ? ` ${variables.extra}` : ""}`,
    memberProfileModalEditSleep: "Edit sleep",
    memberProfileModalAddSleep: "Add sleep",
    memberProfileSleepStart: "Fell asleep",
    memberProfileSleepEnd: "Woke up",
    memberProfileSleepIsNap: "Nap",
    memberProfileModalEditWorkout: "Edit workout",
    memberProfileModalAddWorkout: "Add workout",
    memberProfileWorkoutType: "Activity type",
    memberProfileWorkoutTypePlaceholder: "e.g. running, swimming",
    memberProfileWorkoutStart: "Start time",
    memberProfileWorkoutEnd: "End time",
    memberProfileHealthCurrentIllness: "Current conditions",
    memberProfileHealthPastIllness: "Past conditions",
    memberProfileHealthFamilyHistory: "Family history",
    memberProfileHealthAllergies: "Allergies & contraindications",
    memberProfileNoRecords: "No records",
    memberProfileOnsetDate: (variables?: TemplateVariables) =>
      `Onset: ${variables?.date ?? "—"}`,
    memberProfileRecordDate: (variables?: TemplateVariables) =>
      `Recorded: ${variables?.date ?? "—"}`,
    memberProfileStatusResolved: "Resolved",
    memberProfileStatusInactiveLabel: "Inactive",
    memberProfileModalEditCondition: "Edit record",
    memberProfileModalAddCondition: "Add record",
    memberProfileConditionName: "Condition / allergy name *",
    memberProfileConditionNamePlaceholder: "e.g. hypertension",
    memberProfileCategory: "Category",
    memberProfileCategoryChronic: "Chronic / past illness",
    memberProfileCategoryDiagnosis: "Diagnosis",
    memberProfileCategoryAllergy: "Allergy",
    memberProfileCategoryFamilyHistory: "Family history",
    memberProfileClinicalStatus: "Status",
    memberProfileStatusActiveChronic: "Active",
    memberProfileStatusResolvedOption: "Resolved",
    memberProfileStatusInactiveOption: "Inactive",
    memberProfileOnsetOrRecordDate: "Onset / record date",
    memberProfileNotes: "Notes",
    memberProfileNotesPlaceholder: "Add details…",
    memberProfileTodayAt: (variables?: TemplateVariables) =>
      `Today ${variables?.time ?? ""}`,
    memberProfileEncountersTitle: "Visit history",
    memberProfileEncounterAdd: "Add visit",
    memberProfileNoEncounters: "No visits yet",
    memberProfileFacilityUnset: "Facility not recorded",
    memberProfileEncounterDoctor: "Clinician",
    memberProfileEncounterDetail: "Notes / diagnosis",
    memberProfileModalEditEncounter: "Edit visit",
    memberProfileModalAddEncounter: "Add visit",
    memberProfileEncounterDate: "Visit date *",
    memberProfileEncounterType: "Type",
    memberProfileEncounterTypeOutpatient: "Outpatient",
    memberProfileEncounterTypeInpatient: "Inpatient",
    memberProfileEncounterTypeCheckup: "Follow-up / checkup",
    memberProfileEncounterTypeEmergency: "Emergency",
    memberProfileFacility: "Facility",
    memberProfileFacilityPlaceholder: "e.g. City General Hospital",
    memberProfileDepartment: "Department",
    memberProfileDepartmentPlaceholder: "e.g. Cardiology",
    memberProfileDoctorPlaceholder: "e.g. Dr. Smith",
    memberProfileEncounterSummaryPlaceholder: "Diagnosis, instructions…",
    encounterTypeFollowUp: "Follow-up",
    encounterTypeOutpatient: "Outpatient",
    encounterTypeExam: "Exam",
    encounterTypeInpatient: "Inpatient",
    encounterTypeEmergency: "Emergency",
    encounterTypeDefault: "Visit",
    memberProfileMedicationAdd: "Add medication",
    memberProfileMedicationTaking: "Currently taking",
    memberProfileNoActiveMeds: "No active medications",
    memberProfileMedicationActiveBadge: "Active",
    memberProfileMedicationStopped: "Stopped",
    memberProfileMedicationPurpose: (variables?: TemplateVariables) =>
      `For: ${variables?.value ?? "—"}`,
    memberProfileMedicationStoppedDateLabel: "Stopped on",
    memberProfileMedicationStartedLabel: "Started",
    memberProfileModalEditMedication: "Edit medication",
    memberProfileModalAddMedication: "Add medication",
    memberProfileMedicationName: "Medication name *",
    memberProfileMedicationNamePlaceholder: "e.g. aspirin",
    memberProfileMedicationStatus: "Status",
    memberProfileMedicationStatusActive: "Active",
    memberProfileMedicationStatusStopped: "Stopped",
    memberProfileDosage: "Dosage",
    memberProfileDosagePlaceholder: "e.g. once daily, 1 tablet",
    memberProfileIndication: "Indication / purpose",
    memberProfileIndicationPlaceholder: "e.g. blood pressure",
    memberProfileMedicationStartDate: "Start date",
    memberProfileMedicationEndDate: "End date",
    loginTitle: "Login",
    loginDescription: "Welcome back to your family health hub",
    loginAlternateLabel: "Don't have an account?",
    loginAlternateAction: "Create one",
    loginRemember: "Keep me signed in",
    loginSubmit: "Sign in",
    loginUsername: "Username",
    loginPassword: "Password",
    loginUsernamePlaceholder: "Enter your username",
    loginPasswordPlaceholder: "Enter your password",
    loginShowPassword: "Show password",
    loginHidePassword: "Hide password",
    loginFallbackError: "Login failed. Please try again.",
    registerTitle: "Register",
    registerDescription: "Create a health space for your family",
    registerAlternateLabel: "Already have an account?",
    registerAlternateAction: "Back to login",
    registerSubmit: "Create account",
    registerUsername: "Username",
    registerEmail: "Email (optional)",
    registerPassword: "Password",
    registerConfirmPassword: "Confirm password",
    registerUsernamePlaceholder: "Chinese, letters, numbers, _ and -",
    registerEmailPlaceholder: "Enter a contact email (optional)",
    registerPasswordPlaceholder: "At least 8 characters",
    registerConfirmPasswordPlaceholder: "Enter your password again",
    registerPasswordMismatch: "The passwords do not match.",
    registerFallbackError: "Registration failed. Please try again.",
    authUsernameInvalid: "Username must be 3-24 characters and use only Chinese characters, letters, numbers, underscores, or hyphens.",
    authBrand: "Family Health Companion",
    authCardHeroAlt: "Illustration of a happy family exercising together",
    authSubmitting: "Working...",
    authFooter: "© 2026 KinCare",
    chatInputLabel: "Chat input",
    chatInputAddAttachment: "Add attachment",
    chatInputNoMember: "Auto-detect member",
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

export const appPreferencesStorageKey = "kincare.preferences";

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
