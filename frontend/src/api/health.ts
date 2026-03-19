import type { AuthSession } from "../auth/session";

import { deleteAuthorized, getAuthorized, sendAuthorized } from "./http";


export type HealthSummaryRecord = {
  id: string;
  member_id: string;
  category: string;
  label: string;
  value: string;
  status: "good" | "warning" | "alert";
  generated_at: string;
  created_at: string;
};

export type CarePlanRecord = {
  id: string;
  member_id: string;
  assignee_member_id: string | null;
  category: string;
  icon_key: "medication" | "exercise" | "checkup" | "meal" | "rest" | "social" | "general" | null;
  time_slot: "清晨" | "上午" | "午后" | "晚间" | "睡前" | null;
  title: string;
  description: string;
  notes: string | null;
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

export type DashboardReminderGroup = {
  time_slot: "清晨" | "上午" | "午后" | "晚间" | "睡前";
  reminders: DashboardReminder[];
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
  reminder_groups?: DashboardReminderGroup[];
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

// ─── Observation CRUD ─────────────────────────────────────────────────────────

export type ObservationCreatePayload = {
  category: "chronic-vitals" | "lifestyle" | "body-vitals";
  code: string;
  display_name: string;
  value?: number | null;
  value_string?: string | null;
  unit?: string | null;
  context?: string | null;
  effective_at: string;
  source?: "manual" | "device" | "ai-extract";
  device_name?: string | null;
  notes?: string | null;
};

export type ObservationUpdatePayload = Partial<ObservationCreatePayload>;

export function createObservation(session: AuthSession, memberId: string, payload: ObservationCreatePayload) {
  return sendAuthorized<ObservationRecord, ObservationCreatePayload>(
    `/api/members/${memberId}/observations`,
    session,
    { method: "POST", payload },
  );
}

export function updateObservation(session: AuthSession, memberId: string, recordId: string, payload: ObservationUpdatePayload) {
  return sendAuthorized<ObservationRecord, ObservationUpdatePayload>(
    `/api/members/${memberId}/observations/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteObservation(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/observations/${recordId}`, session);
}

// ─── Condition CRUD ───────────────────────────────────────────────────────────

export type ConditionCreatePayload = {
  category: "diagnosis" | "chronic" | "allergy" | "family-history";
  display_name: string;
  clinical_status?: "active" | "inactive" | "resolved";
  onset_date?: string | null;
  source?: "manual" | "ai-extract";
  notes?: string | null;
};

export type ConditionUpdatePayload = Partial<ConditionCreatePayload>;

export function createCondition(session: AuthSession, memberId: string, payload: ConditionCreatePayload) {
  return sendAuthorized<ConditionRecord, ConditionCreatePayload>(
    `/api/members/${memberId}/conditions`,
    session,
    { method: "POST", payload },
  );
}

export function updateCondition(session: AuthSession, memberId: string, recordId: string, payload: ConditionUpdatePayload) {
  return sendAuthorized<ConditionRecord, ConditionUpdatePayload>(
    `/api/members/${memberId}/conditions/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteCondition(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/conditions/${recordId}`, session);
}

// ─── Medication CRUD ──────────────────────────────────────────────────────────

export type MedicationCreatePayload = {
  name: string;
  indication?: string | null;
  dosage_description?: string | null;
  status?: "active" | "stopped";
  start_date?: string | null;
  end_date?: string | null;
  source?: "manual" | "ai-extract";
};

export type MedicationUpdatePayload = Partial<MedicationCreatePayload>;

export function createMedication(session: AuthSession, memberId: string, payload: MedicationCreatePayload) {
  return sendAuthorized<MedicationRecord, MedicationCreatePayload>(
    `/api/members/${memberId}/medications`,
    session,
    { method: "POST", payload },
  );
}

export function updateMedication(session: AuthSession, memberId: string, recordId: string, payload: MedicationUpdatePayload) {
  return sendAuthorized<MedicationRecord, MedicationUpdatePayload>(
    `/api/members/${memberId}/medications/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteMedication(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/medications/${recordId}`, session);
}

// ─── Encounter CRUD ───────────────────────────────────────────────────────────

export type EncounterCreatePayload = {
  type: "outpatient" | "inpatient" | "checkup" | "emergency";
  facility?: string | null;
  department?: string | null;
  attending_physician?: string | null;
  date: string;
  summary?: string | null;
  source?: "manual" | "ai-extract";
};

export type EncounterUpdatePayload = Partial<EncounterCreatePayload>;

export function createEncounter(session: AuthSession, memberId: string, payload: EncounterCreatePayload) {
  return sendAuthorized<EncounterRecord, EncounterCreatePayload>(
    `/api/members/${memberId}/encounters`,
    session,
    { method: "POST", payload },
  );
}

export function updateEncounter(session: AuthSession, memberId: string, recordId: string, payload: EncounterUpdatePayload) {
  return sendAuthorized<EncounterRecord, EncounterUpdatePayload>(
    `/api/members/${memberId}/encounters/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteEncounter(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/encounters/${recordId}`, session);
}

// ─── SleepRecord CRUD ─────────────────────────────────────────────────────────

export type SleepRecordCreatePayload = {
  start_at: string;
  end_at: string;
  total_minutes: number;
  deep_minutes?: number | null;
  rem_minutes?: number | null;
  light_minutes?: number | null;
  awake_minutes?: number | null;
  efficiency_score?: number | null;
  is_nap?: boolean;
  source?: "manual" | "device";
  device_name?: string | null;
};

export type SleepRecordUpdatePayload = Partial<SleepRecordCreatePayload>;

export function createSleepRecord(session: AuthSession, memberId: string, payload: SleepRecordCreatePayload) {
  return sendAuthorized<SleepRecord, SleepRecordCreatePayload>(
    `/api/members/${memberId}/sleep-records`,
    session,
    { method: "POST", payload },
  );
}

export function updateSleepRecord(session: AuthSession, memberId: string, recordId: string, payload: SleepRecordUpdatePayload) {
  return sendAuthorized<SleepRecord, SleepRecordUpdatePayload>(
    `/api/members/${memberId}/sleep-records/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteSleepRecord(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/sleep-records/${recordId}`, session);
}

// ─── WorkoutRecord CRUD ───────────────────────────────────────────────────────

export type WorkoutRecordCreatePayload = {
  type: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  energy_burned?: number | null;
  distance_meters?: number | null;
  avg_heart_rate?: number | null;
  source?: "manual" | "device";
  device_name?: string | null;
  notes?: string | null;
};

export type WorkoutRecordUpdatePayload = Partial<WorkoutRecordCreatePayload>;

export function createWorkoutRecord(session: AuthSession, memberId: string, payload: WorkoutRecordCreatePayload) {
  return sendAuthorized<WorkoutRecord, WorkoutRecordCreatePayload>(
    `/api/members/${memberId}/workout-records`,
    session,
    { method: "POST", payload },
  );
}

export function updateWorkoutRecord(session: AuthSession, memberId: string, recordId: string, payload: WorkoutRecordUpdatePayload) {
  return sendAuthorized<WorkoutRecord, WorkoutRecordUpdatePayload>(
    `/api/members/${memberId}/workout-records/${recordId}`,
    session,
    { method: "PUT", payload },
  );
}

export function deleteWorkoutRecord(session: AuthSession, memberId: string, recordId: string) {
  return deleteAuthorized(`/api/members/${memberId}/workout-records/${recordId}`, session);
}
