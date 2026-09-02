import type { Images } from "@/app/certificate/types";
import { createClient } from "./supabase/client";

export type CompanyImages = Pick<Images, "logo" | "badge1" | "badge2" | "badge3" | "companyStamp" | "inspectionStamp">;

const ROW_ID = "default";
const STORAGE_KEY = "smb-company-assets";

export const emptyCompanyImages: CompanyImages = {
  logo: null, badge1: null, badge2: null, badge3: null, companyStamp: null, inspectionStamp: null,
};

function companyAssetsTable() {
  return createClient().from("company_assets");
}

// Company branding rarely changes and must show up instantly for every certificate
// (including brand-new drafts), so localStorage is the source of truth for instant
// reads/writes. Supabase is synced best-effort underneath so it also follows the
// admin across devices once the `company_assets` table exists.
export function readLocalCompanyAssets(): CompanyImages {
  if (typeof window === "undefined") return emptyCompanyImages;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyCompanyImages, ...JSON.parse(raw) } : emptyCompanyImages;
  } catch {
    return emptyCompanyImages;
  }
}

export function writeLocalCompanyAssets(images: CompanyImages) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  } catch {
    // storage full/unavailable — the in-memory state still has it for this session
  }
}

export async function getRemoteCompanyAssets(): Promise<CompanyImages | null> {
  try {
    const { data, error } = await companyAssetsTable().select("images").eq("id", ROW_ID).maybeSingle();
    if (error) throw error;
    return data ? { ...emptyCompanyImages, ...(data.images as CompanyImages) } : null;
  } catch {
    // table may not exist yet (migration not run) — caller falls back to localStorage
    return null;
  }
}

export async function saveRemoteCompanyAssets(images: CompanyImages): Promise<boolean> {
  try {
    const { error } = await companyAssetsTable().upsert({ id: ROW_ID, images });
    if (error) throw error;
    return true;
  } catch {
    return false;
  }
}
