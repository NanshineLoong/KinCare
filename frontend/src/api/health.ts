import type { AuthSession } from "../auth/session";

import { getAuthorized } from "./http";


export type HealthSummaryRecord = {
  id: string;
  member_id: string;
  category: "chronic-vitals" | "lifestyle" | "body-vitals";
  label: string;
  value: string;
  status: "good" | "warning" | "neutral";
  generated_at: string;
  created_at: string;
};

export type CarePlanRecord = {
  id: string;
  member_id: string;
  category: string;
  title: string;
  description: string;
  status: "active" | "completed" | "cancelled";
  scheduled_at: string | null;
  completed_at: string | null;
  generated_by: "ai" | "manual";
  created_at: string;
  updated_at: string;
};

export type DashboardReminder = CarePlanRecord & {
  member_name: string;
};

export type ObservationRecord = {
  id: string;
  member_id: string;
  category: "chronic-vitals" | "lifestyle" | "body-vitals";
  code: string;
  display_name: string;
  value: number | null;
  value_string: string | null;
  unit: string | null;
  context: string | null;
  effective_at: string;
  source: "manual" | "device" | "ai-extract";
  device_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ConditionRecord = {
  id: string;
  member_id: string;
  category: "diagnosis" | "chronic" | "allergy" | "family-history";
  display_name: string;
  clinical_status: "active" | "inactive" | "resolved";
  onset_date: string | null;
  source: "manual" | "ai-extract";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicationRecord = {
  id: string;
  member_id: string;
  name: string;
  indication: string | null;
  dosage_description: string | null;
  status: "active" | "stopped";
  start_date: string | null;
  end_date: string | null;
  source: "manual" | "ai-extract";
  created_at: string;
  updated_at: string;
};

export type EncounterRecord = {
  id: string;
  member_id: string;
  type: "outpatient" | "inpatient" | "checkup" | "emergency";
  facility: string | null;
  department: string | null;
  attending_physician: string | null;
  date: string;
  summary: string | null;
  source: "manual" | "ai-extract";
  created_at: string;
  updated_at: string;
};

export type SleepRecord = {
  id: string;
  member_id: string;
  start_at: string;
  end_at: string;
  total_minutes: number;
  deep_minutes: number | null;
  rem_minutes: number | null;
  light_minutes: number | null;
  awake_minutes: number | null;
  efficiency_score: number | null;
  is_nap: boolean;
  source: "manual" | "device";
  device_name: string | null;
  created_at: string;
};

export type WorkoutRecord = {
  id: string;
  member_id: string;
  type: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  energy_burned: number | null;
  distance_meters: number | null;
  avg_heart_rate: number | null;
  source: "manual" | "device";
  device_name: string | null;
  notes: string | null;
  created_at: string;
};

export type DashboardMemberSummary = {
  member: {
    id: string;
    name: string;
    gender: string;
    avatar_url: string | null;
    blood_type: string | null;
  };
  health_summaries: HealthSummaryRecord[];
};

export type DashboardResponse = {
  members: DashboardMemberSummary[];
  today_reminders: DashboardReminder[];
};

export function getDashboard(session: AuthSession) {
  return getAuthorized<DashboardResponse>("/api/dashboard", session);
}

export function listObservations(session: AuthSession, memberId: string) {
  return getAuthorized<ObservationRecord[]>(`/api/members/${memberId}/observations`, session);
}

export function listConditions(session: AuthSession, memberId: string) {
  return getAuthorized<ConditionRecord[]>(`/api/members/${memberId}/conditions`, session);
}

export function listMedications(session: AuthSession, memberId: string) {
  return getAuthorized<MedicationRecord[]>(`/api/members/${memberId}/medications`, session);
}

export function listEncounters(session: AuthSession, memberId: string) {
  return getAuthorized<EncounterRecord[]>(`/api/members/${memberId}/encounters`, session);
}

export function listCarePlans(session: AuthSession, memberId: string) {
  return getAuthorized<CarePlanRecord[]>(`/api/members/${memberId}/care-plans`, session);
}

export function listSleepRecords(session: AuthSession, memberId: string) {
  return getAuthorized<SleepRecord[]>(`/api/members/${memberId}/sleep-records`, session);
}

export function listWorkoutRecords(session: AuthSession, memberId: string) {
  return getAuthorized<WorkoutRecord[]>(`/api/members/${memberId}/workout-records`, session);
}

export function listHealthSummaries(session: AuthSession, memberId: string) {
  return getAuthorized<HealthSummaryRecord[]>(`/api/members/${memberId}/health-summaries`, session);
}
