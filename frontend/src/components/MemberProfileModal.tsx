import { useEffect, useMemo, useState, type ReactNode } from "react";

import { getMember, updateMember } from "../api/members";
import {
  createCondition,
  createEncounter,
  createMedication,
  createObservation,
  createSleepRecord,
  createWorkoutRecord,
  deleteCondition,
  deleteEncounter,
  deleteMedication,
  deleteObservation,
  deleteSleepRecord,
  deleteWorkoutRecord,
  listCarePlans,
  listConditions,
  listEncounters,
  listHealthSummaries,
  listMedications,
  listObservations,
  listSleepRecords,
  listWorkoutRecords,
  updateCondition,
  updateEncounter,
  updateMedication,
  updateObservation,
  updateSleepRecord,
  updateWorkoutRecord,
  type CarePlanRecord,
  type ConditionRecord,
  type EncounterRecord,
  type HealthSummaryRecord,
  type MedicationRecord,
  type ObservationRecord,
  type SleepRecord,
  type WorkoutRecord,
} from "../api/health";
import type { AuthMember, AuthSession } from "../auth/session";
import { buildHealthSummaryCards } from "../healthSummaryCards";
import {
  usePreferences,
  type AppLanguage,
  type TranslationKey,
} from "../preferences";
import { Button } from "./Button";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ResourceFormModal } from "./ResourceFormModal";

type MemberProfileModalProps = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  refreshToken?: number;
  session: AuthSession;
  members: AuthMember[];
};

type TabKey = "overview" | "health-data" | "health-records" | "encounters" | "medications";

type MemberProfileState = {
  member: AuthMember | null;
  observations: ObservationRecord[];
  sleepRecords: SleepRecord[];
  workoutRecords: WorkoutRecord[];
  conditions: ConditionRecord[];
  medications: MedicationRecord[];
  encounters: EncounterRecord[];
  healthSummaries: HealthSummaryRecord[];
  carePlans: CarePlanRecord[];
};

type MemberWithDetails = AuthMember & { weight_kg?: number };

function memberProfileNavItems(
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): { key: TabKey; label: string; icon: string }[] {
  return [
    { key: "overview", label: t("memberProfileTabOverview"), icon: "grid_view" },
    {
      key: "health-data",
      label: t("memberProfileTabHealthData"),
      icon: "monitoring",
    },
    {
      key: "health-records",
      label: t("memberProfileTabHealthRecords"),
      icon: "assignment",
    },
    {
      key: "encounters",
      label: t("memberProfileTabEncounters"),
      icon: "local_hospital",
    },
    {
      key: "medications",
      label: t("memberProfileTabMedications"),
      icon: "medication",
    },
  ];
}

function translateCareTimeSlot(
  slot: string | null | undefined,
  language: AppLanguage,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string {
  if (!slot) return "—";
  if (language === "zh") return slot;
  const map: Record<string, TranslationKey> = {
    清晨: "homeCareTimeEarlyMorning",
    上午: "homeCareTimeMorning",
    午后: "homeCareTimeAfternoon",
    晚间: "homeCareTimeEvening",
    睡前: "homeCareTimeBedtime",
  };
  const key = map[slot];
  return key ? t(key) : slot;
}

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatDate(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale);
}

function formatTime(value: string | null, locale: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function isToday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatHealthTimestamp(
  value: string | null,
  locale: string,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  if (isToday(value)) {
    return t("memberProfileTodayAt", { time: formatTime(value, locale) });
  }
  const datePart = date.toLocaleDateString(locale, {
    month: "numeric",
    day: "2-digit",
  });
  return `${datePart} ${formatTime(value, locale)}`;
}

function getNumericValue(observation?: ObservationRecord | null): number | null {
  if (!observation) return null;
  if (observation.value != null) return observation.value;
  if (observation.value_string != null) {
    const parsed = parseFloat(observation.value_string);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function latestObservationByCode(
  observations: ObservationRecord[],
  code: string | string[],
): ObservationRecord | undefined {
  const codeSet = new Set(Array.isArray(code) ? code : [code]);
  const matches = observations.filter((item) => codeSet.has(item.code));
  if (matches.length === 0) return undefined;
  return matches.sort((left, right) => (right.effective_at || "").localeCompare(left.effective_at || ""))[0];
}

function observationsByCode(observations: ObservationRecord[], codes: string[]): ObservationRecord[] {
  const codeSet = new Set(codes);
  return observations.filter((item) => codeSet.has(item.code));
}

function sortByEffectiveAtDesc(observations: ObservationRecord[]): ObservationRecord[] {
  return [...observations].sort((left, right) => (right.effective_at || "").localeCompare(left.effective_at || ""));
}

function summaryTone(status: "good" | "warning" | "alert" | undefined) {
  if (status === "good") return "bg-emerald-500";
  if (status === "alert") return "bg-rose-500";
  if (status === "warning") return "bg-amber-500";
  return "bg-gray-300";
}

function SectionHeader({ title, badge }: { title: string; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-4 w-1 shrink-0 rounded-full bg-[#2D2926]" />
      <h3 className="text-base font-bold text-[#2D2926]">{title}</h3>
      {badge}
    </div>
  );
}

// ─── Shared Components ──────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  unit,
  timestamp,
  history,
  showMiniChart,
}: {
  label: string;
  value: string | number;
  unit?: string;
  timestamp: string;
  history: ObservationRecord[];
  showMiniChart?: boolean;
}) {
  const values = history.map((item) => getNumericValue(item) ?? 0).filter((item) => item > 0);
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-[#F2EDE7] bg-[#F9F6F3] p-4">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-warm-gray">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[#2D2926]">{value}</span>
          {unit ? <span className="text-sm text-[#7D746D]">{unit}</span> : null}
        </div>
        <p className="mt-1 text-[11px] font-mono text-[#7D746D]">{timestamp}</p>
      </div>
      {showMiniChart && values.length > 0 ? (
        <div className="flex h-10 w-24 shrink-0 items-end gap-0.5 pb-1">
          {values.slice(-5).map((item, index) => (
            <div
              className={`min-h-[4px] flex-1 rounded-sm ${index === values.length - 1 ? "bg-emerald-500" : "bg-[#F2EDE7]"}`}
              key={`${label}-${index}`}
              style={{ height: `${Math.max((item / max) * 100, 8)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  title,
  accentClass,
  open = true,
  children,
  actionButton,
}: {
  title: string;
  accentClass: string;
  open?: boolean;
  children: ReactNode;
  actionButton?: ReactNode;
}) {
  return (
    <details className="group rounded-3xl border border-[#F2EDE7] bg-white shadow-soft" open={open}>
      <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className={`h-6 w-1.5 rounded-full ${accentClass}`} />
          <h3 className="text-base font-bold text-[#2D2926]">{title}</h3>
          {actionButton && <div onClick={(e) => e.preventDefault()} className="ml-2">{actionButton}</div>}
        </div>
        <span className="material-symbols-outlined text-[#7D746D] transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="space-y-1 px-2 pb-4">{children}</div>
    </details>
  );
}

function EditDeleteActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = usePreferences();
  return (
    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[#4A6076] hover:bg-[#F5F0EA] transition"
        title={t("memberProfileEditAction")}
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="flex h-8 w-8 items-center justify-center rounded-full text-red-500 hover:bg-[#FFF1F1] transition"
        title={t("memberProfileDeleteAction")}
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function OverviewTabContent({
  member,
  observations,
  conditions,
  healthSummaries,
  carePlans,
  isEditing,
  onSaveBasicInfo,
  t,
  language,
  locale,
}: {
  member: MemberWithDetails | null;
  observations: ObservationRecord[];
  conditions: ConditionRecord[];
  healthSummaries: HealthSummaryRecord[];
  carePlans: CarePlanRecord[];
  isEditing: boolean;
  onSaveBasicInfo: (data: Partial<AuthMember>) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  language: AppLanguage;
  locale: string;
}) {
  const latestHeight = latestObservationByCode(observations, "body-height");
  const latestWeight = latestObservationByCode(observations, "body-weight");
  
  const [formData, setFormData] = useState({
    name: member?.name || "",
    gender: member?.gender || "female",
    birth_date: member?.birth_date || "",
    human_height: String(member?.height_cm ?? latestHeight?.value ?? ""),
    blood_type: member?.blood_type || "",
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFormData({
      name: member?.name || "",
      gender: member?.gender || "female",
      birth_date: member?.birth_date || "",
      human_height: String(member?.height_cm ?? latestHeight?.value ?? ""),
      blood_type: member?.blood_type || "",
    });
  }, [member, latestHeight?.value, isEditing]);

  const heightValue = member?.height_cm ?? latestHeight?.value;
  const weightValue = latestWeight?.value ?? member?.weight_kg;
  const heightWeightText =
    heightValue != null && weightValue != null
      ? `${heightValue} cm / ${weightValue} kg`
      : heightValue != null
        ? `${heightValue} cm`
        : weightValue != null
          ? `${weightValue} kg`
          : "—";

  const allergyConditions = conditions.filter((item) => item.category === "allergy");
  const allergyText = allergyConditions.length > 0 ? allergyConditions.map((item) => item.display_name).join("、") : "—";
  const todayReminders = carePlans.filter((item) => item.status === "active" && isToday(item.scheduled_at));
  const summaryCards = buildHealthSummaryCards(
    healthSummaries,
    t("homeHealthSummaryAwaiting"),
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveBasicInfo({
        name: formData.name,
        gender: formData.gender,
        birth_date: formData.birth_date || null,
        height_cm: formData.human_height ? parseInt(formData.human_height, 10) : null,
        blood_type: formData.blood_type || null,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-6">
          <SectionHeader title={t("memberProfileBasicInfo")} />
        </div>
        
        {isEditing ? (
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-[#F2EDE7] bg-[#F9F6F3] p-6">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileName")}</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm outline-none focus:border-[#4A6076]"
                placeholder={t("memberProfileNamePlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileGender")}</label>
              <select
                value={formData.gender}
                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                className="w-full rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm outline-none focus:border-[#4A6076]"
              >
                <option value="male">{t("memberProfileGenderMale")}</option>
                <option value="female">{t("memberProfileGenderFemale")}</option>
                <option value="other">{t("memberProfileGenderOther")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileBirthDate")}</label>
              <input
                type="date"
                value={formData.birth_date}
                onChange={e => setFormData({ ...formData, birth_date: e.target.value })}
                className="w-full rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm outline-none focus:border-[#4A6076]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileHeightCm")}</label>
              <input
                type="number"
                value={formData.human_height}
                onChange={e => setFormData({ ...formData, human_height: e.target.value })}
                className="w-full rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm outline-none focus:border-[#4A6076]"
                placeholder={t("memberProfileHeightPlaceholder")}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileBloodType")}</label>
              <select
                value={formData.blood_type}
                onChange={e => setFormData({ ...formData, blood_type: e.target.value })}
                className="w-full rounded-xl border border-[#F2EDE7] px-3 py-2 text-sm outline-none focus:border-[#4A6076]"
              >
                <option value="">{t("memberProfileBloodUnknown")}</option>
                <option value="A+">{t("memberProfileBloodTypeA")}</option>
                <option value="B+">{t("memberProfileBloodTypeB")}</option>
                <option value="AB+">{t("memberProfileBloodTypeAB")}</option>
                <option value="O+">{t("memberProfileBloodTypeO")}</option>
              </select>
            </div>
            <div className="col-span-2 pt-2 flex justify-end">
              <Button loading={isSaving} onClick={handleSave} size="sm">{t("memberProfileSaveBasic")}</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-6">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileHeightWeight")}</p>
              <p className="text-[15px] text-[#2D2926]">{heightWeightText}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileBloodType")}</p>
              <p className="text-[15px] text-[#2D2926]">{member?.blood_type ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileAge")}</p>
              <p className="text-[15px] text-[#2D2926]">{calculateAge(member?.birth_date ?? null) ?? "—"}</p>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{t("memberProfileAllergies")}</p>
              <p className="text-[15px] text-[#2D2926]">{allergyText}</p>
            </div>
          </div>
        )}
        <div className="mt-10 h-px bg-[#F2EDE7]" />
      </section>

      <section>
        <SectionHeader
          title={t("memberProfileAiSummaryTitle")}
          badge={
            <span className="rounded-md border border-[#F2EDE7] bg-[#F9F6F3] px-2 py-0.5 text-[10px] text-[#7D746D]">
              {t("memberProfileAiSummaryBadge")}
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-4">
          {summaryCards.map((card, cardIndex) => (
            <div
              className="flex h-28 flex-col justify-center rounded-2xl border border-[#F2EDE7]/50 bg-[#F9F6F3] p-5 cursor-pointer hover:bg-[#F5F0EA] transition group"
              key={`${card.label ?? "placeholder"}-${cardIndex}`}
            >
              {card.label ? (
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[#7D746D]">{card.label}</p>
              ) : null}
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full shadow-apple-sm ${summaryTone(card.status)}`} />
                <p className="text-[13px] text-[#4A443F] font-medium leading-relaxed line-clamp-2">{card.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title={t("memberProfileTodayReminders")} />
        {todayReminders.length === 0 ? (
          <p className="py-5 text-[15px] text-[#7D746D]">{t("memberProfileNoRemindersToday")}</p>
        ) : (
          <div className="divide-y divide-[#F2EDE7]">
            {todayReminders.map((reminder) => (
              <div className="flex items-center gap-6 py-5 group transition-colors hover:bg-white/50" key={reminder.id}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F0EA] text-[#4A443F] shadow-apple-xs group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[24px]">notifications_active</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-[#2D2926]">{reminder.title}</p>
                  <p className="mt-0.5 text-[13px] text-[#7D746D]">
                    {translateCareTimeSlot(reminder.time_slot, language, t)} · {formatTime(reminder.scheduled_at, locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Health Data Tab Content ──────────────────────────────────────────────────

function HealthDataTabContent({
  observations,
  sleepRecords,
  workoutRecords,
  isEditing,
  onSaveSleepRecord,
  onDeleteSleepRecord,
  onSaveWorkoutRecord,
  onDeleteWorkoutRecord,
  t,
  locale,
}: {
  observations: ObservationRecord[];
  sleepRecords: SleepRecord[];
  workoutRecords: WorkoutRecord[];
  isEditing: boolean;
  onSaveSleepRecord: (id: string | null, payload: any) => Promise<void>;
  onDeleteSleepRecord: (id: string) => Promise<void>;
  onSaveWorkoutRecord: (id: string | null, payload: any) => Promise<void>;
  onDeleteWorkoutRecord: (id: string) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  locale: string;
}) {
  const [sleepForm, setSleepForm] = useState<{ id: string | null; start: string; end: string; nap: boolean } | null>(null);
  const [workoutForm, setWorkoutForm] = useState<{ id: string | null; type: string; start: string; end: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const chronicCodes = ["bp-systolic", "bp-diastolic", "blood-glucose"];
  const vitalCodes = ["heart-rate", "blood-oxygen", "body-weight", "body-temperature"];
  const lifestyleCodes = ["step-count", "active-calories"];
  const sleepCodes = ["sleep-duration"];

  const chronicObservations = observationsByCode(observations, chronicCodes);
  const vitalObservations = observationsByCode(observations, vitalCodes);
  const lifestyleObservations = observationsByCode(observations, lifestyleCodes);
  const sleepObservations = observationsByCode(observations, sleepCodes);

  const systolicObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "bp-systolic"));
  const diastolicObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "bp-diastolic"));
  const glucoseObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "blood-glucose"));
  const stepObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "step-count"));
  const activeCaloriesObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "active-calories"));
  const sleepObservationsSorted = sortByEffectiveAtDesc(observations.filter((item) => item.code === "sleep-duration"));

  const stepTarget = 6000;
  const latestSystolic = systolicObservations[0];
  const latestDiastolic = diastolicObservations[0];
  const latestGlucose = glucoseObservations[0];
  const latestHeart = vitalObservations.find((item) => item.code === "heart-rate");
  const latestOxygen = vitalObservations.find((item) => item.code === "blood-oxygen");
  const latestWeight = vitalObservations.find((item) => item.code === "body-weight");
  const latestTemperature = vitalObservations.find((item) => item.code === "body-temperature");
  const latestStep = stepObservations[0];
  const latestActiveCalories = activeCaloriesObservations[0];
  const latestSleepObservation = sleepObservationsSorted[0];
  
  const latestSleepRecord = [...sleepRecords].sort((left, right) => right.start_at.localeCompare(left.start_at))[0];
  const latestWorkoutRecord = [...workoutRecords].sort((left, right) => right.start_at.localeCompare(left.start_at))[0];

  const bpValue =
    latestSystolic && latestDiastolic
      ? `${getNumericValue(latestSystolic) ?? "—"}/${getNumericValue(latestDiastolic) ?? "—"}`
      : latestSystolic
        ? `${getNumericValue(latestSystolic) ?? "—"}`
        : latestDiastolic
          ? `${getNumericValue(latestDiastolic) ?? "—"}`
          : "—";
  const bpTimestamp = latestSystolic?.effective_at ?? latestDiastolic?.effective_at ?? null;
  const bpHistory = systolicObservations.length > 0 ? systolicObservations : diastolicObservations;

  const handleSleepSubmit = async () => {
    if (!sleepForm) return;
    setIsSubmitting(true);
    try {
      const start = new Date(sleepForm.start);
      const end = new Date(sleepForm.end);
      const diffStr = ((end.getTime() - start.getTime()) / 60000).toFixed(0);
      const payload = {
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        total_minutes: parseInt(diffStr, 10),
        is_nap: sleepForm.nap,
        source: "manual",
      };
      await onSaveSleepRecord(sleepForm.id, payload);
      setSleepForm(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWorkoutSubmit = async () => {
    if (!workoutForm) return;
    setIsSubmitting(true);
    try {
      const start = new Date(workoutForm.start);
      const end = new Date(workoutForm.end);
      const diffStr = ((end.getTime() - start.getTime()) / 60000).toFixed(0);
      const payload = {
        type: workoutForm.type,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        duration_minutes: parseInt(diffStr, 10),
        source: "manual",
      };
      await onSaveWorkoutRecord(workoutForm.id, payload);
      setWorkoutForm(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      if (deletingId.startsWith("sleep_")) {
        await onDeleteSleepRecord(deletingId.replace("sleep_", ""));
      } else if (deletingId.startsWith("workout_")) {
        await onDeleteWorkoutRecord(deletingId.replace("workout_", ""));
      }
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <CollapsibleSection accentClass="bg-rose-400" title={t("memberProfileHealthChronicMetrics")}>
        {chronicObservations.length === 0 ? (
          <p className="py-6 text-sm text-[#7D746D] px-4">{t("memberProfileNoChronicData")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 px-4 pb-4">
            {(latestSystolic || latestDiastolic) && (
              <MetricCard
                history={bpHistory}
                label={t("memberProfileLabelBloodPressure")}
                showMiniChart
                timestamp={formatHealthTimestamp(bpTimestamp, locale, t)}
                unit="mmHg"
                value={bpValue}
              />
            )}
            {latestGlucose && (
              <MetricCard
                history={glucoseObservations}
                label={t("memberProfileLabelBloodGlucose")}
                showMiniChart
                timestamp={formatHealthTimestamp(latestGlucose.effective_at, locale, t)}
                unit={latestGlucose.unit ?? "mmol/L"}
                value={getNumericValue(latestGlucose) ?? latestGlucose.value_string ?? "—"}
              />
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-[#4A6076]" title={t("memberProfileVitalMetrics")}>
        {vitalObservations.length === 0 ? (
          <p className="py-6 text-sm text-[#7D746D] px-4">{t("memberProfileNoVitalData")}</p>
        ) : (
          <div className="grid grid-cols-4 gap-4 px-4 pb-4">
            {latestHeart && (
              <MetricCard
                history={[]}
                label={t("memberProfileLabelHeartRate")}
                timestamp={formatHealthTimestamp(latestHeart.effective_at, locale, t)}
                unit={latestHeart.unit ?? "bpm"}
                value={getNumericValue(latestHeart) ?? "—"}
              />
            )}
            {latestOxygen && (
              <MetricCard
                history={[]}
                label={t("memberProfileLabelSpO2")}
                timestamp={formatHealthTimestamp(latestOxygen.effective_at, locale, t)}
                unit={latestOxygen.unit ?? "%"}
                value={getNumericValue(latestOxygen) ?? "—"}
              />
            )}
            {latestWeight && (
              <MetricCard
                history={[]}
                label={t("memberProfileLabelWeight")}
                timestamp={formatHealthTimestamp(latestWeight.effective_at, locale, t)}
                unit={latestWeight.unit ?? "kg"}
                value={getNumericValue(latestWeight) ?? "—"}
              />
            )}
            {latestTemperature && (
              <MetricCard
                history={[]}
                label={t("memberProfileLabelTemperature")}
                timestamp={formatHealthTimestamp(latestTemperature.effective_at, locale, t)}
                unit={latestTemperature.unit ?? "°C"}
                value={getNumericValue(latestTemperature) ?? "—"}
              />
            )}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-emerald-400" title={t("memberProfileLifestyle")}>
        <div className="grid grid-cols-2 gap-4 px-4 pb-4">
          {latestStep && (
            <div className="rounded-2xl border border-[#F2EDE7] bg-[#F9F6F3] p-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#7D746D]">{t("memberProfileSteps")}</p>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-[#2D2926]">
                  {getNumericValue(latestStep) ?? latestStep.value_string ?? "—"}
                </span>
                <span className="text-sm text-[#7D746D]">{t("memberProfileGoalPrefix", { value: stepTarget.toLocaleString(locale) })}</span>
              </div>
            </div>
          )}
          {latestWorkoutRecord && (
            <div className="rounded-2xl border border-[#F2EDE7] bg-[#F9F6F3] p-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#7D746D]">{t("memberProfileActiveMinutes")}</p>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-bold text-[#2D2926]">{latestWorkoutRecord.duration_minutes}</span>
                <span className="text-sm text-[#7D746D]">{t("memberProfileMinutes")}</span>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        accentClass="bg-[#2D4F3E]"
        title={t("memberProfileSleep")}
        actionButton={isEditing ? (
          <button
            onClick={() => setSleepForm({ id: null, start: "", end: "", nap: false })}
            className="flex items-center gap-1 rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-bold text-[#2D2926] transition hover:bg-[#F2EDE7]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>{t("memberProfileAdd")}
          </button>
        ) : null}
      >
        <div className="px-4 pb-4 space-y-4">
          {sleepRecords.length === 0 ? (
            <p className="py-2 text-sm text-[#7D746D]">{t("memberProfileNoSleepData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#F2EDE7] text-[11px] uppercase tracking-wider text-[#7D746D]">
                    <th className="py-2 text-left font-medium">{t("memberProfileSleepColPeriod")}</th>
                    <th className="py-2 text-left font-medium">{t("memberProfileSleepColDuration")}</th>
                    <th className="py-2 text-left font-medium">{t("memberProfileSleepColNap")}</th>
                    {isEditing && <th className="py-2 text-right">{t("memberProfileColActions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...sleepRecords].sort((l, r) => r.start_at.localeCompare(l.start_at)).slice(0, 10).map((item) => (
                    <tr className="border-b border-gray-50 group hover:bg-[#F9F6F3] transition-colors" key={item.id}>
                      <td className="py-3 font-mono text-[#2D2926]">{formatHealthTimestamp(item.start_at, locale, t)} - {formatTime(item.end_at, locale)}</td>
                      <td className="py-3 font-bold text-[#2D2926]">{(item.total_minutes / 60).toFixed(1)}h</td>
                      <td className="py-3 text-[#7D746D]">{item.is_nap ? t("commonYes") : t("commonNo")}</td>
                      {isEditing && (
                        <td className="py-3 text-right">
                          <EditDeleteActions
                            onEdit={() => setSleepForm({
                              id: item.id,
                              start: item.start_at.slice(0, 16),
                              end: item.end_at.slice(0, 16),
                              nap: item.is_nap || false
                            })}
                            onDelete={() => setDeletingId(`sleep_${item.id}`)}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        accentClass="bg-[#B8860B]"
        title={t("memberProfileWorkouts")}
        actionButton={isEditing ? (
          <button
            onClick={() => setWorkoutForm({ id: null, type: "", start: "", end: "" })}
            className="flex items-center gap-1 rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-bold text-[#2D2926] transition hover:bg-[#F2EDE7]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>{t("memberProfileAdd")}
          </button>
        ) : null}
      >
        <div className="px-4 pb-4 space-y-4">
          {workoutRecords.length === 0 ? (
            <p className="py-2 text-sm text-[#7D746D]">{t("memberProfileNoWorkoutData")}</p>
          ) : (
            <div className="space-y-4 mt-2">
              {[...workoutRecords].sort((l, r) => r.start_at.localeCompare(l.start_at)).slice(0, 6).map((item) => (
                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#F2EDE7] bg-[#F9F6F3] px-5 py-4 sm:flex-row md:items-center group hover:bg-[#F5F0EA] transition" key={item.id}>
                  <div>
                    <p className="text-base font-bold text-[#2D2926]">{item.type}</p>
                    <p className="mt-1 text-sm text-[#7D746D]">{t("memberProfileWorkoutDuration", {
                      minutes: item.duration_minutes,
                      extra: item.distance_meters ? `· ${(item.distance_meters / 1000).toFixed(1)} km` : "",
                    })}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono text-[#7D746D]">{formatHealthTimestamp(item.start_at, locale, t)}</span>
                    {isEditing && (
                      <EditDeleteActions
                        onEdit={() => setWorkoutForm({
                          id: item.id,
                          type: item.type,
                          start: item.start_at.slice(0, 16),
                          end: item.end_at.slice(0, 16)
                        })}
                        onDelete={() => setDeletingId(`workout_${item.id}`)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      <ResourceFormModal
        isOpen={Boolean(sleepForm)}
        onClose={() => setSleepForm(null)}
        title={sleepForm?.id ? t("memberProfileModalEditSleep") : t("memberProfileModalAddSleep")}
        isSubmitting={isSubmitting}
        onSubmit={handleSleepSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileSleepStart")}</label>
            <input type="datetime-local" value={sleepForm?.start || ""} onChange={(e) => setSleepForm(s => s ? { ...s, start: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileSleepEnd")}</label>
            <input type="datetime-local" value={sleepForm?.end || ""} onChange={(e) => setSleepForm(s => s ? { ...s, end: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="napCheck" checked={sleepForm?.nap || false} onChange={(e) => setSleepForm(s => s ? { ...s, nap: e.target.checked } : null)} className="h-4 w-4 rounded border-gray-300 text-[#4A6076]" />
            <label htmlFor="napCheck" className="text-sm font-medium text-[#2D2926]">{t("memberProfileSleepIsNap")}</label>
          </div>
        </div>
      </ResourceFormModal>

      <ResourceFormModal
        isOpen={Boolean(workoutForm)}
        onClose={() => setWorkoutForm(null)}
        title={workoutForm?.id ? t("memberProfileModalEditWorkout") : t("memberProfileModalAddWorkout")}
        isSubmitting={isSubmitting}
        onSubmit={handleWorkoutSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileWorkoutType")}</label>
            <input type="text" value={workoutForm?.type || ""} onChange={(e) => setWorkoutForm(w => w ? { ...w, type: e.target.value } : null)} placeholder={t("memberProfileWorkoutTypePlaceholder")} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileWorkoutStart")}</label>
            <input type="datetime-local" value={workoutForm?.start || ""} onChange={(e) => setWorkoutForm(w => w ? { ...w, start: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileWorkoutEnd")}</label>
            <input type="datetime-local" value={workoutForm?.end || ""} onChange={(e) => setWorkoutForm(w => w ? { ...w, end: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2" />
          </div>
        </div>
      </ResourceFormModal>
      
      <ConfirmDeleteDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteRecordMessage")}
        isDeleting={isSubmitting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ─── Health Records Tab Content (Conditions) ──────────────────────────────────

function HealthRecordsTabContent({
  conditions,
  isEditing,
  onSaveCondition,
  onDeleteCondition,
  t,
  locale,
}: {
  conditions: ConditionRecord[];
  isEditing: boolean;
  onSaveCondition: (id: string | null, payload: any) => Promise<void>;
  onDeleteCondition: (id: string) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
  locale: string;
}) {
  const [formState, setFormState] = useState<{ id: string | null; category: string; name: string; status: string; date: string; notes: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeConditions = conditions.filter(
    (item) => item.clinical_status === "active" && item.category !== "allergy" && item.category !== "family-history",
  );
  const resolvedConditions = conditions.filter(
    (item) =>
      (item.clinical_status === "resolved" || item.clinical_status === "inactive") &&
      item.category !== "allergy" &&
      item.category !== "family-history",
  );
  const familyConditions = conditions.filter((item) => item.category === "family-history");
  const allergyConditions = conditions.filter((item) => item.category === "allergy");

  const handleSubmit = async () => {
    if (!formState || !formState.name.trim() || !formState.category) return;
    setIsSubmitting(true);
    try {
      const payload = {
        category: formState.category,
        display_name: formState.name,
        clinical_status: formState.status,
        onset_date: formState.date || null,
        notes: formState.notes || null,
        source: "manual",
      };
      await onSaveCondition(formState.id, payload);
      setFormState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await onDeleteCondition(deletingId);
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const AddButton = ({ category, defaultStatus }: { category: string; defaultStatus: string }) => isEditing ? (
    <button
      onClick={() => setFormState({ id: null, category, name: "", status: defaultStatus, date: "", notes: "" })}
      className="flex items-center gap-1 rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-bold text-[#2D2926] transition hover:bg-[#F2EDE7]"
    >
      <span className="material-symbols-outlined text-[16px]">add</span>{t("memberProfileAdd")}
    </button>
  ) : null;

  return (
    <div className="space-y-6">
      <CollapsibleSection accentClass="bg-[#2D4F3E]" title={t("memberProfileHealthCurrentIllness")} actionButton={<AddButton category="chronic" defaultStatus="active" />}>
        {activeConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#7D746D]">{t("memberProfileNoRecords")}</p>
        ) : (
          <div className="space-y-2 px-2">
            {activeConditions.map((item) => (
              <div className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-[#F9F6F3] transition group" key={item.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#2D4F3E]">{item.display_name}</p>
                  {item.notes && <p className="mt-0.5 text-sm text-[#7D746D] clamp-2">{item.notes}</p>}
                  <p className="mt-1 text-xs text-[#7D746D]">{t("memberProfileOnsetDate", { date: formatDate(item.onset_date, locale) })}</p>
                </div>
                {isEditing && (
                  <EditDeleteActions
                    onEdit={() => setFormState({ id: item.id, category: item.category, name: item.display_name, status: item.clinical_status || "active", date: item.onset_date || "", notes: item.notes || "" })}
                    onDelete={() => setDeletingId(item.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-[#4A6076]" title={t("memberProfileHealthPastIllness")} actionButton={<AddButton category="chronic" defaultStatus="resolved" />}>
        {resolvedConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#7D746D]">{t("memberProfileNoRecords")}</p>
        ) : (
          <div className="space-y-2 px-2">
            {resolvedConditions.map((item) => (
              <div className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-[#F9F6F3] transition group" key={item.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[#2D2926]">{item.display_name}</p>
                    <span className="rounded-full bg-[#E5F1EB] px-2 py-0.5 text-xs text-[#2D4F3E]">
                      {item.clinical_status === "resolved" ? t("memberProfileStatusResolved") : t("memberProfileStatusInactiveLabel")}
                    </span>
                  </div>
                  {item.notes && <p className="mt-0.5 text-sm text-[#7D746D]">{item.notes}</p>}
                  <p className="mt-1 text-xs text-[#7D746D]">{t("memberProfileRecordDate", { date: formatDate(item.onset_date, locale) })}</p>
                </div>
                {isEditing && (
                  <EditDeleteActions
                    onEdit={() => setFormState({ id: item.id, category: item.category, name: item.display_name, status: item.clinical_status || "resolved", date: item.onset_date || "", notes: item.notes || "" })}
                    onDelete={() => setDeletingId(item.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-[#B8860B]" title={t("memberProfileHealthFamilyHistory")} actionButton={<AddButton category="family-history" defaultStatus="active" />}>
        {familyConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#7D746D]">{t("memberProfileNoRecords")}</p>
        ) : (
          <div className="space-y-2 px-2">
            {familyConditions.map((item) => (
              <div className="flex items-center justify-between rounded-2xl px-4 py-4 hover:bg-[#F9F6F3] transition group" key={item.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#2D2926]">{item.display_name}</p>
                  {item.notes && <p className="mt-0.5 text-sm text-[#7D746D]">{item.notes}</p>}
                </div>
                {isEditing && (
                  <EditDeleteActions
                    onEdit={() => setFormState({ id: item.id, category: item.category, name: item.display_name, status: item.clinical_status || "active", date: item.onset_date || "", notes: item.notes || "" })}
                    onDelete={() => setDeletingId(item.id)}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-red-500" title={t("memberProfileHealthAllergies")} actionButton={<AddButton category="allergy" defaultStatus="active" />}>
        {allergyConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-[#7D746D]">{t("memberProfileNoRecords")}</p>
        ) : (
          <div className="space-y-3 px-2">
            {allergyConditions.map((item) => (
              <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-[#FFF1F1] p-4 group" key={item.id}>
                <div className="flex items-start gap-3 flex-1">
                  <span className="material-symbols-outlined shrink-0 text-[20px] text-red-500">warning</span>
                  <div>
                    <p className="font-bold text-red-600">{item.display_name}</p>
                    {item.notes && <p className="mt-0.5 text-sm text-red-400">{item.notes}</p>}
                  </div>
                </div>
                {isEditing && (
                  <div className="ml-4 shrink-0">
                    <EditDeleteActions
                      onEdit={() => setFormState({ id: item.id, category: item.category, name: item.display_name, status: item.clinical_status || "active", date: item.onset_date || "", notes: item.notes || "" })}
                      onDelete={() => setDeletingId(item.id)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>

      <ResourceFormModal
        isOpen={Boolean(formState)}
        onClose={() => setFormState(null)}
        title={formState?.id ? t("memberProfileModalEditCondition") : t("memberProfileModalAddCondition")}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileConditionName")}</label>
            <input type="text" value={formState?.name || ""} onChange={(e) => setFormState(s => s ? { ...s, name: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileConditionNamePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileCategory")}</label>
              <select value={formState?.category || ""} onChange={(e) => setFormState(s => s ? { ...s, category: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]">
                <option value="chronic">{t("memberProfileCategoryChronic")}</option>
                <option value="diagnosis">{t("memberProfileCategoryDiagnosis")}</option>
                <option value="allergy">{t("memberProfileCategoryAllergy")}</option>
                <option value="family-history">{t("memberProfileCategoryFamilyHistory")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileClinicalStatus")}</label>
              <select value={formState?.status || ""} onChange={(e) => setFormState(s => s ? { ...s, status: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]">
                <option value="active">{t("memberProfileStatusActiveChronic")}</option>
                <option value="resolved">{t("memberProfileStatusResolvedOption")}</option>
                <option value="inactive">{t("memberProfileStatusInactiveOption")}</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileOnsetOrRecordDate")}</label>
            <input type="date" value={formState?.date || ""} onChange={(e) => setFormState(s => s ? { ...s, date: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileNotes")}</label>
            <textarea value={formState?.notes || ""} onChange={(e) => setFormState(s => s ? { ...s, notes: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076] min-h-24 resize-none" placeholder={t("memberProfileNotesPlaceholder")} />
          </div>
        </div>
      </ResourceFormModal>

      <ConfirmDeleteDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title={t("confirmDeleteTitle")}
        isDeleting={isSubmitting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ─── Encounters Tab ────────────────────────────────────────────────────────────

function encounterTypeToLabel(
  type: string,
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string,
): string {
  const normalized = type?.toLowerCase() ?? "";
  if (normalized === "follow-up" || normalized === "复查" || normalized === "checkup")
    return t("encounterTypeFollowUp");
  if (normalized === "initial" || normalized === "初诊" || normalized === "outpatient")
    return t("encounterTypeOutpatient");
  if (normalized === "examination" || normalized === "检查")
    return t("encounterTypeExam");
  if (normalized === "inpatient") return t("encounterTypeInpatient");
  if (normalized === "emergency") return t("encounterTypeEmergency");
  return type || t("encounterTypeDefault");
}

function encounterTypeBadgeClass(type: string): string {
  const normalized = type?.toLowerCase() ?? "";
  if (normalized === "follow-up" || normalized === "复查" || normalized === "checkup")
    return "bg-blue-50 text-blue-600";
  if (normalized === "initial" || normalized === "初诊" || normalized === "outpatient")
    return "bg-orange-50 text-orange-600";
  if (normalized === "examination" || normalized === "检查")
    return "bg-green-50 text-green-600";
  if (normalized === "emergency") return "bg-red-50 text-red-600";
  return "bg-gray-50 text-gray-600";
}

function formatEncounterDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function EncountersTabContent({
  encounters,
  isEditing,
  onSaveEncounter,
  onDeleteEncounter,
  t,
}: {
  encounters: EncounterRecord[];
  isEditing: boolean;
  onSaveEncounter: (id: string | null, payload: any) => Promise<void>;
  onDeleteEncounter: (id: string) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}) {
  const [formState, setFormState] = useState<{ id: string | null; date: string; type: string; facility: string; department: string; doctor: string; summary: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = [...encounters].sort((left, right) => (right.date || "").localeCompare(left.date || ""));

  const handleSubmit = async () => {
    if (!formState || !formState.date) return;
    setIsSubmitting(true);
    try {
      const payload = {
        date: formState.date,
        type: formState.type || "outpatient",
        facility: formState.facility || null,
        department: formState.department || null,
        attending_physician: formState.doctor || null,
        summary: formState.summary || null,
        source: "manual",
      };
      await onSaveEncounter(formState.id, payload);
      setFormState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await onDeleteEncounter(deletingId);
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-xl font-bold text-[#2D2926]">{t("memberProfileEncountersTitle")}</h3>
        <div className="flex gap-2">
          {isEditing && (
            <Button
              onClick={() => setFormState({ id: null, date: formatEncounterDate(new Date().toISOString()), type: "outpatient", facility: "", department: "", doctor: "", summary: "" })}
              size="sm"
              icon={<span className="material-symbols-outlined text-[18px]">add</span>}
            >
              {t("memberProfileEncounterAdd")}
            </Button>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-[#7D746D]">{t("memberProfileNoEncounters")}</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((item) => (
            <details className="group overflow-hidden rounded-2xl border border-[#F2EDE7] bg-white shadow-soft" key={item.id}>
              <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5 hover:bg-[#F9F6F3]">
                <div className="grid flex-1 grid-cols-12 items-center gap-4">
                  <div className="col-span-2">
                    <span className="text-[13px] font-mono text-[#7D746D]">{formatEncounterDate(item.date)}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-[15px] font-bold text-[#2D2926]">{item.facility || t("memberProfileFacilityUnset")}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[13px] text-[#4A6076]">{item.department || encounterTypeToLabel(item.type, t)}</span>
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${encounterTypeBadgeClass(item.type)}`}>
                      {encounterTypeToLabel(item.type, t)}
                    </span>
                    <span className="truncate text-[14px] text-[#7D746D]">{item.summary || ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => { if (isEditing) e.preventDefault(); }}>
                  {isEditing && (
                    <EditDeleteActions
                      onEdit={() => setFormState({ id: item.id, date: item.date || "", type: item.type, facility: item.facility || "", department: item.department || "", doctor: item.attending_physician || "", summary: item.summary || "" })}
                      onDelete={() => setDeletingId(item.id)}
                    />
                  )}
                  <span className="material-symbols-outlined ml-2 text-[#7D746D] transition-transform group-open:rotate-180">
                    expand_more
                  </span>
                </div>
              </summary>
              <div className="mt-1 border-t border-[#F2EDE7] px-6 pb-6 pt-2">
                <div className="grid grid-cols-3 gap-8 py-4">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#7D746D]">{t("memberProfileEncounterDoctor")}</p>
                    <p className="text-[15px] font-medium text-[#2D2926]">{item.attending_physician || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#7D746D]">{t("memberProfileEncounterDetail")}</p>
                    <p className="text-[14px] leading-relaxed text-[#4A443F]">{item.summary || "—"}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      <ResourceFormModal
        isOpen={Boolean(formState)}
        onClose={() => setFormState(null)}
        title={formState?.id ? t("memberProfileModalEditEncounter") : t("memberProfileModalAddEncounter")}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileEncounterDate")}</label>
              <input type="date" value={formState?.date || ""} onChange={(e) => setFormState(s => s ? { ...s, date: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileEncounterType")}</label>
              <select value={formState?.type || ""} onChange={(e) => setFormState(s => s ? { ...s, type: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]">
                <option value="outpatient">{t("memberProfileEncounterTypeOutpatient")}</option>
                <option value="inpatient">{t("memberProfileEncounterTypeInpatient")}</option>
                <option value="checkup">{t("memberProfileEncounterTypeCheckup")}</option>
                <option value="emergency">{t("memberProfileEncounterTypeEmergency")}</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileFacility")}</label>
              <input type="text" value={formState?.facility || ""} onChange={(e) => setFormState(s => s ? { ...s, facility: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileFacilityPlaceholder")} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileDepartment")}</label>
              <input type="text" value={formState?.department || ""} onChange={(e) => setFormState(s => s ? { ...s, department: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileDepartmentPlaceholder")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileEncounterDoctor")}</label>
            <input type="text" value={formState?.doctor || ""} onChange={(e) => setFormState(s => s ? { ...s, doctor: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileDoctorPlaceholder")} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileEncounterDetail")}</label>
            <textarea value={formState?.summary || ""} onChange={(e) => setFormState(s => s ? { ...s, summary: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076] min-h-24 resize-none" placeholder={t("memberProfileEncounterSummaryPlaceholder")} />
          </div>
        </div>
      </ResourceFormModal>

      <ConfirmDeleteDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title={t("confirmDeleteTitle")}
        isDeleting={isSubmitting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ─── Medications Tab ───────────────────────────────────────────────────────────

function formatMedicationDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function MedicationsTabContent({
  medications,
  isEditing,
  onSaveMedication,
  onDeleteMedication,
  t,
}: {
  medications: MedicationRecord[];
  isEditing: boolean;
  onSaveMedication: (id: string | null, payload: any) => Promise<void>;
  onDeleteMedication: (id: string) => Promise<void>;
  t: (key: TranslationKey, variables?: Record<string, string | number>) => string;
}) {
  const [formState, setFormState] = useState<{ id: string | null; name: string; status: string; startDate: string; endDate: string; dosage: string; indication: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const active = medications.filter((item) => item.status === "active");
  const stopped = medications.filter((item) => item.status !== "active");

  const handleSubmit = async () => {
    if (!formState || !formState.name.trim()) return;
    setIsSubmitting(true);
    try {
      const payload = {
        name: formState.name,
        status: formState.status,
        dosage_description: formState.dosage || null,
        indication: formState.indication || null,
        start_date: formState.startDate || null,
        end_date: formState.endDate || null,
        source: "manual",
      };
      await onSaveMedication(formState.id, payload);
      setFormState(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setIsSubmitting(true);
    try {
      await onDeleteMedication(deletingId);
      setDeletingId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-end -mb-4">
        {isEditing && (
          <Button
            onClick={() => setFormState({ id: null, name: "", status: "active", startDate: formatMedicationDate(new Date().toISOString()).replace(/\./g, '-'), endDate: "", dosage: "", indication: "" })}
            size="sm"
            icon={<span className="material-symbols-outlined text-[18px]">add</span>}
          >
            {t("memberProfileMedicationAdd")}
          </Button>
        )}
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <span className="h-6 w-1.5 rounded-full bg-[#2D4F3E]" />
          <h3 className="text-lg font-bold text-[#2D2926]">{t("memberProfileMedicationTaking")}</h3>
        </div>
        {active.length === 0 ? (
          <p className="py-6 text-sm text-[#7D746D] px-4">{t("memberProfileNoActiveMeds")}</p>
        ) : (
          <div className="space-y-4">
            {active.map((item) => (
              <div className="flex flex-col justify-between gap-6 rounded-3xl border border-[#F2EDE7] bg-[#F9F6F3] p-6 shadow-soft md:flex-row md:items-center group hover:bg-[#F5F0EA] transition" key={item.id}>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[17px] font-bold text-[#2D2926]">
                      {item.name} <span className="ml-1 font-normal text-[#7D746D]">{item.dosage_description ?? "—"}</span>
                    </h4>
                    <span className="rounded-full bg-[#E5F1EB] px-3 py-0.5 text-[11px] font-semibold tracking-wide text-[#2D4F3E]">
                      {t("memberProfileMedicationActiveBadge")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-[#4A443F]">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#7D746D]">info</span>
                      <span>{item.indication ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-[#7D746D]">schedule</span>
                      <span>{item.dosage_description ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start shrink-0 md:items-end gap-2">
                  <div className="flex flex-col items-end">
                    <span className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#7D746D]">{t("memberProfileMedicationStartedLabel")}</span>
                    <span className="rounded-lg bg-white px-3 py-1 font-mono text-[13px] font-medium text-[#2D2926] shadow-apple-xs">
                      {formatMedicationDate(item.start_date)}
                    </span>
                  </div>
                  {isEditing && (
                    <EditDeleteActions
                      onEdit={() => setFormState({ id: item.id, name: item.name, status: item.status, startDate: item.start_date || "", endDate: item.end_date || "", dosage: item.dosage_description || "", indication: item.indication || "" })}
                      onDelete={() => setDeletingId(item.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {stopped.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <span className="h-6 w-1.5 rounded-full bg-[#E5E0DA]" />
            <h3 className="text-lg font-bold text-[#7D746D]">{t("memberProfileMedicationStopped")}</h3>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[#F2EDE7] bg-white">
            <div className="divide-y divide-[#F2EDE7]">
              {stopped.map((item) => (
                <div className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-[#F9F6F3] group" key={item.id}>
                  <div className="flex items-baseline gap-4">
                    <span className="text-[14px] font-medium text-[#7D746D] line-through">{item.name}</span>
                    <span className="text-[12px] text-[#A69C94]">{t("memberProfileMedicationPurpose", { value: item.indication ?? "—" })}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-medium text-[#A69C94]">{t("memberProfileMedicationStoppedDateLabel")}</span>
                      <span className="font-mono text-[12px] text-[#A69C94]">{formatMedicationDate(item.end_date)}</span>
                    </div>
                    {isEditing && (
                      <EditDeleteActions
                        onEdit={() => setFormState({ id: item.id, name: item.name, status: item.status, startDate: item.start_date || "", endDate: item.end_date || "", dosage: item.dosage_description || "", indication: item.indication || "" })}
                        onDelete={() => setDeletingId(item.id)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <ResourceFormModal
        isOpen={Boolean(formState)}
        onClose={() => setFormState(null)}
        title={formState?.id ? t("memberProfileModalEditMedication") : t("memberProfileModalAddMedication")}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileMedicationName")}</label>
            <input type="text" value={formState?.name || ""} onChange={(e) => setFormState(s => s ? { ...s, name: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileMedicationNamePlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileMedicationStatus")}</label>
              <select value={formState?.status || ""} onChange={(e) => setFormState(s => s ? { ...s, status: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]">
                <option value="active">{t("memberProfileMedicationStatusActive")}</option>
                <option value="stopped">{t("memberProfileMedicationStatusStopped")}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileDosage")}</label>
              <input type="text" value={formState?.dosage || ""} onChange={(e) => setFormState(s => s ? { ...s, dosage: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileDosagePlaceholder")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileIndication")}</label>
            <input type="text" value={formState?.indication || ""} onChange={(e) => setFormState(s => s ? { ...s, indication: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" placeholder={t("memberProfileIndicationPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileMedicationStartDate")}</label>
              <input type="date" value={formState?.startDate || ""} onChange={(e) => setFormState(s => s ? { ...s, startDate: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" />
            </div>
            {formState?.status === "stopped" && (
              <div>
                <label className="mb-1 block text-sm font-bold text-[#7D746D]">{t("memberProfileMedicationEndDate")}</label>
                <input type="date" value={formState?.endDate || ""} onChange={(e) => setFormState(s => s ? { ...s, endDate: e.target.value } : null)} className="w-full rounded-xl border border-[#F2EDE7] px-4 py-2 outline-none focus:border-[#4A6076]" />
              </div>
            )}
          </div>
        </div>
      </ResourceFormModal>

      <ConfirmDeleteDialog
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title={t("confirmDeleteTitle")}
        isDeleting={isSubmitting}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

// ─── Main Modal Component ───────────────────────────────────────────────────────

export function MemberProfileModal({
  open,
  onClose,
  memberId,
  refreshToken = 0,
  session,
  members,
}: MemberProfileModalProps) {
  const { t, language } = usePreferences();
  const locale = language === "en" ? "en-US" : "zh-CN";
  const navItemsList = useMemo(() => memberProfileNavItems(t), [t]);

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [state, setState] = useState<MemberProfileState>({
    member: members.find((item) => item.id === memberId) ?? null,
    observations: [],
    sleepRecords: [],
    workoutRecords: [],
    conditions: [],
    medications: [],
    encounters: [],
    healthSummaries: [],
    carePlans: [],
  });

  const canEdit = ["manage", "write"].includes(session.member.permission_level) || session.user.role === "admin";

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const [
        member,
        observations,
        sleepRecords,
        workoutRecords,
        conditions,
        medications,
        encounters,
        healthSummaries,
        carePlans,
      ] = await Promise.all([
        getMember(session, memberId),
        listObservations(session, memberId),
        listSleepRecords(session, memberId),
        listWorkoutRecords(session, memberId),
        listConditions(session, memberId),
        listMedications(session, memberId),
        listEncounters(session, memberId),
        listHealthSummaries(session, memberId),
        listCarePlans(session, memberId),
      ]);

      setState({
        member,
        observations,
        sleepRecords,
        workoutRecords,
        conditions,
        medications,
        encounters,
        healthSummaries,
        carePlans,
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : t("memberProfileLoadError"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !memberId) return;
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId, refreshToken, session]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setActiveTab("overview");
      setIsEditing(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const member = state.member;
  const age = member ? calculateAge(member.birth_date) : null;
  const ageGenderText =
    [
      age != null ? t("memberProfileAgeYears", { count: age }) : null,
      member?.gender === "male"
        ? t("memberProfileGenderMale")
        : member?.gender === "female"
          ? t("memberProfileGenderFemale")
          : member?.gender || null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";

  // Handlers for Overview Edit
  const handleSaveBasicInfo = async (data: Partial<AuthMember>) => {
    await updateMember(session, memberId, data);
    await loadProfile();
  };

  // Handlers for HealthData Tab (Sleep & Workout)
  const handleSaveSleepRecord = async (id: string | null, payload: any) => {
    if (id) await updateSleepRecord(session, memberId, id, payload);
    else await createSleepRecord(session, memberId, payload);
    await loadProfile();
  };
  const handleDeleteSleepRecord = async (id: string) => {
    await deleteSleepRecord(session, memberId, id);
    await loadProfile();
  };

  const handleSaveWorkoutRecord = async (id: string | null, payload: any) => {
    if (id) await updateWorkoutRecord(session, memberId, id, payload);
    else await createWorkoutRecord(session, memberId, payload);
    await loadProfile();
  };
  const handleDeleteWorkoutRecord = async (id: string) => {
    await deleteWorkoutRecord(session, memberId, id);
    await loadProfile();
  };

  // Handlers for Conditions
  const handleSaveCondition = async (id: string | null, payload: any) => {
    if (id) await updateCondition(session, memberId, id, payload);
    else await createCondition(session, memberId, payload);
    await loadProfile();
  };
  const handleDeleteCondition = async (id: string) => {
    await deleteCondition(session, memberId, id);
    await loadProfile();
  };

  // Handlers for Encounters
  const handleSaveEncounter = async (id: string | null, payload: any) => {
    if (id) await updateEncounter(session, memberId, id, payload);
    else await createEncounter(session, memberId, payload);
    await loadProfile();
  };
  const handleDeleteEncounter = async (id: string) => {
    await deleteEncounter(session, memberId, id);
    await loadProfile();
  };

  // Handlers for Medications
  const handleSaveMedication = async (id: string | null, payload: any) => {
    if (id) await updateMedication(session, memberId, id, payload);
    else await createMedication(session, memberId, payload);
    await loadProfile();
  };
  const handleDeleteMedication = async (id: string) => {
    await deleteMedication(session, memberId, id);
    await loadProfile();
  };

  return (
    <div aria-label={t("memberProfileAria")} aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12" role="dialog">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[#2D2926]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative flex h-[85vh] w-[75vw] flex-col overflow-hidden rounded-[2.5rem] border border-white/50 bg-[#F9F6F3] shadow-apple-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-[#F2EDE7] bg-white px-8 py-5">
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-16 w-16 animate-pulse rounded-full bg-[#F2EDE7]" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E5F1EB] text-2xl font-bold text-[#2D4F3E] ring-4 ring-[#F9F6F3]">
                {member?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#2D2926]">{loading ? t("commonLoading") : member?.name ?? "—"}</h2>
                <span className="rounded-full bg-[#F5F0EA] px-3 py-1 text-xs font-semibold text-[#4A443F]">{ageGenderText}</span>
              </div>
              <span className="text-sm text-[#7D746D]">{t("memberProfileLastUpdated", { date: formatDate(member?.updated_at ?? null, locale) })}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {canEdit && (
               <label className="flex items-center gap-2 cursor-pointer bg-[#F5F0EA] px-4 py-2 rounded-full transition hover:bg-[#EAE4DD]">
                 <span className="text-sm font-bold text-[#2D2926]">{t("memberProfileEditMode")}</span>
                 <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isEditing ? 'bg-[#2D2926]' : 'bg-[#D1C8C0]'}`}>
                   <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEditing ? 'translate-x-4' : 'translate-x-0'}`} />
                   <input type="checkbox" className="sr-only" checked={isEditing} onChange={(e) => setIsEditing(e.target.checked)} />
                 </div>
               </label>
             )}
            <button
              aria-label={t("commonClose")}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#4A443F] shadow-apple-xs transition hover:bg-[#F5F0EA] hover:scale-105 active:scale-95 border border-[#F2EDE7]"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="no-scrollbar w-64 shrink-0 overflow-y-auto border-r border-[#F2EDE7] bg-[#FBFBFB] px-4 py-8">
            {navItemsList.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  className={[
                    "mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition font-medium",
                    isActive
                      ? "bg-white text-[#2D2926] shadow-apple-sm border border-[#F2EDE7]"
                      : "text-[#7D746D] hover:bg-white/50 hover:text-[#4A443F]",
                  ].join(" ")}
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <main className="custom-scrollbar flex-1 overflow-y-auto bg-white px-12 py-10 relative">
            {error ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-red-600">
                <span className="material-symbols-outlined text-4xl">error</span>
                <p>{error}</p>
                <Button onClick={loadProfile} variant="secondary">{t("commonRetry")}</Button>
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-full text-[#7D746D] gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#F2EDE7] border-t-[#2D2926]"></div>
                <p>{t("memberProfileLoadingData")}</p>
              </div>
            ) : (
              <div className="fade-in max-w-4xl mx-auto">
                {activeTab === "overview" && (
                  <OverviewTabContent
                    carePlans={state.carePlans}
                    conditions={state.conditions}
                    healthSummaries={state.healthSummaries}
                    member={member}
                    observations={state.observations}
                    isEditing={isEditing}
                    language={language}
                    locale={locale}
                    onSaveBasicInfo={handleSaveBasicInfo}
                    t={t}
                  />
                )}
                {activeTab === "health-data" && (
                  <HealthDataTabContent
                    isEditing={isEditing}
                    locale={locale}
                    observations={state.observations}
                    onDeleteSleepRecord={handleDeleteSleepRecord}
                    onDeleteWorkoutRecord={handleDeleteWorkoutRecord}
                    onSaveSleepRecord={handleSaveSleepRecord}
                    onSaveWorkoutRecord={handleSaveWorkoutRecord}
                    sleepRecords={state.sleepRecords}
                    t={t}
                    workoutRecords={state.workoutRecords}
                  />
                )}
                {activeTab === "health-records" && (
                  <HealthRecordsTabContent
                    conditions={state.conditions}
                    isEditing={isEditing}
                    locale={locale}
                    onDeleteCondition={handleDeleteCondition}
                    onSaveCondition={handleSaveCondition}
                    t={t}
                  />
                )}
                {activeTab === "encounters" && (
                  <EncountersTabContent
                    encounters={state.encounters}
                    isEditing={isEditing}
                    onDeleteEncounter={handleDeleteEncounter}
                    onSaveEncounter={handleSaveEncounter}
                    t={t}
                  />
                )}
                {activeTab === "medications" && (
                  <MedicationsTabContent
                    isEditing={isEditing}
                    medications={state.medications}
                    onDeleteMedication={handleDeleteMedication}
                    onSaveMedication={handleSaveMedication}
                    t={t}
                  />
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
