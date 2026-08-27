import type { CertificateDraft } from "@/app/certificate/types";
import { createClient } from "./supabase/client";

export type StoredCertificate = { id: string; payload: CertificateDraft; created_at: string; updated_at: string };

function certificatesTable() {
  return createClient().from("certificates");
}

function unwrap(row: { id: string; payload: unknown; created_at: string; updated_at: string }): StoredCertificate {
  return { ...row, payload: row.payload as CertificateDraft };
}

export async function listCertificates(): Promise<StoredCertificate[]> {
  const { data, error } = await certificatesTable().select("id, payload, created_at, updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return data.map(unwrap);
}

export async function createCertificate(payload: CertificateDraft): Promise<StoredCertificate> {
  const { data, error } = await certificatesTable().insert({ payload }).select("id, payload, created_at, updated_at").single();
  if (error) throw error;
  return unwrap(data);
}

export async function updateCertificate(id: string, payload: CertificateDraft): Promise<StoredCertificate> {
  const { data, error } = await certificatesTable().update({ payload }).eq("id", id).select("id, payload, created_at, updated_at").single();
  if (error) throw error;
  return unwrap(data);
}

export async function deleteCertificate(id: string): Promise<void> {
  const { error } = await certificatesTable().delete().eq("id", id);
  if (error) throw error;
}
