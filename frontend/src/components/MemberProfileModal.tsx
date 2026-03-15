import { useEffect, useState } from "react";
import type { AuthMember, AuthSession } from "../auth/session";
import { getMember } from "../api/members";
import {
  listObservations,
  listConditions,
  listMedications,
  listEncounters,
  listCarePlans,
} from "../api/health";
import type {
  CarePlanRecord,
  ConditionRecord,
  EncounterRecord,
  MedicationRecord,
  ObservationRecord,
} from "../api/health";
import { Button } from "./Button";

type MemberProfileModalProps = {
  open: boolean;
  onClose: () => void;
  memberId: string;
  session: AuthSession;
  members: AuthMember[];
};

type TabKey = "overview" | "health-data" | "health-records" | "encounters" | "medications";

const navItems: { key: TabKey; label: string; icon: string }[] = [
  { key: "overview", label: "概览", icon: "grid_view" },
  { key: "health-data", label: "健康数据", icon: "monitoring" },
  { key: "health-records", label: "健康档案", icon: "assignment" },
  { key: "encounters", label: "就诊记录", icon: "local_hospital" },
  { key: "medications", label: "药品管理", icon: "medication" },
];

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function latestObservationByCode(observations: ObservationRecord[], code: string): ObservationRecord | undefined {
  const matches = observations.filter((o) => o.code === code);
  if (matches.length === 0) return undefined;
  return matches.sort((a, b) => (b.effective_at || "").localeCompare(a.effective_at || ""))[0];
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function formatHealthTimestamp(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  if (isToday(value)) {
    return `今天 ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, "0")} ${d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
}

function observationsByCode(observations: ObservationRecord[], codes: string[]): ObservationRecord[] {
  const set = new Set(codes);
  return observations.filter((o) => set.has(o.code));
}

function sortByEffectiveAtDesc(obs: ObservationRecord[]): ObservationRecord[] {
  return [...obs].sort((a, b) => (b.effective_at || "").localeCompare(a.effective_at || ""));
}

function getNumericValue(o: ObservationRecord): number | null {
  if (o.value != null) return o.value;
  if (o.value_string != null) {
    const n = parseFloat(o.value_string);
    return isNaN(n) ? null : n;
  }
  return null;
}

type MemberWithDetails = AuthMember & { height_cm?: number; weight_kg?: number };

function HealthDataTabContent({ observations }: { observations: ObservationRecord[] }) {
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

  const chronicObs = observationsByCode(observations, chronicCodes);
  const vitalObs = observationsByCode(observations, vitalCodes);
  const lifestyleObs = observationsByCode(observations, lifestyleCodes);
  const sleepObs = observationsByCode(observations, sleepCodes);

  const systolicObs = sortByEffectiveAtDesc(
    observations.filter((o) => o.code === "bp-systolic" || o.code === "blood-pressure-systolic")
  );
  const diastolicObs = sortByEffectiveAtDesc(
    observations.filter((o) => o.code === "bp-diastolic" || o.code === "blood-pressure-diastolic")
  );
  const glucoseObs = sortByEffectiveAtDesc(observations.filter((o) => o.code === "blood-glucose"));
  const stepObs = sortByEffectiveAtDesc(observations.filter((o) => o.code === "step-count"));
  const activeCalObs = sortByEffectiveAtDesc(observations.filter((o) => o.code === "active-calories"));
  const sleepObsSorted = sortByEffectiveAtDesc(observations.filter((o) => o.code === "sleep-duration"));

  const stepTarget = 6000;

  const MetricCard = ({
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
  }) => {
    const values = history.map((o) => getNumericValue(o) ?? 0).filter((v) => v > 0);
    const max = Math.max(...values, 1);
    return (
      <div className="flex items-start justify-between gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            {unit && <span className="text-sm text-gray-400">{unit}</span>}
          </div>
          <p className="text-[11px] font-mono text-gray-400 mt-1">{timestamp}</p>
          {history.length > 0 && (
            <div className="h-[120px] overflow-y-auto mt-3 space-y-1 custom-scrollbar">
              {sortByEffectiveAtDesc(history).map((o) => (
                <div key={o.id} className="flex justify-between text-[11px] font-mono">
                  <span>{getNumericValue(o) ?? o.value_string ?? "—"}</span>
                  <span className="text-gray-400">{formatHealthTimestamp(o.effective_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {showMiniChart && values.length > 0 && (
          <div className="h-10 w-24 flex items-end gap-0.5 pb-1 shrink-0">
            {values.slice(-5).map((v, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm min-h-[4px] ${i === values.length - 1 ? "bg-forest-green" : "bg-gray-100"}`}
                style={{ height: `${Math.max((v / max) * 100, 8)}%` }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const VitalMetricCard = ({
    label,
    value,
    unit,
    timestamp,
  }: {
    label: string;
    value: string | number;
    unit?: string;
    timestamp: string;
  }) => (
    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      <p className="text-[11px] font-mono text-gray-400 mt-1">{timestamp}</p>
    </div>
  );

  const latestSystolic = systolicObs[0];
  const latestDiastolic = diastolicObs[0];
  const bpValue =
    latestSystolic && latestDiastolic
      ? `${getNumericValue(latestSystolic) ?? "—"}/${getNumericValue(latestDiastolic) ?? "—"}`
      : latestSystolic
        ? `${getNumericValue(latestSystolic) ?? "—"} (收缩压)`
        : latestDiastolic
          ? `${getNumericValue(latestDiastolic) ?? "—"} (舒张压)`
          : "—";
  const bpTimestamp = latestSystolic?.effective_at ?? latestDiastolic?.effective_at ?? null;
  const bpHistoryForChart = systolicObs.length > 0 ? systolicObs : diastolicObs;

  const latestGlucose = glucoseObs[0];
  const latestHeart = vitalObs.find((o) => o.code === "heart-rate");
  const latestOxygen = vitalObs.find((o) => o.code === "blood-oxygen");
  const latestWeight = vitalObs.find((o) => o.code === "body-weight");
  const latestTemp = vitalObs.find((o) => o.code === "body-temperature");
  const latestStep = stepObs[0];
  const latestActiveCal = activeCalObs[0];
  const latestSleep = sleepObsSorted[0];

  return (
    <div className="space-y-6">
      {/* Section 1: 慢病指标 */}
      <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open>
        <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-red-400 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">慢病指标</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {chronicObs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">暂无慢病指标数据</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {(latestSystolic || latestDiastolic) && (
                <MetricCard
                  label="血压"
                  value={bpValue}
                  unit="mmHg"
                  timestamp={formatHealthTimestamp(bpTimestamp)}
                  history={bpHistoryForChart}
                  showMiniChart
                />
              )}
              {latestGlucose && (
                <MetricCard
                  label="血糖"
                  value={getNumericValue(latestGlucose) ?? latestGlucose.value_string ?? "—"}
                  unit={latestGlucose.unit ?? "mmol/L"}
                  timestamp={formatHealthTimestamp(latestGlucose.effective_at)}
                  history={glucoseObs}
                  showMiniChart
                />
              )}
            </div>
          )}
        </div>
      </details>

      {/* Section 2: 生理指标 */}
      <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open>
        <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-blue-400 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">生理指标</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {vitalObs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">暂无生理指标数据</p>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {latestHeart && (
                <VitalMetricCard
                  label="心率"
                  value={getNumericValue(latestHeart) ?? "—"}
                  unit={latestHeart.unit ?? "bpm"}
                  timestamp={formatHealthTimestamp(latestHeart.effective_at)}
                />
              )}
              {latestOxygen && (
                <VitalMetricCard
                  label="血氧"
                  value={getNumericValue(latestOxygen) ?? "—"}
                  unit={latestOxygen.unit ?? "%"}
                  timestamp={formatHealthTimestamp(latestOxygen.effective_at)}
                />
              )}
              {latestWeight && (
                <VitalMetricCard
                  label="体重"
                  value={getNumericValue(latestWeight) ?? "—"}
                  unit={latestWeight.unit ?? "kg"}
                  timestamp={formatHealthTimestamp(latestWeight.effective_at)}
                />
              )}
              {latestTemp && (
                <VitalMetricCard
                  label="体温"
                  value={getNumericValue(latestTemp) ?? "—"}
                  unit={latestTemp.unit ?? "°C"}
                  timestamp={formatHealthTimestamp(latestTemp.effective_at)}
                />
              )}
            </div>
          )}
        </div>
      </details>

      {/* Section 3: 生活习惯 */}
      <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open>
        <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-green-400 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">生活习惯</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {lifestyleObs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">暂无生活习惯数据</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {latestStep && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">步数</p>
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-bold text-gray-900">
                      {getNumericValue(latestStep) ?? latestStep.value_string ?? "—"}
                    </span>
                    <span className="text-sm text-gray-400">目标: {stepTarget.toLocaleString()}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-forest-green rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((getNumericValue(latestStep) ?? 0) / stepTarget) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {Math.round(((getNumericValue(latestStep) ?? 0) / stepTarget) * 100)}%
                    </span>
                  </div>
                </div>
              )}
              {latestActiveCal && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="material-symbols-outlined text-orange-500 text-xl">local_fire_department</span>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">活动消耗</p>
                    <span className="text-2xl font-bold text-gray-900">
                      {getNumericValue(latestActiveCal) ?? latestActiveCal.value_string ?? "—"}
                    </span>
                    <span className="text-sm text-gray-400 ml-1">kcal</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {/* Section 4: 睡眠 */}
      <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open>
        <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-indigo-400 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">睡眠</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          {sleepObs.length === 0 ? (
            <p className="text-sm text-gray-500 py-6">暂无睡眠数据</p>
          ) : (
            <div className="space-y-4">
              {latestSleep && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 font-medium mb-1">睡眠时长</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {getNumericValue(latestSleep) ?? latestSleep.value_string ?? "—"}
                    </span>
                    <span className="text-sm text-gray-400">小时</span>
                  </div>
                  <p className="text-[11px] font-mono text-gray-400 mt-1">
                    {formatHealthTimestamp(latestSleep.effective_at)}
                  </p>
                </div>
              )}
              {sleepObsSorted.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-100">
                        <th className="text-left py-2 font-medium">日期</th>
                        <th className="text-left py-2 font-medium">总时长</th>
                        <th className="text-left py-2 font-medium">深睡占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sleepObsSorted.slice(0, 10).map((o) => (
                        <tr key={o.id} className="border-b border-gray-50">
                          <td className="py-2 font-mono text-gray-700">
                            {new Date(o.effective_at).toLocaleDateString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                            })}
                          </td>
                          <td className="py-2 text-gray-700">
                            {getNumericValue(o) ?? o.value_string ?? "—"}h
                          </td>
                          <td className="py-2 text-gray-500">—</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </details>

      {/* Section 5: 运动记录 */}
      <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open>
        <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-orange-400 rounded-full" />
            <h3 className="text-base font-bold text-gray-900">运动记录</h3>
          </div>
          <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
            expand_more
          </span>
        </summary>
        <div className="px-6 pb-6 pt-2">
          <p className="text-sm text-gray-500 py-6">暂无运动记录，运动数据将在后续接入</p>
        </div>
      </details>
    </div>
  );
}

function HealthRecordsTabContent({
  conditions,
  member,
}: {
  conditions: ConditionRecord[];
  member: AuthMember | null;
}) {
  const activeConditions = conditions.filter(
    (c) => c.clinical_status === "active" && c.category !== "allergy" && c.category !== "family"
  );
  const resolvedConditions = conditions.filter(
    (c) =>
      (c.clinical_status === "resolved" || c.clinical_status === "inactive") &&
      c.category !== "allergy" &&
      c.category !== "family"
  );
  const familyConditions = conditions.filter((c) => c.category === "family");
  const allergyConditions = conditions.filter((c) => c.category === "allergy");
  const memberAllergies = member?.allergies ?? [];
  const allergyItems = [
    ...allergyConditions.map((c) => ({ name: c.display_name, notes: c.notes })),
    ...memberAllergies
      .filter((a) => typeof a === "string" && a.trim())
      .map((a) => ({ name: a, notes: null as string | null })),
  ];
  const dedupedAllergyItems = allergyItems.filter(
    (item, idx, arr) => arr.findIndex((x) => x.name === item.name) === idx
  );

  const CollapsibleSection = ({
    title,
    accentClass,
    open = true,
    children,
  }: {
    title: string;
    accentClass: string;
    open?: boolean;
    children: React.ReactNode;
  }) => (
    <details className="group bg-white rounded-3xl shadow-sm border border-gray-100" open={open}>
      <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <span className={`w-1.5 h-6 rounded-full ${accentClass}`} />
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
        <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">
          expand_more
        </span>
      </summary>
      <div className="px-2 pb-4 space-y-1">{children}</div>
    </details>
  );

  return (
    <div className="space-y-6">
      {/* Section 1: 现病 */}
      <CollapsibleSection title="现病" accentClass="bg-[#2D4F3E]">
        {activeConditions.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">暂无记录</p>
        ) : (
          activeConditions.map((c) => (
            <div
              key={c.id}
              className="flex items-center px-4 py-4 rounded-2xl hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#2D4F3E]">{c.display_name}</p>
                {c.notes && (
                  <p className="text-sm text-gray-600 mt-0.5">{c.notes}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  发病日期：{formatDate(c.onset_date)}
                </p>
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* Section 2: 既往病史 */}
      <CollapsibleSection title="既往病史" accentClass="bg-blue-400">
        {resolvedConditions.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">暂无记录</p>
        ) : (
          resolvedConditions.map((c) => (
            <div
              key={c.id}
              className="flex items-center px-4 py-4 rounded-2xl hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900">{c.display_name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-forest-green">
                    已治愈
                  </span>
                </div>
                {c.notes && (
                  <p className="text-sm text-gray-600 mt-0.5">{c.notes}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  {c.abatement_date ? formatDate(c.abatement_date) : formatDate(c.onset_date)}
                </p>
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* Section 3: 家族病史 */}
      <CollapsibleSection title="家族病史" accentClass="bg-indigo-400">
        {familyConditions.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">暂无记录</p>
        ) : (
          familyConditions.map((c) => (
            <div
              key={c.id}
              className="flex items-center px-4 py-4 rounded-2xl hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{c.display_name}</p>
                {c.notes && (
                  <p className="text-sm text-gray-600 mt-0.5">{c.notes}</p>
                )}
              </div>
            </div>
          ))
        )}
      </CollapsibleSection>

      {/* Section 4: 过敏与禁忌 */}
      <CollapsibleSection title="过敏与禁忌" accentClass="bg-red-500">
        {dedupedAllergyItems.length === 0 ? (
          <p className="px-4 py-3 text-gray-500 text-sm">暂无记录</p>
        ) : (
          <div className="space-y-2">
            {dedupedAllergyItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#FFF4ED] border border-orange-100 p-4 rounded-2xl"
              >
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-red-500 shrink-0 text-[20px]">
                    warning
                  </span>
                  <div>
                    <p className="font-bold text-red-600">{item.name}</p>
                    {item.notes && (
                      <p className="text-sm text-gray-600 mt-0.5">{item.notes}</p>
                    )}
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
  const t = type?.toLowerCase() ?? "";
  if (t === "follow-up" || t === "复查" || t === "checkup") return "复查";
  if (t === "initial" || t === "初诊" || t === "outpatient") return "初诊";
  if (t === "examination" || t === "检查") return "检查";
  if (t === "inpatient") return "住院";
  if (t === "emergency") return "急诊";
  return type || "就诊";
}

function encounterTypeBadgeClass(type: string): string {
  const label = encounterTypeToLabel(type);
  if (label === "复查") return "bg-blue-50 text-blue-600";
  if (label === "初诊") return "bg-orange-50 text-orange-600";
  if (label === "检查") return "bg-green-50 text-green-600";
  return "bg-gray-50 text-gray-600";
}

function formatEncounterDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatMedicationDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function MedicationsTabContent({ medications }: { medications: MedicationRecord[] }) {
  const active = medications.filter((m) => m.status === "active");
  const stopped = medications.filter((m) => m.status !== "active");

  return (
    <div className="space-y-10">
      {/* Section 1: 正在服用 */}
      <section className="space-y-4">
        <div className="flex items-center gap-3 px-2">
          <span className="w-1.5 h-6 bg-[#2D4F3E] rounded-full" />
          <h3 className="text-lg font-bold text-gray-900">正在服用</h3>
        </div>
        {active.length === 0 ? (
          <p className="text-sm text-gray-500 py-6">暂无正在服用的药品</p>
        ) : (
          <div className="space-y-4">
            {active.map((med) => (
              <div
                key={med.id}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-[17px] font-bold text-gray-900">
                      {med.medication_name}{" "}
                      <span className="font-normal text-gray-400 ml-1">{med.dosage ?? "—"}</span>
                    </h4>
                    <span className="px-3 py-0.5 bg-[#2D4F3E] text-white text-[11px] font-semibold rounded-full tracking-wide">
                      服用中
                    </span>
                  </div>
                  <div className="text-[14px] text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-gray-400">info</span>
                      <span>{med.reason ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-gray-400">schedule</span>
                      <span>{(med as MedicationRecord & { frequency?: string }).frequency ?? "—"}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start md:items-end shrink-0">
                  <span className="text-[11px] text-gray-400 font-semibold tracking-wider uppercase mb-1">
                    开始服用时间
                  </span>
                  <span className="font-mono text-[13px] text-gray-700 font-medium bg-gray-50 px-3 py-1 rounded-lg">
                    {formatMedicationDate(med.start_date)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 2: 已停用 */}
      {stopped.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <span className="w-1.5 h-6 bg-gray-300 rounded-full" />
            <h3 className="text-lg font-bold text-gray-400">已停用</h3>
          </div>
          <div className="bg-white/40 rounded-3xl overflow-hidden border border-gray-100">
            <div className="divide-y divide-gray-100">
              {stopped.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="text-[14px] font-medium text-gray-400 line-through">
                      {med.medication_name}
                    </span>
                    <span className="text-[12px] text-gray-300">功能：{med.reason ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-gray-300 font-medium">停止日期</span>
                    <span className="font-mono text-[12px] text-gray-300">
                      {formatMedicationDate(med.end_date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function EncountersTabContent({ encounters }: { encounters: EncounterRecord[] }) {
  const sorted = [...encounters].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-bold text-gray-900">历史就诊记录</h3>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600"
          >
            按日期排序
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600"
          >
            筛选类型
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-500 py-8">暂无就诊记录</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((enc) => (
            <details
              key={enc.id}
              className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <summary className="flex items-center justify-between px-6 py-5 cursor-pointer select-none hover:bg-gray-50/50">
                <div className="flex-1 grid grid-cols-12 items-center gap-4">
                  <div className="col-span-2">
                    <span className="text-[13px] font-mono text-gray-500">
                      {formatEncounterDate(enc.date)}
                    </span>
                  </div>
                  <div className="col-span-3">
                    <span className="text-[15px] font-bold text-gray-800">
                      {enc.facility || "未记录机构"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[13px] text-gray-600">
                      {enc.department || encounterTypeToLabel(enc.type)}
                    </span>
                  </div>
                  <div className="col-span-4 flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${encounterTypeBadgeClass(enc.type)}`}
                    >
                      {encounterTypeToLabel(enc.type)}
                    </span>
                    <span className="text-[14px] text-gray-500 truncate">
                      {enc.summary || ""}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-300 group-open:rotate-180 transition-transform ml-4">
                  expand_more
                </span>
              </summary>
              <div className="px-6 pb-6 pt-2 border-t border-gray-50 mt-1">
                <div className="grid grid-cols-3 gap-8 py-4">
                  <div>
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                      接诊医生
                    </p>
                    <p className="text-[15px] font-medium text-gray-800">
                      {enc.attending_physician || "—"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                      详细诊断
                    </p>
                    <p className="text-[14px] leading-relaxed text-gray-600">
                      {enc.summary || "—"}
                    </p>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            className="px-6 py-2.5 rounded-full text-sm font-medium border border-[#2D4F3E] text-[#2D4F3E] hover:bg-[#E9F0ED]"
          >
            加载更多历史记录
          </button>
        </div>
      )}
    </div>
  );
}

function OverviewTabContent({
  member,
  observations,
  conditions,
  carePlans,
}: {
  member: MemberWithDetails | null;
  observations: ObservationRecord[];
  conditions: ConditionRecord[];
  carePlans: CarePlanRecord[];
}) {
  const latestHeight = latestObservationByCode(observations, "body-height");
  const latestWeight = latestObservationByCode(observations, "body-weight");
  const heightVal = member?.height_cm ?? latestHeight?.value;
  const weightVal = latestWeight?.value ?? (member as MemberWithDetails)?.weight_kg;
  const heightWeightText =
    heightVal != null && weightVal != null
      ? `${heightVal} cm / ${weightVal} kg`
      : heightVal != null
        ? `${heightVal} cm`
        : weightVal != null
          ? `${weightVal} kg`
          : "—";

  const allergyConditions = conditions.filter((c) => c.category === "allergy");
  const allergyText =
    allergyConditions.length > 0
      ? allergyConditions.map((c) => c.display_name).join("、")
      : (member?.allergies?.length ?? 0) > 0
        ? (member!.allergies as string[]).join("、")
        : "—";

  const activeConditions = conditions.filter((c) => c.clinical_status === "active" && c.category !== "allergy");
  const stepObs = latestObservationByCode(observations, "step-count");
  const sleepObs = latestObservationByCode(observations, "sleep-duration");
  const oxygenObs = latestObservationByCode(observations, "blood-oxygen");
  const tempObs = latestObservationByCode(observations, "body-temperature");
  const heartObs = latestObservationByCode(observations, "heart-rate");

  const todayReminders = carePlans.filter((p) => p.status === "active" && isToday(p.scheduled_at));

  const summaryCards = [
    {
      label: "慢病管理",
      content:
        activeConditions.length > 0
          ? activeConditions.map((c) => c.display_name).join("、")
          : "期待新记录",
      status: activeConditions.length > 0 ? "attention" as const : "none" as const,
    },
    {
      label: "生活习惯",
      content:
        stepObs || sleepObs
          ? [stepObs ? `步数 ${stepObs.value ?? stepObs.value_string ?? "—"}` : null, sleepObs ? `睡眠 ${sleepObs.value ?? sleepObs.value_string ?? "—"}h` : null]
              .filter(Boolean)
              .join(" · ")
          : "期待新记录",
      status: stepObs || sleepObs ? "good" as const : "none" as const,
    },
    {
      label: "生理指标",
      content:
        oxygenObs || tempObs || heartObs
          ? [heartObs ? `心率 ${heartObs.value ?? "—"}` : null, oxygenObs ? `血氧 ${oxygenObs.value ?? "—"}%` : null, tempObs ? `体温 ${tempObs.value ?? "—"}°C` : null]
              .filter(Boolean)
              .join(" · ")
          : "期待新记录",
      status: oxygenObs || tempObs || heartObs ? "good" as const : "none" as const,
    },
    {
      label: "心理情绪",
      content: "期待新记录",
      status: "none" as const,
    },
  ];

  const dotColor = (status: "good" | "attention" | "none") =>
    status === "good" ? "bg-emerald-500" : status === "attention" ? "bg-amber-500" : "bg-gray-300";

  const SectionHeader = ({ title, badge }: { title: string; badge?: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-1 h-4 bg-elegant-blue rounded-full shrink-0" />
      <h3 className="text-base font-bold text-gray-800">{title}</h3>
      {badge}
    </div>
  );

  return (
    <div className="space-y-10">
      {/* Section 1: 基础信息 */}
      <section>
        <SectionHeader title="基础信息" />
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">身高/体重</p>
            <p className="text-[15px] text-gray-700">{heightWeightText}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">血型</p>
            <p className="text-[15px] text-gray-700">{member?.blood_type ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">腰围</p>
            <p className="text-[15px] text-gray-700">—</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-1">过敏史</p>
            <p className="text-[15px] text-gray-700">{allergyText}</p>
          </div>
        </div>
        <div className="h-px bg-gray-100 mt-10" />
      </section>

      {/* Section 2: AI 健康摘要 */}
      <section>
        <SectionHeader
          title="AI 健康摘要"
          badge={
            <span className="text-[10px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-md border border-gray-100">
              AI 每日生成 · 只读
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-4">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="p-5 bg-gray-50 rounded-2xl h-28 border border-gray-100/50 flex flex-col justify-center"
            >
              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mb-2">{card.label}</p>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor(card.status)}`} />
                <p className="text-[13px] text-gray-600">{card.content}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: 今日提醒 */}
      <section>
        <SectionHeader title="今日提醒" />
        {todayReminders.length === 0 ? (
          <p className="text-[15px] text-gray-500 py-5">暂无今日提醒</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {todayReminders.map((reminder) => (
              <div key={reminder.id} className="flex items-center gap-6 py-5">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-full border-gray-200 text-elegant-blue focus:ring-elegant-blue"
                  readOnly
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-gray-700">{reminder.title}</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">
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

export function MemberProfileModal({
  open,
  onClose,
  memberId,
  session,
}: MemberProfileModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [member, setMember] = useState<AuthMember | null>(null);
  const [observations, setObservations] = useState<ObservationRecord[]>([]);
  const [conditions, setConditions] = useState<ConditionRecord[]>([]);
  const [medications, setMedications] = useState<MedicationRecord[]>([]);
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [carePlans, setCarePlans] = useState<CarePlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !memberId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [memberData, obs, conds, meds, encs, plans] = await Promise.all([
          getMember(session, memberId),
          listObservations(session, memberId),
          listConditions(session, memberId),
          listMedications(session, memberId),
          listEncounters(session, memberId),
          listCarePlans(session, memberId),
        ]);
        if (!cancelled) {
          setMember(memberData);
          setObservations(obs);
          setConditions(conds);
          setMedications(meds);
          setEncounters(encs);
          setCarePlans(plans);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, memberId, session]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const age = member ? calculateAge(member.birth_date) : null;
  const ageGenderText = [age != null ? `${age}岁` : null, member?.gender || null]
    .filter(Boolean)
    .join(" · ") || "—";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-12"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm bg-[rgba(45,41,38,0.15)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div
        className="relative w-[75vw] h-[85vh] bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-8 py-5 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-elegant-blue/20 ring-4 ring-gray-50 flex items-center justify-center text-2xl font-bold text-elegant-blue">
                {member?.name?.charAt(0) ?? "?"}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#2D2926]">
                  {loading ? "加载中..." : member?.name ?? "—"}
                </h2>
                <span className="text-xs bg-gray-100 rounded-full px-3 py-1 text-gray-600">
                  {ageGenderText}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                最近更新：{formatDate(member?.updated_at ?? null)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              className="bg-elegant-blue text-white border-elegant-blue hover:bg-elegant-blue/90 hover:border-elegant-blue/90"
            >
              编辑档案
            </Button>
            <button
              type="button"
              aria-label="关闭"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center transition"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Left nav */}
          <nav className="w-64 shrink-0 border-r border-gray-100 bg-[#FBFBFB] py-8 px-4 no-scrollbar overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition mb-1",
                    isActive
                      ? "bg-white text-elegant-blue font-bold shadow-sm border border-gray-100"
                      : "text-gray-400 hover:text-gray-600 hover:bg-white/50",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto bg-white px-12 py-10 custom-scrollbar">
            {error ? (
              <div className="text-red-600 py-8">{error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center py-20 text-gray-500">
                加载中...
              </div>
            ) : (
              <>
                {activeTab === "overview" && (
                  <OverviewTabContent
                    member={member}
                    observations={observations}
                    conditions={conditions}
                    carePlans={carePlans}
                  />
                )}
                {activeTab === "health-data" && (
                  <HealthDataTabContent observations={observations} />
                )}
                {activeTab === "health-records" && (
                  <HealthRecordsTabContent conditions={conditions} member={member} />
                )}
                {activeTab === "encounters" && (
                  <EncountersTabContent encounters={encounters} />
                )}
                {activeTab === "medications" && (
                  <MedicationsTabContent medications={medications} />
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
