import { useEffect, useState, type ReactNode } from "react";

import { getMember } from "../api/members";
import {
  listCarePlans,
  listConditions,
  listEncounters,
  listHealthSummaries,
  listMedications,
  listObservations,
  listSleepRecords,
  listWorkoutRecords,
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
import { Button } from "./Button";

type MemberProfileModalProps = {
  open: boolean;
  onClose: () => void;
  memberId: string;
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

const navItems: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "概览", icon: "grid_view" },
  { key: "health-data", label: "健康数据", icon: "monitoring" },
  { key: "health-records", label: "健康档案", icon: "assignment" },
  { key: "encounters", label: "就诊记录", icon: "local_hospital" },
  { key: "medications", label: "药品管理", icon: "medication" },
];

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("zh-CN");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function isToday(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatHealthTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  if (isToday(value)) {
    return `今天 ${formatTime(value)}`;
  }
  return `${date.getMonth() + 1}-${date.getDate().toString().padStart(2, "0")} ${formatTime(value)}`;
}

function latestObservationByCode(
  observations: ObservationRecord[],
  code: string | string[],
): ObservationRecord | undefined {
  const codeSet = new Set(Array.isArray(code) ? code : [code]);
  const matches = observations.filter((item) => codeSet.has(item.code));
  if (matches.length === 0) {
    return undefined;
  }
  return matches.sort((left, right) => (right.effective_at || "").localeCompare(left.effective_at || ""))[0];
}

function observationsByCode(observations: ObservationRecord[], codes: string[]): ObservationRecord[] {
  const codeSet = new Set(codes);
  return observations.filter((item) => codeSet.has(item.code));
}

function sortByEffectiveAtDesc(observations: ObservationRecord[]): ObservationRecord[] {
  return [...observations].sort((left, right) => (right.effective_at || "").localeCompare(left.effective_at || ""));
}

function getNumericValue(observation?: ObservationRecord | null): number | null {
  if (!observation) {
    return null;
  }
  if (observation.value != null) {
    return observation.value;
  }
  if (observation.value_string != null) {
    const parsed = parseFloat(observation.value_string);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function summaryTone(status: "good" | "warning" | "alert" | "attention" | "none") {
  if (status === "good") {
    return "bg-emerald-500";
  }
  if (status === "alert") {
    return "bg-rose-500";
  }
  if (status === "warning" || status === "attention") {
    return "bg-amber-500";
  }
  return "bg-gray-300";
}

function SectionHeader({ title, badge }: { title: string; badge?: ReactNode }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="h-4 w-1 shrink-0 rounded-full bg-elegant-blue" />
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
      {badge}
    </div>
  );
}

function OverviewTabContent({
  member,
  observations,
  conditions,
  healthSummaries,
  carePlans,
}: {
  member: MemberWithDetails | null;
  observations: ObservationRecord[];
  conditions: ConditionRecord[];
  healthSummaries: HealthSummaryRecord[];
  carePlans: CarePlanRecord[];
}) {
  const latestHeight = latestObservationByCode(observations, "body-height");
  const latestWeight = latestObservationByCode(observations, "body-weight");
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

  const activeConditions = conditions.filter(
    (item) => item.clinical_status === "active" && item.category !== "allergy" && item.category !== "family-history",
  );
  const stepObservation = latestObservationByCode(observations, "step-count");
  const sleepObservation = latestObservationByCode(observations, "sleep-duration");
  const oxygenObservation = latestObservationByCode(observations, "blood-oxygen");
  const temperatureObservation = latestObservationByCode(observations, "body-temperature");
  const heartObservation = latestObservationByCode(observations, "heart-rate");
  const summaryLookup = new Map(healthSummaries.map((item) => [item.category, item]));
  const orderedSummaries = healthSummaries;
  const todayReminders = carePlans.filter((item) => item.status === "active" && isToday(item.scheduled_at));
  const summaryCardValue = (
    preferredCategory: string,
    fallbackIndex: number,
    fallbackLabel: string,
    fallbackContent: string,
    fallbackStatus: "good" | "warning" | "alert" | "attention" | "none",
  ) => {
    const item = summaryLookup.get(preferredCategory) ?? orderedSummaries[fallbackIndex];
    if (item) {
      return {
        label: item.label,
        content: item.value,
        status: item.status,
      };
    }
    return {
      label: fallbackLabel,
      content: fallbackContent,
      status: fallbackStatus,
    };
  };

  const summaryCards = [
    summaryCardValue(
      "chronic-vitals",
      0,
      "慢病管理",
      activeConditions.length > 0 ? activeConditions.map((item) => item.display_name).join("、") : "期待新记录",
      activeConditions.length > 0 ? "attention" : "none",
    ),
    summaryCardValue(
      "lifestyle",
      1,
      "生活习惯",
      stepObservation || sleepObservation
        ? [
            stepObservation ? `步数 ${stepObservation.value ?? stepObservation.value_string ?? "—"}` : null,
            sleepObservation ? `睡眠 ${sleepObservation.value ?? sleepObservation.value_string ?? "—"}h` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "期待新记录",
      stepObservation || sleepObservation ? "good" : "none",
    ),
    summaryCardValue(
      "body-vitals",
      2,
      "生理指标",
      oxygenObservation || temperatureObservation || heartObservation
        ? [
            heartObservation ? `心率 ${heartObservation.value ?? "—"}` : null,
            oxygenObservation ? `血氧 ${oxygenObservation.value ?? "—"}%` : null,
            temperatureObservation ? `体温 ${temperatureObservation.value ?? "—"}°C` : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : "期待新记录",
      oxygenObservation || temperatureObservation || heartObservation ? "good" : "none",
    ),
    summaryCardValue("mood", 3, "心理情绪", "期待新记录", "none"),
  ] as const;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeader title="基础信息" />
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">身高/体重</p>
            <p className="text-[15px] text-gray-700">{heightWeightText}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">血型</p>
            <p className="text-[15px] text-gray-700">{member?.blood_type ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">腰围</p>
            <p className="text-[15px] text-gray-700">—</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-gray-500">过敏史</p>
            <p className="text-[15px] text-gray-700">{allergyText}</p>
          </div>
        </div>
        <div className="mt-10 h-px bg-gray-100" />
      </section>

      <section>
        <SectionHeader
          title="AI 健康摘要"
          badge={
            <span className="rounded-md border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400">
              AI 每日生成 · 只读
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-4">
          {summaryCards.map((card, cardIndex) => (
            <div
              className="flex h-28 flex-col justify-center rounded-2xl border border-gray-100/50 bg-gray-50 p-5"
              key={`${card.label}-${cardIndex}`}
            >
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">{card.label}</p>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${summaryTone(card.status)}`} />
                <p className="text-[13px] text-gray-600">{card.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="今日提醒" />
        {todayReminders.length === 0 ? (
          <p className="py-5 text-[15px] text-gray-500">暂无今日提醒</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {todayReminders.map((reminder) => (
              <div className="flex items-center gap-6 py-5" key={reminder.id}>
                <input
                  className="h-5 w-5 rounded-full border-gray-200 text-elegant-blue focus:ring-elegant-blue"
                  readOnly
                  type="checkbox"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-gray-700">{reminder.title}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-gray-400">
                    {formatTime(reminder.scheduled_at)}
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
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          {unit ? <span className="text-sm text-gray-400">{unit}</span> : null}
        </div>
        <p className="mt-1 text-[11px] font-mono text-gray-400">{timestamp}</p>
        {history.length > 0 ? (
          <div className="custom-scrollbar mt-3 h-[120px] space-y-1 overflow-y-auto">
            {sortByEffectiveAtDesc(history).map((item) => (
              <div className="flex justify-between text-[11px] font-mono" key={item.id}>
                <span>{getNumericValue(item) ?? item.value_string ?? "—"}</span>
                <span className="text-gray-400">{formatHealthTimestamp(item.effective_at)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {showMiniChart && values.length > 0 ? (
        <div className="flex h-10 w-24 shrink-0 items-end gap-0.5 pb-1">
          {values.slice(-5).map((item, index) => (
            <div
              className={`min-h-[4px] flex-1 rounded-sm ${index === values.length - 1 ? "bg-forest-green" : "bg-gray-100"}`}
              key={`${label}-${index}`}
              style={{ height: `${Math.max((item / max) * 100, 8)}%` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VitalMetricCard({
  label,
  value,
  unit,
  timestamp,
}: {
  label: string;
  value: string | number;
  unit?: string;
  timestamp: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit ? <span className="text-sm text-gray-400">{unit}</span> : null}
      </div>
      <p className="mt-1 text-[11px] font-mono text-gray-400">{timestamp}</p>
    </div>
  );
}

function HealthDataTabContent({
  observations,
  sleepRecords,
  workoutRecords,
}: {
  observations: ObservationRecord[];
  sleepRecords: SleepRecord[];
  workoutRecords: WorkoutRecord[];
}) {
  const chronicCodes = [
    "blood-pressure-systolic",
    "blood-pressure-diastolic",
    "bp-systolic",
    "bp-diastolic",
    "blood-glucose",
  ];
  const vitalCodes = ["heart-rate", "blood-oxygen", "body-weight", "body-temperature"];
  const lifestyleCodes = ["step-count", "active-calories"];
  const sleepCodes = ["sleep-duration"];

  const chronicObservations = observationsByCode(observations, chronicCodes);
  const vitalObservations = observationsByCode(observations, vitalCodes);
  const lifestyleObservations = observationsByCode(observations, lifestyleCodes);
  const sleepObservations = observationsByCode(observations, sleepCodes);

  const systolicObservations = sortByEffectiveAtDesc(
    observations.filter((item) => item.code === "bp-systolic" || item.code === "blood-pressure-systolic"),
  );
  const diastolicObservations = sortByEffectiveAtDesc(
    observations.filter((item) => item.code === "bp-diastolic" || item.code === "blood-pressure-diastolic"),
  );
  const glucoseObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "blood-glucose"));
  const stepObservations = sortByEffectiveAtDesc(observations.filter((item) => item.code === "step-count"));
  const activeCaloriesObservations = sortByEffectiveAtDesc(
    observations.filter((item) => item.code === "active-calories"),
  );
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
        ? `${getNumericValue(latestSystolic) ?? "—"} (收缩压)`
        : latestDiastolic
          ? `${getNumericValue(latestDiastolic) ?? "—"} (舒张压)`
          : "—";
  const bpTimestamp = latestSystolic?.effective_at ?? latestDiastolic?.effective_at ?? null;
  const bpHistory = systolicObservations.length > 0 ? systolicObservations : diastolicObservations;

  const showLifestyleSection = lifestyleObservations.length > 0 || Boolean(latestWorkoutRecord);
  const showSleepSection = sleepObservations.length > 0 || sleepRecords.length > 0;

  return (
    <div className="space-y-6">
      <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-red-400" />
            <h3 className="text-base font-bold text-gray-900">慢病指标</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {chronicObservations.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">暂无慢病指标数据</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(latestSystolic || latestDiastolic) ? (
                <MetricCard
                  history={bpHistory}
                  label="血压"
                  showMiniChart
                  timestamp={formatHealthTimestamp(bpTimestamp)}
                  unit="mmHg"
                  value={bpValue}
                />
              ) : null}
              {latestGlucose ? (
                <MetricCard
                  history={glucoseObservations}
                  label="血糖"
                  showMiniChart
                  timestamp={formatHealthTimestamp(latestGlucose.effective_at)}
                  unit={latestGlucose.unit ?? "mmol/L"}
                  value={getNumericValue(latestGlucose) ?? latestGlucose.value_string ?? "—"}
                />
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-blue-400" />
            <h3 className="text-base font-bold text-gray-900">生理指标</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {vitalObservations.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">暂无生理指标数据</p>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {latestHeart ? (
                <VitalMetricCard
                  label="心率"
                  timestamp={formatHealthTimestamp(latestHeart.effective_at)}
                  unit={latestHeart.unit ?? "bpm"}
                  value={getNumericValue(latestHeart) ?? "—"}
                />
              ) : null}
              {latestOxygen ? (
                <VitalMetricCard
                  label="血氧"
                  timestamp={formatHealthTimestamp(latestOxygen.effective_at)}
                  unit={latestOxygen.unit ?? "%"}
                  value={getNumericValue(latestOxygen) ?? "—"}
                />
              ) : null}
              {latestWeight ? (
                <VitalMetricCard
                  label="体重"
                  timestamp={formatHealthTimestamp(latestWeight.effective_at)}
                  unit={latestWeight.unit ?? "kg"}
                  value={getNumericValue(latestWeight) ?? "—"}
                />
              ) : null}
              {latestTemperature ? (
                <VitalMetricCard
                  label="体温"
                  timestamp={formatHealthTimestamp(latestTemperature.effective_at)}
                  unit={latestTemperature.unit ?? "°C"}
                  value={getNumericValue(latestTemperature) ?? "—"}
                />
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-green-400" />
            <h3 className="text-base font-bold text-gray-900">生活习惯</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {!showLifestyleSection ? (
            <p className="py-6 text-sm text-gray-500">暂无生活习惯数据</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {latestStep ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">步数</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {getNumericValue(latestStep) ?? latestStep.value_string ?? "—"}
                    </span>
                    <span className="text-sm text-gray-400">目标: {stepTarget.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-forest-green transition-all"
                        style={{
                          width: `${Math.min(100, ((getNumericValue(latestStep) ?? 0) / stepTarget) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-gray-500">
                      {Math.round(((getNumericValue(latestStep) ?? 0) / stepTarget) * 100)}%
                    </span>
                  </div>
                </div>
              ) : latestWorkoutRecord ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">运动时长</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-gray-900">{latestWorkoutRecord.duration_minutes}</span>
                    <span className="text-sm text-gray-400">目标: 30 分钟</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-forest-green transition-all"
                        style={{
                          width: `${Math.min(100, (latestWorkoutRecord.duration_minutes / 30) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-gray-500">
                      {Math.round(Math.min(100, (latestWorkoutRecord.duration_minutes / 30) * 100))}%
                    </span>
                  </div>
                </div>
              ) : null}
              {latestActiveCalories || latestWorkoutRecord ? (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <span className="material-symbols-outlined text-xl text-orange-500">local_fire_department</span>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">活动消耗</p>
                    <span className="text-2xl font-bold text-gray-900">
                      {latestActiveCalories
                        ? getNumericValue(latestActiveCalories) ?? latestActiveCalories.value_string ?? "—"
                        : latestWorkoutRecord?.energy_burned ?? "—"}
                    </span>
                    <span className="ml-1 text-sm text-gray-400">kcal</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </details>

      <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-indigo-400" />
            <h3 className="text-base font-bold text-gray-900">睡眠</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {!showSleepSection ? (
            <p className="py-6 text-sm text-gray-500">暂无睡眠数据</p>
          ) : sleepObservations.length > 0 ? (
            <div className="space-y-4">
              {latestSleepObservation ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">睡眠时长</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {getNumericValue(latestSleepObservation) ?? latestSleepObservation.value_string ?? "—"}
                    </span>
                    <span className="text-sm text-gray-400">小时</span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-gray-400">
                    {formatHealthTimestamp(latestSleepObservation.effective_at)}
                  </p>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="py-2 text-left font-medium">日期</th>
                      <th className="py-2 text-left font-medium">总时长</th>
                      <th className="py-2 text-left font-medium">深睡占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sleepObservationsSorted.slice(0, 10).map((item) => (
                      <tr className="border-b border-gray-50" key={item.id}>
                        <td className="py-2 font-mono text-gray-700">
                          {new Date(item.effective_at).toLocaleDateString("zh-CN", {
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </td>
                        <td className="py-2 text-gray-700">{getNumericValue(item) ?? item.value_string ?? "—"}h</td>
                        <td className="py-2 text-gray-500">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {latestSleepRecord ? (
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">睡眠时长</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {(latestSleepRecord.total_minutes / 60).toFixed(1)}
                    </span>
                    <span className="text-sm text-gray-400">小时</span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-gray-400">
                    {formatHealthTimestamp(latestSleepRecord.start_at)}
                  </p>
                </div>
              ) : null}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-500">
                      <th className="py-2 text-left font-medium">日期</th>
                      <th className="py-2 text-left font-medium">总时长</th>
                      <th className="py-2 text-left font-medium">深睡占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...sleepRecords]
                      .sort((left, right) => right.start_at.localeCompare(left.start_at))
                      .slice(0, 10)
                      .map((item) => (
                        <tr className="border-b border-gray-50" key={item.id}>
                          <td className="py-2 font-mono text-gray-700">
                            {new Date(item.start_at).toLocaleDateString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </td>
                          <td className="py-2 text-gray-700">{(item.total_minutes / 60).toFixed(1)}h</td>
                          <td className="py-2 text-gray-500">
                            {item.deep_minutes && item.total_minutes
                              ? `${Math.round((item.deep_minutes / item.total_minutes) * 100)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>

      <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open>
        <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-6 w-1.5 rounded-full bg-orange-400" />
            <h3 className="text-base font-bold text-gray-900">运动记录</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {workoutRecords.length === 0 ? (
            <p className="py-6 text-sm text-gray-500">暂无运动记录</p>
          ) : (
            <div className="space-y-4">
              {[...workoutRecords]
                .sort((left, right) => right.start_at.localeCompare(left.start_at))
                .slice(0, 6)
                .map((item) => (
                  <div
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center"
                    key={item.id}
                  >
                    <div>
                      <p className="text-base font-bold text-[#2D2926]">{item.type}</p>
                      <p className="mt-1 text-sm text-warm-gray">
                        {item.duration_minutes} 分钟
                        {item.distance_meters ? ` · ${(item.distance_meters / 1000).toFixed(1)} km` : ""}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">{formatHealthTimestamp(item.start_at)}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}

function CollapsibleSection({
  title,
  accentClass,
  open = true,
  children,
}: {
  title: string;
  accentClass: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-3xl border border-gray-100 bg-white shadow-sm" open={open}>
      <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <span className={`h-6 w-1.5 rounded-full ${accentClass}`} />
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <span className="material-symbols-outlined text-gray-400 transition-transform group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="space-y-1 px-2 pb-4">{children}</div>
    </details>
  );
}

function HealthRecordsTabContent({ conditions }: { conditions: ConditionRecord[] }) {
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

  return (
    <div className="space-y-6">
      <CollapsibleSection accentClass="bg-[#2D4F3E]" title="现病">
        {activeConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">暂无记录</p>
        ) : (
          activeConditions.map((item) => (
            <div className="flex cursor-pointer items-center rounded-2xl px-4 py-4 hover:bg-gray-50" key={item.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#2D4F3E]">{item.display_name}</p>
                {item.notes ? <p className="mt-0.5 text-sm text-gray-600">{item.notes}</p> : null}
                <p className="mt-1 text-xs text-gray-500">发病日期：{formatDate(item.onset_date)}</p>
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-blue-400" title="既往病史">
        {resolvedConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">暂无记录</p>
        ) : (
          resolvedConditions.map((item) => (
            <div className="flex cursor-pointer items-center rounded-2xl px-4 py-4 hover:bg-gray-50" key={item.id}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-900">{item.display_name}</p>
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-forest-green">
                    {item.clinical_status === "resolved" ? "已治愈" : "已停用"}
                  </span>
                </div>
                {item.notes ? <p className="mt-0.5 text-sm text-gray-600">{item.notes}</p> : null}
                <p className="mt-1 text-xs text-gray-500">记录日期：{formatDate(item.onset_date)}</p>
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-indigo-400" title="家族病史">
        {familyConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">暂无记录</p>
        ) : (
          familyConditions.map((item) => (
            <div className="flex cursor-pointer items-center rounded-2xl px-4 py-4 hover:bg-gray-50" key={item.id}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{item.display_name}</p>
                {item.notes ? <p className="mt-0.5 text-sm text-gray-600">{item.notes}</p> : null}
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection accentClass="bg-red-500" title="过敏与禁忌">
        {allergyConditions.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">暂无记录</p>
        ) : (
          <div className="space-y-2">
            {allergyConditions.map((item) => (
              <div className="rounded-2xl border border-orange-100 bg-[#FFF4ED] p-4" key={item.id}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined shrink-0 text-[20px] text-red-500">warning</span>
                  <div>
                    <p className="font-bold text-red-600">{item.display_name}</p>
                    {item.notes ? <p className="mt-0.5 text-sm text-gray-600">{item.notes}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

function encounterTypeToLabel(type: string): string {
  const normalized = type?.toLowerCase() ?? "";
  if (normalized === "follow-up" || normalized === "复查" || normalized === "checkup") {
    return "复查";
  }
  if (normalized === "initial" || normalized === "初诊" || normalized === "outpatient") {
    return "初诊";
  }
  if (normalized === "examination" || normalized === "检查") {
    return "检查";
  }
  if (normalized === "inpatient") {
    return "住院";
  }
  if (normalized === "emergency") {
    return "急诊";
  }
  return type || "就诊";
}

function encounterTypeBadgeClass(type: string): string {
  const label = encounterTypeToLabel(type);
  if (label === "复查") {
    return "bg-blue-50 text-blue-600";
  }
  if (label === "初诊") {
    return "bg-orange-50 text-orange-600";
  }
  if (label === "检查") {
    return "bg-green-50 text-green-600";
  }
  return "bg-gray-50 text-gray-600";
}

function formatEncounterDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function EncountersTabContent({ encounters }: { encounters: EncounterRecord[] }) {
  const sorted = [...encounters].sort((left, right) => (right.date || "").localeCompare(left.date || ""));

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">历史就诊记录</h3>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600"
            type="button"
          >
            按日期排序
          </button>
          <button
            className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-medium text-gray-600"
            type="button"
          >
            筛选类型
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="py-8 text-gray-500">暂无就诊记录</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((item) => (
            <details
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              key={item.id}
            >
              <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-5 hover:bg-gray-50/50">
                <div className="grid flex-1 grid-cols-12 items-center gap-4">
                  <div className="col-span-2">
                    <span className="text-[13px] font-mono text-gray-500">{formatEncounterDate(item.date)}</span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-[15px] font-bold text-gray-800">{item.facility || "未记录机构"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[13px] text-gray-600">{item.department || encounterTypeToLabel(item.type)}</span>
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${encounterTypeBadgeClass(item.type)}`}
                    >
                      {encounterTypeToLabel(item.type)}
                    </span>
                    <span className="truncate text-[14px] text-gray-500">{item.summary || ""}</span>
                  </div>
                </div>
                <span className="material-symbols-outlined ml-4 text-gray-300 transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="mt-1 border-t border-gray-50 px-6 pb-6 pt-2">
                <div className="grid grid-cols-3 gap-8 py-4">
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">接诊医生</p>
                    <p className="text-[15px] font-medium text-gray-800">{item.attending_physician || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">详细诊断</p>
                    <p className="text-[14px] leading-relaxed text-gray-600">{item.summary || "—"}</p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {sorted.length > 0 ? (
        <div className="mt-8 flex justify-center">
          <button
            className="rounded-full border border-[#2D4F3E] px-6 py-2.5 text-sm font-medium text-[#2D4F3E] hover:bg-[#E9F0ED]"
            type="button"
          >
            加载更多历史记录
          </button>
        </div>
      ) : null}
    </div>
  );
}

function formatMedicationDate(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function MedicationsTabContent({ medications }: { medications: MedicationRecord[] }) {
  const active = medications.filter((item) => item.status === "active");
  const stopped = medications.filter((item) => item.status !== "active");

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <span className="h-6 w-1.5 rounded-full bg-[#2D4F3E]" />
          <h3 className="text-lg font-bold text-gray-900">正在服用</h3>
        </div>
        {active.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">暂无正在服用的药品</p>
        ) : (
          <div className="space-y-4">
            {active.map((item) => (
              <div
                className="flex flex-col justify-between gap-6 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm md:flex-row md:items-center"
                key={item.id}
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[17px] font-bold text-gray-900">
                      {item.name} <span className="ml-1 font-normal text-gray-400">{item.dosage_description ?? "—"}</span>
                    </h4>
                    <span className="rounded-full bg-[#2D4F3E] px-3 py-0.5 text-[11px] font-semibold tracking-wide text-white">
                      服用中
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-[14px] text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-gray-400">info</span>
                      <span>{item.indication ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-gray-400">schedule</span>
                      <span>{item.dosage_description ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start shrink-0 md:items-end">
                  <span className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">开始服用时间</span>
                  <span className="rounded-lg bg-gray-50 px-3 py-1 font-mono text-[13px] font-medium text-gray-700">
                    {formatMedicationDate(item.start_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {stopped.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <span className="h-6 w-1.5 rounded-full bg-gray-300" />
            <h3 className="text-lg font-bold text-gray-400">已停用</h3>
          </div>
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white/40">
            <div className="divide-y divide-gray-100">
              {stopped.map((item) => (
                <div
                  className="flex items-center justify-between px-6 py-4 transition-colors hover:bg-gray-50/50"
                  key={item.id}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="text-[14px] font-medium text-gray-400 line-through">{item.name}</span>
                    <span className="text-[12px] text-gray-300">功能：{item.indication ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium text-gray-300">停止日期</span>
                    <span className="font-mono text-[12px] text-gray-300">{formatMedicationDate(item.end_date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function MemberProfileModal({
  open,
  onClose,
  memberId,
  session,
  members,
}: MemberProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!open || !memberId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadProfile() {
      try {
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

        if (!cancelled) {
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
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [open, memberId, session]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setActiveTab("overview");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const member = state.member;
  const age = member ? calculateAge(member.birth_date) : null;
  const ageGenderText = [age != null ? `${age}岁` : null, member?.gender || null].filter(Boolean).join(" · ") || "—";

  return (
    <div aria-label="成员档案" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12" role="dialog">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(45,41,38,0.15)] backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative flex h-[85vh] w-[75vw] flex-col overflow-hidden rounded-[2.5rem] border border-white/50 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-8 py-5">
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-16 w-16 animate-pulse rounded-full bg-gray-100" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-elegant-blue/20 text-2xl font-bold text-elegant-blue ring-4 ring-gray-50">
                {member?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#2D2926]">{loading ? "加载中..." : member?.name ?? "—"}</h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">{ageGenderText}</span>
              </div>
              <span className="text-sm text-gray-500">最近更新：{formatDate(member?.updated_at ?? null)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="border-elegant-blue bg-elegant-blue text-white hover:border-elegant-blue/90 hover:bg-elegant-blue/90"
              size="md"
              variant="secondary"
            >
              编辑档案
            </Button>
            <button
              aria-label="关闭"
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100"
              onClick={onClose}
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="no-scrollbar w-64 shrink-0 overflow-y-auto border-r border-gray-100 bg-[#FBFBFB] px-4 py-8">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  className={[
                    "mb-1 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition",
                    isActive
                      ? "border border-gray-100 bg-white font-bold text-elegant-blue shadow-sm"
                      : "text-gray-400 hover:bg-white/50 hover:text-gray-600",
                  ].join(" ")}
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          <main className="custom-scrollbar flex-1 overflow-y-auto bg-white px-12 py-10">
            {error ? (
              <div className="py-8 text-red-600">{error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">加载中...</div>
            ) : (
              <>
                {activeTab === "overview" ? (
                  <OverviewTabContent
                    carePlans={state.carePlans}
                    conditions={state.conditions}
                    healthSummaries={state.healthSummaries}
                    member={member}
                    observations={state.observations}
                  />
                ) : null}
                {activeTab === "health-data" ? (
                  <HealthDataTabContent
                    observations={state.observations}
                    sleepRecords={state.sleepRecords}
                    workoutRecords={state.workoutRecords}
                  />
                ) : null}
                {activeTab === "health-records" ? (
                  <HealthRecordsTabContent conditions={state.conditions} />
                ) : null}
                {activeTab === "encounters" ? <EncountersTabContent encounters={state.encounters} /> : null}
                {activeTab === "medications" ? <MedicationsTabContent medications={state.medications} /> : null}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
