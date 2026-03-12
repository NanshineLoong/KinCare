import { useEffect, useMemo, useState, type FormEvent, type SVGProps } from "react";
import { Link, useParams } from "react-router-dom";

import {
  createEncounter,
  createMedication,
  createObservation,
  listCarePlans,
  listConditions,
  listEncounters,
  listMedications,
  listObservations,
  type CarePlanRecord,
  type ConditionRecord,
  type EncounterRecord,
  type MedicationRecord,
  type ObservationRecord,
} from "../api/health";
import { ApiError } from "../api/http";
import { getMember } from "../api/members";
import type { AuthMember, AuthSession } from "../auth/session";


type MemberProfilePageProps = {
  members: AuthMember[];
  session: AuthSession;
};

type ProfileState = {
  carePlans: CarePlanRecord[];
  conditions: ConditionRecord[];
  encounters: EncounterRecord[];
  medications: MedicationRecord[];
  observations: ObservationRecord[];
};

type ObservationFormState = {
  code: string;
  display_name: string;
  effective_at: string;
  notes: string;
  unit: string;
  value: string;
};

type MedicationFormState = {
  dosage: string;
  medication_name: string;
  reason: string;
};

type EncounterFormState = {
  date: string;
  facility: string;
  summary: string;
};

const emptyProfileState: ProfileState = {
  carePlans: [],
  conditions: [],
  encounters: [],
  medications: [],
  observations: [],
};

const emptyObservationForm: ObservationFormState = {
  code: "",
  display_name: "",
  effective_at: "",
  notes: "",
  unit: "",
  value: "",
};

const emptyMedicationForm: MedicationFormState = {
  dosage: "",
  medication_name: "",
  reason: "",
};

const emptyEncounterForm: EncounterFormState = {
  date: "",
  facility: "",
  summary: "",
};

function ArrowLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m15 6-6 6 6 6" />
      <path d="M9 12h10" />
    </svg>
  );
}

function SectionIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 19V8" />
      <path d="M10 19V5" />
      <path d="M16 19v-8" />
      <path d="M22 19v-5" />
    </svg>
  );
}

function PillIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="m9.5 9.5 5 5" />
      <path d="M14.5 4.5a4.9 4.9 0 0 1 7 7l-7 7a4.9 4.9 0 1 1-7-7Z" />
    </svg>
  );
}

function TimelineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="12" r="2" />
      <circle cx="8" cy="18" r="2" />
      <path d="M7.7 7.2 16.3 10.8" />
      <path d="M16.7 13.5 9.3 16.5" />
    </svg>
  );
}

function RecordIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
      <rect x="3" y="3" width="18" height="18" rx="4" />
    </svg>
  );
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) {
    return null;
  }

  const [year, month, day] = birthDate.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
    age -= 1;
  }
  return age;
}

function formatDate(value: string | null) {
  if (!value) {
    return "待补充";
  }
  return value.slice(0, 10);
}

function latestObservationByCode(observations: ObservationRecord[], code: string) {
  return observations.find((item) => item.code === code);
}

function sortByNewest<T extends { created_at?: string; effective_at?: string; date?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftKey = left.effective_at ?? left.date ?? left.created_at ?? "";
    const rightKey = right.effective_at ?? right.date ?? right.created_at ?? "";
    return rightKey.localeCompare(leftKey);
  });
}

function buildChartValues(observations: ObservationRecord[], code: string) {
  return observations
    .filter((item) => item.code === code && typeof item.value === "number")
    .slice(0, 5)
    .reverse();
}

function renderMiniChart(points: ObservationRecord[]) {
  if (points.length === 0) {
    return <p className="text-sm text-warm-gray">暂无趋势数据</p>;
  }

  const maxValue = Math.max(...points.map((point) => point.value ?? 0), 1);

  return (
    <div className="mt-4 flex h-32 items-end gap-2 rounded-[1.5rem] bg-[#F8F9FA] px-4 pb-3 pt-6">
      {points.map((point) => (
        <div className="flex flex-1 flex-col items-center justify-end gap-2" key={point.id}>
          <div
            className="w-full rounded-t-xl bg-[#70D98D]"
            style={{
              height: `${Math.max(((point.value ?? 0) / maxValue) * 100, 16)}%`,
            }}
          />
          <span className="text-[10px] font-semibold text-warm-gray">{formatDate(point.effective_at).slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export function MemberProfilePage({ members, session }: MemberProfilePageProps) {
  const { memberId = "" } = useParams();
  const [member, setMember] = useState<AuthMember | null>(members.find((item) => item.id === memberId) ?? null);
  const [profile, setProfile] = useState<ProfileState>(emptyProfileState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessLimited, setAccessLimited] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [observationForm, setObservationForm] = useState<ObservationFormState>(emptyObservationForm);
  const [medicationForm, setMedicationForm] = useState<MedicationFormState>(emptyMedicationForm);
  const [encounterForm, setEncounterForm] = useState<EncounterFormState>(emptyEncounterForm);

  useEffect(() => {
    let isCancelled = false;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      setAccessLimited(false);

      const fallbackMember = members.find((item) => item.id === memberId) ?? null;

      try {
        let resolvedMember = fallbackMember;

        try {
          resolvedMember = await getMember(session, memberId);
        } catch (memberError) {
          if (!(memberError instanceof ApiError) || memberError.status !== 403 || !fallbackMember) {
            throw memberError;
          }
        }

        if (!resolvedMember) {
          throw new Error("成员档案不存在。");
        }

        if (!isCancelled) {
          setMember(resolvedMember);
        }

        try {
          const [observations, conditions, medications, encounters, carePlans] = await Promise.all([
            listObservations(session, memberId),
            listConditions(session, memberId),
            listMedications(session, memberId),
            listEncounters(session, memberId),
            listCarePlans(session, memberId),
          ]);

          if (!isCancelled) {
            setProfile({
              carePlans,
              conditions,
              encounters,
              medications,
              observations: sortByNewest(observations),
            });
          }
        } catch (profileError) {
          if (profileError instanceof ApiError && profileError.status === 403) {
            if (!isCancelled) {
              setAccessLimited(true);
              setProfile(emptyProfileState);
            }
          } else {
            throw profileError;
          }
        }
      } catch (nextError) {
        if (!isCancelled) {
          setError(nextError instanceof Error ? nextError.message : "成员档案加载失败，请重试。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [memberId, members, session]);

  const age = useMemo(() => calculateAge(member?.birth_date ?? null), [member?.birth_date]);
  const latestWeight = latestObservationByCode(profile.observations, "body-weight");
  const latestHeight = latestObservationByCode(profile.observations, "body-height");
  const latestBloodPressure = latestObservationByCode(profile.observations, "bp-systolic");
  const latestGlucose = latestObservationByCode(profile.observations, "blood-glucose");
  const latestSteps = latestObservationByCode(profile.observations, "step-count");
  const latestSleep = latestObservationByCode(profile.observations, "sleep-duration");
  const latestHeartRate = latestObservationByCode(profile.observations, "heart-rate");
  const latestOxygen = latestObservationByCode(profile.observations, "blood-oxygen");
  const latestTemperature = latestObservationByCode(profile.observations, "body-temperature");
  const bpChart = buildChartValues(profile.observations, "bp-systolic");
  const recentObservations = profile.observations.slice(0, 4);

  async function handleObservationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    try {
      const created = await createObservation(session, memberId, {
        category: "vital-signs",
        code: observationForm.code.trim(),
        display_name: observationForm.display_name.trim(),
        value: observationForm.value ? Number(observationForm.value) : null,
        unit: observationForm.unit.trim() || null,
        effective_at: observationForm.effective_at,
        source: "manual",
        notes: observationForm.notes.trim() || null,
      });
      setProfile((current) => ({
        ...current,
        observations: sortByNewest([created, ...current.observations]),
      }));
      setObservationForm(emptyObservationForm);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "记录指标失败，请重试。");
    }
  }

  async function handleMedicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    try {
      const created = await createMedication(session, memberId, {
        medication_name: medicationForm.medication_name.trim(),
        dosage: medicationForm.dosage.trim() || null,
        status: "active",
        reason: medicationForm.reason.trim() || null,
        source: "manual",
      });
      setProfile((current) => ({
        ...current,
        medications: [created, ...current.medications],
      }));
      setMedicationForm(emptyMedicationForm);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "新增用药失败，请重试。");
    }
  }

  async function handleEncounterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);

    try {
      const created = await createEncounter(session, memberId, {
        type: "outpatient",
        date: encounterForm.date,
        facility: encounterForm.facility.trim() || null,
        summary: encounterForm.summary.trim() || null,
        source: "manual",
      });
      setProfile((current) => ({
        ...current,
        encounters: sortByNewest([created, ...current.encounters]),
      }));
      setEncounterForm(emptyEncounterForm);
    } catch (submitError) {
      setActionError(submitError instanceof Error ? submitError.message : "新增就医记录失败，请重试。");
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-8 py-10 shadow-card">
        <p className="text-sm text-warm-gray">正在加载成员档案...</p>
      </section>
    );
  }

  if (error || !member) {
    return (
      <section className="rounded-[2.5rem] border border-[#f1d6d6] bg-[#fff5f4] px-8 py-10 shadow-card">
        <p className="text-sm text-[#9a5e5e]">{error ?? "成员档案不存在。"}</p>
        <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-apple-blue" to="/app">
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          返回首页
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
      <div className="flex items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-apple-blue" to="/app">
          <ArrowLeftIcon aria-hidden className="h-4 w-4" />
          返回首页
        </Link>
        <span className="rounded-full bg-[#F5F0EA] px-4 py-2 text-xs font-semibold tracking-[0.22em] text-warm-gray">成员档案</span>
      </div>

      <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#F9EBEA] text-3xl font-bold text-[#b86d6d]">
              {member.name.slice(0, 1)}
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-[#2D2926]">{member.name}</h2>
              <p className="mt-2 text-sm text-warm-gray">
                {age ? `${age} 岁` : "年龄待补充"} · {member.gender === "female" ? "女" : member.gender === "male" ? "男" : "未填写性别"}
              </p>
            </div>
          </div>
          <div className="rounded-[1.5rem] bg-[#F8F6F3] px-5 py-4 text-sm leading-6 text-warm-gray">
            <p>过敏史：{member.allergies.length > 0 ? member.allergies.join("、") : "未填写"}</p>
            <p>病史：{member.medical_history.length > 0 ? member.medical_history.join("、") : "未填写"}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[#F2EDE7] bg-[#FAF8F5] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-warm-gray">年龄 / 性别</p>
            <p className="mt-2 text-xl font-bold text-[#2D2926]">{age ? `${age}` : "--"} <span className="text-xs font-normal text-warm-gray">/ {member.gender === "female" ? "女" : member.gender === "male" ? "男" : "未填写"}</span></p>
          </div>
          <div className="rounded-2xl border border-[#F2EDE7] bg-[#FAF8F5] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-warm-gray">身高</p>
            <p className="mt-2 text-xl font-bold text-[#2D2926]">
              {latestHeight?.value ? `${latestHeight.value}` : "--"} <span className="text-xs font-normal text-warm-gray">{latestHeight?.unit ?? "cm"}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[#F2EDE7] bg-[#FAF8F5] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-warm-gray">体重</p>
            <p className="mt-2 text-xl font-bold text-[#2D2926]">
              {latestWeight?.value ? `${latestWeight.value}` : "--"} <span className="text-xs font-normal text-warm-gray">{latestWeight?.unit ?? "kg"}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-[#F2EDE7] bg-[#FAF8F5] px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-warm-gray">血型</p>
            <p className="mt-2 text-xl font-bold text-[#2D2926]">{member.blood_type ?? "待补充"}</p>
          </div>
        </div>
      </section>

      {accessLimited ? (
        <div className="rounded-[2rem] border border-[#F2EDE7] bg-white px-5 py-4 text-sm leading-7 text-warm-gray shadow-soft">
          当前账号仅能查看该成员的基础资料，健康记录部分还未获得授权。
        </div>
      ) : null}

      {!accessLimited ? (
        <>
          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF0F0] text-[#D66F6F]">
                <SectionIcon aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#2D2926]">慢病管理</h3>
                <p className="text-sm text-warm-gray">高血压、血糖等需要持续跟踪的指标</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
              <div className="rounded-[2rem] bg-[#FAFBFB] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">收缩压趋势</p>
                <p className="mt-3 text-3xl font-bold text-[#2D2926]">
                  {latestBloodPressure?.value ? `${latestBloodPressure.value}` : "--"}
                  <span className="ml-2 text-xs font-semibold text-[#41A15B]">{latestBloodPressure?.unit ?? "mmHg"}</span>
                </p>
                {renderMiniChart(bpChart)}
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">活跃慢病</p>
                  <p className="mt-3 text-lg font-bold text-[#2D2926]">
                    {profile.conditions.length > 0 ? profile.conditions.map((item) => item.display_name).join("、") : "暂无"}
                  </p>
                </div>
                <div className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">血糖</p>
                  <p className="mt-3 text-lg font-bold text-[#2D2926]">
                    {latestGlucose?.value ? `${latestGlucose.value}` : "--"}
                    <span className="ml-2 text-xs font-normal text-warm-gray">{latestGlucose?.unit ?? "mmol/L"}</span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF4E8] text-[#D6963A]">
                <SectionIcon aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#2D2926]">生活习惯</h3>
                <p className="text-sm text-warm-gray">步数、睡眠和日常状态</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.8rem] border border-[#F2EDE7] bg-[#FFF9F1] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">步数</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">{latestSteps?.value ? Math.round(latestSteps.value) : "--"}</p>
              </div>
              <div className="rounded-[1.8rem] border border-[#F2EDE7] bg-[#F2F7FF] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">睡眠</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">
                  {latestSleep?.value ? latestSleep.value.toFixed(1) : "--"}
                  <span className="ml-2 text-xs font-normal text-warm-gray">{latestSleep?.unit ?? "小时"}</span>
                </p>
              </div>
              <div className="rounded-[1.8rem] border border-[#F2EDE7] bg-[#FAF8F5] px-5 py-5">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">饮水</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">待补充</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF5FF] text-[#4879D5]">
                <SectionIcon aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#2D2926]">生理指标</h3>
                <p className="text-sm text-warm-gray">心率、血氧和体温的最新状态</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">心率</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">{latestHeartRate?.value ?? "--"}</p>
              </div>
              <div className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">血氧</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">{latestOxygen?.value ?? "--"}</p>
              </div>
              <div className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5 text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-warm-gray">体温</p>
                <p className="mt-3 text-2xl font-bold text-[#2D2926]">{latestTemperature?.value ?? "--"}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F0FF] text-[#8B62D7]">
                <SectionIcon aria-hidden className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[#2D2926]">心理情绪</h3>
                <p className="text-sm text-warm-gray">当前阶段仍以手动记录和 AI 对话补充为主</p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.8rem] border border-[#EEE6FF] bg-[#FBF8FF] px-5 py-5 text-sm leading-7 text-warm-gray">
              暂无专门的心理情绪记录。你可以在首页 AI 对话中补充家人的心情、胃口、睡眠感受，再在后续阶段写回结构化档案。
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-[#2D2926]">
                <PillIcon aria-hidden className="h-5 w-5 text-[#D66F6F]" />
                当前用药
              </h3>
              <span className="text-sm font-semibold text-warm-gray">{profile.medications.length} 条</span>
            </div>

            <div className="mt-6 space-y-4">
              {profile.medications.length === 0 ? (
                <p className="text-sm text-warm-gray">暂无用药记录。</p>
              ) : (
                profile.medications.map((item) => (
                  <div className="flex flex-col gap-3 rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5 sm:flex-row sm:items-center sm:justify-between" key={item.id}>
                    <div>
                      <p className="text-lg font-bold text-[#2D2926]">{item.medication_name}</p>
                      <p className="mt-1 text-sm text-warm-gray">{item.dosage ?? "剂量待补充"} · {item.reason ?? "未填写用药原因"}</p>
                    </div>
                    <div className="text-sm font-semibold text-[#41A15B]">{item.status === "active" ? "当前服用" : item.status}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2 text-xl font-bold text-[#2D2926]">
                <TimelineIcon aria-hidden className="h-5 w-5 text-[#4879D5]" />
                就医时间线
              </h3>
              <span className="text-sm font-semibold text-warm-gray">{profile.encounters.length} 条</span>
            </div>

            <div className="mt-6 space-y-4">
              {profile.encounters.length === 0 ? (
                <p className="text-sm text-warm-gray">暂无就医记录。</p>
              ) : (
                profile.encounters.map((item) => (
                  <article className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5" key={item.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-lg font-bold text-[#2D2926]">{item.facility ?? "未填写机构"}</p>
                        <p className="mt-1 text-sm text-warm-gray">{item.department ?? "未填写科室"} · {formatDate(item.date)}</p>
                      </div>
                      <span className="rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-semibold text-[#4879D5]">{item.type}</span>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-warm-gray">{item.summary ?? "暂无摘要"}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[2.5rem] border border-[#F2EDE7]/60 bg-white px-6 py-7 shadow-card sm:px-8">
            <div className="flex items-center gap-2">
              <RecordIcon aria-hidden className="h-5 w-5 text-apple-blue" />
              <h3 className="text-xl font-bold text-[#2D2926]">手动录入</h3>
            </div>
            <p className="mt-2 text-sm leading-7 text-warm-gray">当前支持直接补录指标、用药和就医记录，方便从首页提醒跳转后继续完善档案。</p>

            {actionError ? (
              <div className="mt-5 rounded-[1.6rem] border border-[#f1d6d6] bg-[#fff5f4] px-4 py-4 text-sm text-[#9a5e5e]">
                {actionError}
              </div>
            ) : null}

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <form className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5" onSubmit={handleObservationSubmit}>
                <h4 className="text-base font-bold text-[#2D2926]">录入指标</h4>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-code">
                    指标编码
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-code"
                      onChange={(event) => setObservationForm((current) => ({ ...current, code: event.target.value }))}
                      type="text"
                      value={observationForm.code}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-name">
                    指标名称
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-name"
                      onChange={(event) => setObservationForm((current) => ({ ...current, display_name: event.target.value }))}
                      type="text"
                      value={observationForm.display_name}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-value">
                    数值
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-value"
                      onChange={(event) => setObservationForm((current) => ({ ...current, value: event.target.value }))}
                      type="number"
                      value={observationForm.value}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-unit">
                    单位
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-unit"
                      onChange={(event) => setObservationForm((current) => ({ ...current, unit: event.target.value }))}
                      type="text"
                      value={observationForm.unit}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-effective-at">
                    测量时间
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-effective-at"
                      onChange={(event) => setObservationForm((current) => ({ ...current, effective_at: event.target.value }))}
                      type="datetime-local"
                      value={observationForm.effective_at}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="observation-notes">
                    备注
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="observation-notes"
                      onChange={(event) => setObservationForm((current) => ({ ...current, notes: event.target.value }))}
                      value={observationForm.notes}
                    />
                  </label>
                </div>
                <button className="mt-4 inline-flex rounded-full bg-[#2D2926] px-5 py-3 text-sm font-semibold text-white" type="submit">
                  记录指标
                </button>
              </form>

              <form className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5" onSubmit={handleMedicationSubmit}>
                <h4 className="text-base font-bold text-[#2D2926]">录入用药</h4>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="medication-name">
                    药物名称
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="medication-name"
                      onChange={(event) => setMedicationForm((current) => ({ ...current, medication_name: event.target.value }))}
                      type="text"
                      value={medicationForm.medication_name}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="medication-dosage">
                    用法用量
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="medication-dosage"
                      onChange={(event) => setMedicationForm((current) => ({ ...current, dosage: event.target.value }))}
                      type="text"
                      value={medicationForm.dosage}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="medication-reason">
                    用药原因
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="medication-reason"
                      onChange={(event) => setMedicationForm((current) => ({ ...current, reason: event.target.value }))}
                      type="text"
                      value={medicationForm.reason}
                    />
                  </label>
                </div>
                <button className="mt-4 inline-flex rounded-full bg-[#2D2926] px-5 py-3 text-sm font-semibold text-white" type="submit">
                  添加用药
                </button>
              </form>

              <form className="rounded-[1.8rem] border border-[#F2EDE7] px-5 py-5" onSubmit={handleEncounterSubmit}>
                <h4 className="text-base font-bold text-[#2D2926]">录入就医</h4>
                <div className="mt-4 grid gap-3">
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="encounter-date">
                    就诊日期
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="encounter-date"
                      onChange={(event) => setEncounterForm((current) => ({ ...current, date: event.target.value }))}
                      type="date"
                      value={encounterForm.date}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="encounter-facility">
                    机构/医院
                    <input
                      className="mt-2 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="encounter-facility"
                      onChange={(event) => setEncounterForm((current) => ({ ...current, facility: event.target.value }))}
                      type="text"
                      value={encounterForm.facility}
                    />
                  </label>
                  <label className="text-sm font-medium text-[#2D2926]" htmlFor="encounter-summary">
                    就诊摘要
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-2xl border border-[#E7DDD1] px-4 py-3 text-sm outline-none focus:border-apple-blue focus:ring-2 focus:ring-apple-blue/20"
                      id="encounter-summary"
                      onChange={(event) => setEncounterForm((current) => ({ ...current, summary: event.target.value }))}
                      value={encounterForm.summary}
                    />
                  </label>
                </div>
                <button className="mt-4 inline-flex rounded-full bg-[#2D2926] px-5 py-3 text-sm font-semibold text-white" type="submit">
                  添加就医
                </button>
              </form>
            </div>

            <div className="mt-6 rounded-[1.8rem] border border-[#F2EDE7] bg-[#FAF8F5] px-5 py-5">
              <h4 className="text-base font-bold text-[#2D2926]">最近录入</h4>
              <div className="mt-4 space-y-3">
                {recentObservations.length === 0 ? (
                  <p className="text-sm text-warm-gray">还没有新的指标记录。</p>
                ) : (
                  recentObservations.map((item) => (
                    <div className="rounded-2xl bg-white px-4 py-4" key={item.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-[#2D2926]">{item.display_name}</p>
                        <span className="text-sm font-bold text-[#2D2926]">
                          {item.value ?? item.value_string ?? "--"} {item.unit ?? ""}
                        </span>
                      </div>
                      {item.notes ? <p className="mt-2 text-sm text-warm-gray">{item.notes}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
