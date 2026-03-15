import type { AuthSession } from "../auth/session";

import { getAuthorized, sendAuthorized, sendAuthorizedFormData } from "./http";


export type DashboardObservationSnapshot = {
  code: string;
  display_name: string;
  value: number | null;
  value_string: string | null;
  unit: string | null;
  effective_at: string;
};

export type DashboardHealthSummary = {
  id: string;
  member_id: string;
  category: string;
  label: string;
  value: string;
  status: "good" | "warning" | "neutral";
  generated_at: string;
  created_at: string;
};

export type EncounterRecord = {
  id: string;
  member_id: string;
  type: string;
  facility: string | null;
  department: string | null;
  attending_physician?: string | null;
  date: string;
  summary: string | null;
  source: string;
  source_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type DashboardMemberSummary = {
  member: {
    id: string;
    name: string;
    gender: string;
    avatar_url: string | null;
    blood_type: string | null;
  };
  latest_observations?: Record<string, DashboardObservationSnapshot>;
  active_conditions?: string[];
  active_medications_count?: number;
  latest_encounter?: EncounterRecord | null;
  health_summaries?: DashboardHealthSummary[];
};

export type CarePlanRecord = {
  id: string;
  member_id: string;
  category: string;
  title: string;
  description: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  generated_by: string;
  created_at: string;
  updated_at: string;
};

export type DocumentRecord = {
  id: string;
  member_id: string;
  uploaded_by: string;
  doc_type: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  extraction_status: string;
  extracted_at: string | null;
  raw_extraction: import("./chat").DocumentExtractionDraft | null;
  created_at: string;
  updated_at: string;
};

export type DocumentExtractionRecord = {
  id: string;
  member_id: string;
  file_name: string;
  doc_type: string;
  extraction_status: string;
  extracted_at: string | null;
  raw_extraction: import("./chat").DocumentExtractionDraft | null;
};

export type DashboardReminder = CarePlanRecord & {
  member_name: string;
};

export type DashboardResponse = {
  members: DashboardMemberSummary[];
  today_reminders: DashboardReminder[];
};

export type ObservationRecord = {
  id: string;
  member_id: string;
  category: string;
  code: string;
  display_name: string;
  value: number | null;
  value_string: string | null;
  unit: string | null;
  effective_at: string;
  source: string;
  source_ref: string | null;
  notes: string | null;
  encounter_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ConditionRecord = {
  id: string;
  member_id: string;
  category: string;
  code: string;
  display_name: string;
  clinical_status: string;
  onset_date: string | null;
  abatement_date: string | null;
  severity: string | null;
  source: string;
  source_ref: string | null;
  notes: string | null;
  encounter_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MedicationRecord = {
  id: string;
  member_id: string;
  medication_name: string;
  dosage: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  reason: string | null;
  prescribed_by: string | null;
  source: string;
  source_ref: string | null;
  notes: string | null;
  encounter_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ObservationCreatePayload = {
  category: string;
  code: string;
  display_name: string;
  value: number | null;
  value_string?: string | null;
  unit: string | null;
  effective_at: string;
  source: string;
  source_ref?: string | null;
  notes?: string | null;
  encounter_id?: string | null;
};

export type MedicationCreatePayload = {
  medication_name: string;
  dosage?: string | null;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  reason?: string | null;
  prescribed_by?: string | null;
  source: string;
  source_ref?: string | null;
  notes?: string | null;
  encounter_id?: string | null;
};

export type EncounterCreatePayload = {
  type: string;
  facility?: string | null;
  department?: string | null;
  date: string;
  summary?: string | null;
  source: string;
  source_ref?: string | null;
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

export function createObservation(session: AuthSession, memberId: string, payload: ObservationCreatePayload) {
  return sendAuthorized<ObservationRecord, ObservationCreatePayload>(
    `/api/members/${memberId}/observations`,
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export function createMedication(session: AuthSession, memberId: string, payload: MedicationCreatePayload) {
  return sendAuthorized<MedicationRecord, MedicationCreatePayload>(
    `/api/members/${memberId}/medications`,
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export function createEncounter(session: AuthSession, memberId: string, payload: EncounterCreatePayload) {
  return sendAuthorized<EncounterRecord, EncounterCreatePayload>(
    `/api/members/${memberId}/encounters`,
    session,
    {
      method: "POST",
      payload,
    },
  );
}

export async function uploadMemberDocument(
  session: AuthSession,
  memberId: string,
  payload: { docType: string; file: File },
) {
  const formData = new FormData();
  formData.append("doc_type", payload.docType);
  formData.append("file", payload.file);
  return sendAuthorizedFormData<DocumentRecord>(`/api/members/${memberId}/documents/upload`, session, formData);
}

export function getDocumentExtraction(session: AuthSession, documentId: string) {
  return getAuthorized<DocumentExtractionRecord>(`/api/documents/${documentId}/extraction`, session);
}

export function confirmDocumentExtraction(
  session: AuthSession,
  documentId: string,
  payload: import("./chat").DocumentExtractionDraft,
) {
  return sendAuthorized<{ document_id: string; created_counts: Record<string, number> }, import("./chat").DocumentExtractionDraft>(
    `/api/documents/${documentId}/confirm`,
    session,
    {
      method: "POST",
      payload,
    },
  );
}
