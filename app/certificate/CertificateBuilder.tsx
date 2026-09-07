"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChangeEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  createCertificate as createStoredCertificate,
  deleteCertificate as deleteStoredCertificate,
  listCertificates,
  StoredCertificate,
  updateCertificate,
} from "@/lib/certificates";
import { signOutAction } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import {
  emptyCompanyImages,
  getRemoteCompanyAssets,
  readLocalCompanyAssets,
  saveRemoteCompanyAssets,
  writeLocalCompanyAssets,
} from "@/lib/companyAssets";
import type { CompanyImages } from "@/lib/companyAssets";
import type { CertificateDraft, Chemistry, Images, Item, RawMaterial } from "./types";

const sharedImageKeys: (keyof CompanyImages)[] = ["logo", "badge1", "badge2", "badge3", "companyStamp", "inspectionStamp"];
const isSharedImageKey = (key: keyof Images): key is keyof CompanyImages =>
  (sharedImageKeys as (keyof Images)[]).includes(key);

type CertificateRecord = { id: string; draft: CertificateDraft; savedAt?: string };


// ─── Default / seed data ─────────────────────────────────────────────────────

const itemRows: Item[] = [
  { wo: "5375/1",  sr: "1",  description: "CS, SEAMLESS, ECCENTRIC REDUCER, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 16\" NB X SCH STD, IBR.", size: '16" NB', sch: "SCH STD", id: "CT0754", ht: "TPZ 4238", qty: "1" },
  { wo: "5375/4",  sr: "4",  description: "CS, SEAMLESS, ELBOW 45° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 6\" NB X SCH STD, R=1.5D, IBR.", size: '6" NB', sch: "SCH STD", id: "CT0832", ht: "HF", qty: "10" },
  // { wo: "5375/6",  sr: "6",  description: "CS, SEAMLESS, EQUAL TEE, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 16\" NB X SCH XS, IBR.", size: '16" NB', sch: "SCH XS", id: "CT0778", ht: "TPZ 4238", qty: "1" },
  // { wo: "5375/8",  sr: "8",  description: "CS, SEAMLESS, ELBOW 90° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 3\" NB X SCH 80, R=1.5D, IBR.", size: '3" NB', sch: "SCH 80", id: "CT0844", ht: "TPZ 4231", qty: "6" },
  // { wo: "5375/11", sr: "11", description: "CS, SEAMLESS, ELBOW 45° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 3\" NB X SCH 80, R=1.5D, IBR.", size: '3" NB', sch: "SCH 80", id: "CT0844", ht: "TPZ 4231", qty: "2" },
  // { wo: "5375/14", sr: "14", description: "CS, SEAMLESS, ELBOW 45° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 14\" NB X SCH XS, R=1.5D, IBR.", size: '14" NB', sch: "SCH XS", id: "CT0804", ht: "TPZ 4231", qty: "1" },
  // { wo: "5375/29", sr: "29", description: "CS, SEAMLESS, ELBOW 90° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 6\" NB X SCH STD, R=1.5D, IBR.", size: '6" NB', sch: "SCH STD", id: "CT0832", ht: "HF", qty: "6" },
  // { wo: "5375/30", sr: "30", description: "CS, SEAMLESS, ELBOW 90° LR, BW, ASME B16.9, ASTM A234 GRADE WPB-S, SIZE: 3\" NB X SCH 80, R=1.5D, IBR.", size: '3" NB', sch: "SCH 80", id: "CT0844", ht: "TPZ 4231", qty: "1" },
];

const chemistryRows: Chemistry[] = [
  { id: "CT0754", c: "0.161", cr: "0.013", ni: "0.012", mo: "0.003", mn: "1.020", p: "0.014", s: "0.002", si: "0.222", v: "0.001", cu: "0.006", ce: "0.335", ys: "289.99", uts: "482.54", gl: "50.0", el: "46.00", bend: "NA", flat: "OK" },
  { id: "CT0832", c: "0.135", cr: "0.013", ni: "0.005", mo: "0.001", mn: "0.667", p: "0.013", s: "0.005", si: "0.267", v: "0.002", cu: "0.002", ce: "0.250", ys: "308.97", uts: "477.20", gl: "50.0", el: "41.00", bend: "NA", flat: "OK" },
  // { id: "CT0778", c: "0.182", cr: "0.028", ni: "0.015", mo: "0.002", mn: "1.202", p: "0.015", s: "0.005", si: "0.262", v: "0.005", cu: "0.006", ce: "0.366", ys: "338.43", uts: "479.50", gl: "50.0", el: "43.80", bend: "NA", flat: "OK" },
  // { id: "CT0844", c: "0.133", cr: "0.016", ni: "0.003", mo: "0.001", mn: "0.674", p: "0.015", s: "0.007", si: "0.271", v: "0.005", cu: "0.006", ce: "0.249", ys: "329.41", uts: "446.86", gl: "50.0", el: "46.60", bend: "NA", flat: "OK" },
];

const rawLabels = [
  "Process of manufacture", "Fully killed/Rimmed", "Specification", "Heat number",
  "Size", "Test Certificate No. & Date", "Name of the Maker", "Name of Inspection Authority",
];

const rawMaterials: RawMaterial[] = [
  { id: "CT0754", values: ["BF/EAF/EOF/RF/VD/CCM/ROLLING", "Fully killed & fine grained", "A 106 GR.B", "AAB1145 (ID NO:- CT0754)", "406.4 mm OD X 12.7 mm THK PIPE", "MSL-14/IBR/2414/1/2023 Dt:-09.11.2023", "MAHARASHTRA SEAMLESS LIMITED", "WELL KNOWN PIPE & TUBE MAKER"] },
  { id: "CT0832", values: ["BF/EAF/EOF/RF/VD/CCM/ROLLING", "Fully killed & fine grained", "A 106 GR.B", "AA4184 (ID NO:CT0832)", "114.3 mm OD X 7.8 mm THK PIPE", "MSL-7/IBR/0284/2/2025 Dt:-29.04.2025", "MAHARASHTRA SEAMLESS LIMITED", "WELL KNOWN PIPE & TUBE MAKER"] },
  // { id: "CT0778", values: ["BF/EAF/EOF/RF/VD/CCM/ROLLING", "Fully killed & fine grained", "A 106 GR.B", "AAB1424 (ID NO:- CT0778)", "457 mm OD X 12.7 mm THK PIPE", "MSL-14/IBR/510/1/2024 Dt:-27.05.2024", "MAHARASHTRA SEAMLESS LIMITED", "WELL KNOWN PIPE & TUBE MAKER"] },
  // { id: "CT0844", values: ["BF/EAF/EOF/RF/VD/CCM/ROLLING", "Fully killed & fine grained", "A 106 GR.B", "AA15166 (ID NO:- CT0844)", "88.9 mm OD X 7.62 mm THK", "MSL-7/IBR/1344/3/2025 Dt:-11.09.2025", "MAHARASHTRA SEAMLESS LIMITED", "WELL KNOWN PIPE & TUBE MAKER"] },
];

const initialDraft: CertificateDraft = {
  company: {
    name: "SMB Fitting Industry",
    address: "New No. 404/406, Thiruvottiyur High Road, Tondiarpet, Chennai - 600081, Tamil Nadu, India",
    contact: "Contact: +91 9840952253  ·  E-Mail: fittings@smbfittingindustry.com",
  },
  metadata: {
    client: "RELIANCE INDUSTRIES LIMITED", workOrder: "5375/1,4,6,8,11,14,29,30",
    certificate: "", date: "27.05.2026", po: "362/241067222", poDate: "06.04.2026",
    authorityCertificate: "8121029213/624", authorityDate: "27.05.2026",
    regulation: "Certificate of Manufacturing and test Boiler Mounting and fitting regulation 4(g) of Indian Boiler Regulation 1950.",
  },
  items: itemRows,
  specs: [
    "As above",
    "(1) 32Kg/cm²  (4,29) 55Kg/cm²  (6) 40Kg/cm²  (8,11,30) 118Kg/cm²  (14) 51Kg/cm²",
    "400°C", "NOT APPLICABLE", "ASME B16.9", "TPI/IBR/PF/001.",
    "(1) CT0754 IBR TPZ 4238  (4,29) CT0832 HF  (6) CT0778 TPZ 4238  (8,11,30) CT0844 TPZ 4231  (14) CT0804 TPZ 4231",
    "(1) MSL-14/IBR/2414/1/2023, (4,29) MSL-7/IBR/0284/2/2025 (6) MSL-14/IBR/510/1/2024 (8,11,30) MSL-7/IBR/1344/3/2025 (14) US-2024/IBR/02/0325",
  ],
  heatTreatment: "(1,6,8,11,14,30) NORMALIZED AT 910°C  (4,29) HF- Hot Formed (Temp. 620°C to 980°C)",
  chemistry: chemistryRows,
  rawMaterials,
  compliance: "The Part has been designed and constructed to comply with Indian Boiler Regulations 1950 for a maximum working pressure of [as mentioned above] and maximum temperature of [as mentioned above] in the presence of our responsible representative whose signature is appended here under - finally inspected on [date]. *Hydro test will be carried out at site",
  declaration: "We have satisfied ourselves and the valve / fittings has been constructed and tested in accordance with the requirements of the Indian Boiler Regulations, 1950. We further certify that the particulars entered here are correct.",
  signature: { name: "YUSUF", title: "QC INCHARGE" },
  inspection: { person: "BHARATKUMAR PARMAR", authorization: "IBR-I / AUTHORIZATION NO.: 110/20", date: "27.05.2026" },
  footer: {
    place: "CHENNAI", date: "27.05.2026",
    contactName: "Yusuf", phone: "+91 9840952253",
    address: "New No. 404/406, Thiruvottiyur High Road, Tondiarpet, Chennai - 600081, Tamil Nadu, India",
    email: "fittings@smbfittingindustry.com",
  },
  images: { logo: null, badge1: null, badge2: null, badge3: null, companyStamp: null, inspectionStamp: null, signature: null },
};

function freshDraft(): CertificateDraft {
  return JSON.parse(JSON.stringify(initialDraft)) as CertificateDraft;
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Field({ value, onChange, className = "", area = false, label }: {
  value: string; onChange: (value: string) => void; className?: string; area?: boolean; label?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (area && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value, area]);
  
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
    if (area && e.target instanceof HTMLTextAreaElement) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  };
  
  const shared = { value, onChange: handleChange, "aria-label": label };
  return area
    ? <textarea ref={textareaRef} {...shared} className={`certificate-input certificate-area ${className}`} />
    : <input {...shared} className={`certificate-input ${className}`} />;
}

function ImageSlot({ src, label, onUpload, onRemove, compact = false }: {
  src: string | null; label: string; onUpload?: (event: ChangeEvent<HTMLInputElement>) => void; onRemove?: () => void; compact?: boolean;
}) {
  return (
    <div className={`image-slot ${compact ? "image-slot-compact" : ""}`}>
      {src ? <img src={src} alt={label} /> : <span>{label}</span>}
      {onUpload && <input type="file" accept="image/*" onChange={onUpload} aria-label={`Upload ${label}`} />}
      {src && onRemove && <button type="button" onClick={onRemove}>Remove</button>}
    </div>
  );
}

function LabelledRow({ number, label, children }: { number: string; label: string; children: ReactNode }) {
  return (
    <div className="spec-row">
      <div className="spec-number">{number}</div>
      <div className="spec-label">{label}</div>
      <div className="spec-value">{children}</div>
    </div>
  );
}

function UploadPanel({ images, upload, remove }: {
  images: Images;
  upload: (key: keyof Images) => (e: ChangeEvent<HTMLInputElement>) => void;
  remove: (key: keyof Images) => void;
}) {
  const slots: { key: keyof Images; label: string }[] = [
    { key: "logo", label: "Company Logo" },
    { key: "badge1", label: "Certification Badge 1" },
    { key: "badge2", label: "Certification Badge 2" },
    { key: "badge3", label: "Certification Badge 3" },
    { key: "companyStamp", label: "Company Stamp" },
    { key: "inspectionStamp", label: "Inspection Authority Stamp" },
  ];
  return (
    <aside className="upload-panel print-hidden">
      <div className="panel-kicker">Certificate assets</div>
      <h2>Upload settings</h2>
      <p>Images are stored as base64 inside the certificate record. Keep files under ~500 KB each.</p>
      <div className="upload-grid">
        {slots.map((slot) => (
          <div key={slot.key} className="upload-card">
            <ImageSlot src={images[slot.key]} label={slot.label} onUpload={upload(slot.key)} onRemove={() => remove(slot.key)} />
            <strong>{slot.label}</strong>
            <small>{images[slot.key] ? "Ready to preview" : "PNG, JPG, or WEBP"}</small>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CertificateLibrary({
  certificates, activeId, onSelect, onCreate, onDuplicate, onDelete,
  isLoading, isError,
}: {
  certificates: CertificateRecord[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <section className="certificate-library print-hidden">
      <div className="library-header-row">
        <div>
          <p className="panel-kicker">Workspace</p>
          <h2>Certificates</h2>
        </div>
        <button type="button" className="new-certificate" onClick={onCreate} title="Create blank certificate draft">
          + New
        </button>
      </div>

      <div className="certificate-list">
        {isLoading && (
          <div className="library-status">
            <span className="library-spinner" aria-label="Loading certificates" />
            <span>Loading certificates…</span>
          </div>
        )}
        {isError && !isLoading && (
          <div className="library-status library-error">
            Failed to load certificates. Check Supabase connection.
          </div>
        )}
        {!isLoading && certificates.map((certificate, index) => {
          const isActive = certificate.id === activeId;
          const isDraft = certificate.id.startsWith("draft-");
          const title = certificate.draft.metadata.certificate || certificate.draft.metadata.client || "Untitled certificate";
          const subtitle = `${certificate.draft.metadata.date || "No date"} · ${certificate.draft.items.length} item${certificate.draft.items.length === 1 ? "" : "s"}`;

          return (
            <div key={certificate.id} className={`certificate-card ${isActive ? "active" : ""}`}>
              <div
                className="certificate-card-main"
                onClick={() => onSelect(certificate.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onSelect(certificate.id)}
              >
                <div className="card-top-line">
                  <span className="card-index">Form III C · {String(index + 1).padStart(2, "0")}</span>
                  <span className={`status-pill ${isDraft ? "pill-draft" : "pill-saved"}`}>
                    {isDraft ? "Draft" : "Saved"}
                  </span>
                </div>
                <strong className="card-title" title={title}>{title}</strong>
                <small className="card-subtitle">{subtitle}</small>
              </div>

              <div className="certificate-card-actions">
                <button
                  type="button"
                  className={`card-action-btn edit-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => onSelect(certificate.id)}
                  title="Edit this certificate"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  {isActive ? "Editing" : "Edit"}
                </button>

                <button
                  type="button"
                  className="card-action-btn duplicate-btn"
                  onClick={() => onDuplicate(certificate.id)}
                  title="Duplicate as new draft"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Duplicate
                </button>

                <button
                  type="button"
                  className="card-action-btn delete-btn"
                  onClick={() => onDelete(certificate.id)}
                  title="Delete this certificate"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
        {!isLoading && certificates.length === 0 && (
          <div className="library-status library-empty">
            No certificates yet. Click &quot;+ New&quot; to start.
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────

type ToastState = { message: string; kind: "success" | "error" } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, toast.kind === "success" ? 3000 : 6000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind} print-hidden`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">×</button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CertificateBuilder() {
  // Start empty — populated after Supabase query resolves.
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [activeCertificateId, setActiveCertificateId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const signatureInput = useRef<HTMLInputElement>(null);
  const hasHydrated = useRef(false);
  const queryClient = useQueryClient();



  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
    });
  }, []);

  // ── Query: load certificate list from Supabase ───────────────────────────
  const certificatesQuery = useQuery({ queryKey: ["certificates"], queryFn: listCertificates });

  // ── Shared company assets (logo, badges, stamps) — local-first so they show up
  // instantly on every certificate, including brand-new drafts, regardless of whether
  // the optional Supabase `company_assets` table has been migrated yet. ──
  const [companyImages, setCompanyImages] = useState<CompanyImages>(emptyCompanyImages);
  const hasSeededCompanyImages = useRef(false);

  const persistCompanyImages = useCallback((next: CompanyImages) => {
    setCompanyImages(next);
    writeLocalCompanyAssets(next);
    saveRemoteCompanyAssets(next);
  }, []);

  // Read localStorage after mount, not during the initial render — localStorage isn't
  // available during SSR, and reading it synchronously in useState's initializer would
  // make the client's first render diverge from the server-rendered HTML (hydration error).
  useEffect(() => {
    setCompanyImages(readLocalCompanyAssets());
  }, []);

  // Pull in the remote copy once (if the table exists), filling in only keys we
  // don't already have locally so an upload made on another device is picked up.
  useEffect(() => {
    getRemoteCompanyAssets().then((remote) => {
      if (!remote) return;
      setCompanyImages((current) => {
        const merged = { ...current };
        let changed = false;
        sharedImageKeys.forEach((key) => {
          if (remote[key] && !current[key]) { merged[key] = remote[key]; changed = true; }
        });
        if (changed) writeLocalCompanyAssets(merged);
        return changed ? merged : current;
      });
    });
  }, []);

  // One-time migration: if nothing shared is stored yet, adopt whatever any existing
  // certificate already had uploaded per-certificate (pre-fix data) as the shared baseline.
  useEffect(() => {
    if (hasSeededCompanyImages.current || certificates.length === 0) return;
    hasSeededCompanyImages.current = true;
    if (sharedImageKeys.some((key) => companyImages[key])) return;
    const seeded: CompanyImages = { ...emptyCompanyImages };
    let found = false;
    sharedImageKeys.forEach((key) => {
      const source = certificates.find((c) => c.draft.images[key]);
      if (source) { seeded[key] = source.draft.images[key]; found = true; }
    });
    if (found) persistCompanyImages(seeded);
  }, [certificates, companyImages, persistCompanyImages]);

  // Hydrate local state once Supabase data arrives (runs only once per session).
  useEffect(() => {
    if (!certificatesQuery.data || hasHydrated.current) return;
    hasHydrated.current = true;

    if (certificatesQuery.data.length === 0) {
      // No saved certificates → seed one local draft so the user has something to work on.
      const id = `draft-${Date.now()}`;
      setCertificates([{ id, draft: freshDraft() }]);
      setActiveCertificateId(id);
    } else {
      const records = certificatesQuery.data.map((c) => ({
        id: c.id,
        draft: {
          ...c.payload,
          footer: { ...initialDraft.footer, ...c.payload.footer },
          rawMaterials: c.payload.rawMaterials.map((block) => ({
            ...block,
            values: rawLabels.map((_, i) => block.values[i] ?? ""),
          })),
        },
        savedAt: c.updated_at,
      }));
      setCertificates(records);
      setActiveCertificateId(records[0].id);
    }
  }, [certificatesQuery.data]);

  // ── Active draft helpers ──────────────────────────────────────────────────
  const draft = certificates.find((c) => c.id === activeCertificateId)?.draft ?? freshDraft();

  const setDraft = useCallback(
    (updater: (current: CertificateDraft) => CertificateDraft) =>
      setCertificates((current) =>
        current.map((c) => (c.id === activeCertificateId ? { ...c, draft: updater(c.draft) } : c))
      ),
    [activeCertificateId]
  );

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CertificateDraft }) =>
      id.startsWith("draft-") ? createStoredCertificate(payload) : updateCertificate(id, payload),
    onSuccess: (saved, variables) => {
      const nextRecord: CertificateRecord = { id: saved.id, draft: saved.payload, savedAt: saved.updated_at };
      setCertificates((current) => current.map((c) => (c.id === variables.id ? nextRecord : c)));
      setActiveCertificateId(saved.id);
      queryClient.setQueryData<StoredCertificate[]>(["certificates"], (current = []) => [
        saved,
        ...current.filter((c) => c.id !== saved.id),
      ]);
      setToast({ message: "Certificate saved successfully!", kind: "success" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      setToast({ message: `Save failed — ${message}. Check your Supabase schema and policy.`, kind: "error" });
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteStoredCertificate(id),
    onSuccess: (_, deletedId) => {
      const remaining = certificates.filter((c) => c.id !== deletedId);
      setCertificates(remaining);
      queryClient.setQueryData<StoredCertificate[]>(["certificates"], (current = []) =>
        current.filter((c) => c.id !== deletedId)
      );
      // If we deleted the active one, select the next available or create a fresh local draft.
      if (activeCertificateId === deletedId) {
        if (remaining.length > 0) {
          setActiveCertificateId(remaining[0].id);
        } else {
          const id = `draft-${Date.now()}`;
          setCertificates([{ id, draft: freshDraft() }]);
          setActiveCertificateId(id);
        }
      }
      setToast({ message: "Certificate deleted.", kind: "success" });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      setToast({ message: `Delete failed — ${message}`, kind: "error" });
    },
  });

  // ── Certificate library actions ───────────────────────────────────────────
  const createCertificate = () => {
    const id = `draft-${Date.now()}`;
    setCertificates((current) => [{ id, draft: freshDraft() }, ...current]);
    setActiveCertificateId(id);
  };

  const duplicateCertificate = (id: string) => {
    const source = certificates.find((c) => c.id === id);
    if (!source) return;
    const clonedDraft: CertificateDraft = JSON.parse(JSON.stringify(source.draft));
    if (clonedDraft.metadata.certificate) {
      clonedDraft.metadata.certificate = `${clonedDraft.metadata.certificate} (Copy)`;
    }
    const newId = `draft-${Date.now()}`;
    setCertificates((current) => [{ id: newId, draft: clonedDraft }, ...current]);
    setActiveCertificateId(newId);
    setToast({ message: "Certificate duplicated as a new draft. Edit and save whenever ready.", kind: "success" });
  };

  const handleDelete = (id: string) => {
    const cert = certificates.find((c) => c.id === id);
    const title = cert?.draft.metadata.certificate || cert?.draft.metadata.client || "this certificate";
    if (typeof window !== "undefined" && !window.confirm(`Are you sure you want to delete "${title}"?`)) {
      return;
    }
    if (id.startsWith("draft-")) {
      // Local-only draft — just remove from state.
      const remaining = certificates.filter((c) => c.id !== id);
      setCertificates(remaining);
      if (activeCertificateId === id) {
        if (remaining.length > 0) setActiveCertificateId(remaining[0].id);
        else { const newId = `draft-${Date.now()}`; setCertificates([{ id: newId, draft: freshDraft() }]); setActiveCertificateId(newId); }
      }
      setToast({ message: "Draft removed.", kind: "success" });
    } else {
      deleteMutation.mutate(id);
    }
  };

  const saveActiveCertificate = () => saveMutation.mutate({ id: activeCertificateId, payload: draft });

  // ── Draft field setters ───────────────────────────────────────────────────
  const setValue = <K extends keyof CertificateDraft>(key: K, value: CertificateDraft[K]) =>
    setDraft((c) => ({ ...c, [key]: value }));
  const setCompany = (key: keyof CertificateDraft["company"], value: string) =>
    setDraft((c) => ({ ...c, company: { ...c.company, [key]: value } }));
  const setMeta = (key: keyof CertificateDraft["metadata"], value: string) =>
    setDraft((c) => ({ ...c, metadata: { ...c.metadata, [key]: value } }));

  const upload = (key: keyof Images) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      if (isSharedImageKey(key)) {
        persistCompanyImages({ ...companyImages, [key]: result });
        setToast({ message: "Company image updated for every certificate.", kind: "success" });
        return;
      }
      setDraft((c) => {
        const updated = { ...c, images: { ...c.images, [key]: result } };
        saveMutation.mutate({ id: activeCertificateId, payload: updated });
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };
  const remove = (key: keyof Images) => {
    if (isSharedImageKey(key)) {
      persistCompanyImages({ ...companyImages, [key]: null });
      setToast({ message: "Company image removed for every certificate.", kind: "success" });
      return;
    }
    setDraft((c) => {
      const updated = { ...c, images: { ...c.images, [key]: null } };
      saveMutation.mutate({ id: activeCertificateId, payload: updated });
      return updated;
    });
  };

  // Shared company images always win over whatever a certificate draft happens to hold.
  const mergedImages: Images = { ...draft.images };
  sharedImageKeys.forEach((key) => {
    if (companyImages[key]) mergedImages[key] = companyImages[key];
  });

  const updateItem  = (index: number, key: keyof Item, value: string) =>
    setValue("items", draft.items.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const updateChem  = (index: number, key: keyof Chemistry, value: string) =>
    setValue("chemistry", draft.chemistry.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  const updateRaw   = (index: number, field: number, value: string) =>
    setValue("rawMaterials", draft.rawMaterials.map((block, i) =>
      i === index ? { ...block, values: block.values.map((entry, j) => (j === field ? value : entry)) } : block
    ));
  const updateRawId = (index: number, newId: string) =>
    setValue("rawMaterials", draft.rawMaterials.map((block, i) =>
      i === index ? { ...block, id: newId } : block
    ));
  const addItem    = () =>
    setValue("items", [...draft.items, { wo: "", sr: String(draft.items.length + 1), description: "", size: "", sch: "", id: "", ht: "", qty: "" }]);
  const removeItem = (index: number) =>
    setValue("items", draft.items.filter((_, rowIndex) => rowIndex !== index));

  const addChemistry = () =>
    setValue("chemistry", [...draft.chemistry, { id: "", c: "", cr: "", ni: "", mo: "", mn: "", p: "", s: "", si: "", v: "", cu: "", ce: "", ys: "", uts: "", gl: "", el: "", bend: "", flat: "" }]);
  const removeChemistry = (index: number) =>
    setValue("chemistry", draft.chemistry.filter((_, rowIndex) => rowIndex !== index));

  const addRawMaterial = () =>
    setValue("rawMaterials", [...draft.rawMaterials, { id: "", values: rawLabels.map(() => "") }]);
  const removeRawMaterial = (index: number) =>
    setValue("rawMaterials", draft.rawMaterials.filter((_, rowIndex) => rowIndex !== index));

  // ── Labels / config ───────────────────────────────────────────────────────
  const metaLeft:  [keyof CertificateDraft["metadata"], string][] = [["client", "Client"], ["workOrder", "Wo.No/Sr.No."], ["certificate", "Certificate No."], ["date", "DATE"]];
  const metaRight: [keyof CertificateDraft["metadata"], string][] = [["po", "PO NO."], ["poDate", "PO DATE"], ["authorityCertificate", "Inspection Authority's Certificate No."], ["authorityDate", "DATE"]];

  const specLabels = [
    "Maker's Name and Address", "Intended Working Pressure", "Intended Working Temperature",
    "Hydraulic Test Pressure", "Main Dimensions", "Drawing No.", "Identification mark",
    "Chemical & Physical Test Certi. No.",
  ];
  const chemKeys: (keyof Chemistry)[] = ["id", "c", "cr", "ni", "mo", "mn", "p", "s", "si", "v", "cu", "ce", "ys", "uts", "gl", "el", "bend", "flat"];
  const chemHeads = ["ID No.", "C%", "Cr%", "Ni%", "Mo%", "Mn%", "P%", "S%", "Si%", "V%", "Cu%", "CE%", "YS (MPa)", "UTS (MPa)", "GL (mm)", "EL%", "Bend Test", "Flat Test"];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="app-shell">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* Header bar */}
      <div className="workspace-intro print-hidden">
        <div>
          <p className="eyebrow">SMB FITTINGS / IBR DOCUMENT CONTROL</p>
          <h1>Manufacturing certificate</h1>
          <span>
            {certificatesQuery.isLoading
              ? "Loading certificate library…"
              : `${certificates.length} certificate${certificates.length === 1 ? "" : "s"} in this workspace`}
          </span>
        </div>
        <div className="workspace-actions">
          {userEmail && <span className="user-badge" title="Logged in admin">{userEmail}</span>}
          <div className="format-switch">
            <button
              type="button"
              onClick={() => setDraft((c) => ({ ...c, format: 'full' }))}
              className={`format-switch-btn ${draft.format !== 'minimal' ? 'active' : ''}`}
            >
              Plain Format
            </button>
            <button
              type="button"
              onClick={() => setDraft((c) => ({ ...c, format: 'minimal' }))}
              className={`format-switch-btn ${draft.format === 'minimal' ? 'active' : ''}`}
            >
              Letterhead Format
            </button>
          </div>
          <button
            type="button"
            onClick={saveActiveCertificate}
            className="save-button"
            disabled={saveMutation.isPending || certificatesQuery.isLoading}
          >
            {saveMutation.isPending ? "Saving…" : "Save certificate"}
          </button>
          <button type="button" onClick={() => window.print()} className="print-button">
            Print certificate
          </button>
          <form action={signOutAction} className="signout-form">
            <button type="submit" className="signout-button" title="Sign out of Admin Portal">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {/* Workspace */}
      <div className="workspace">
        <div className="left-rail">
          <CertificateLibrary
            certificates={certificates}
            activeId={activeCertificateId}
            onSelect={setActiveCertificateId}
            onCreate={createCertificate}
            onDuplicate={duplicateCertificate}
            onDelete={handleDelete}
            isLoading={certificatesQuery.isLoading}
            isError={certificatesQuery.isError}
          />
          <UploadPanel images={mergedImages} upload={upload} remove={remove} />
        </div>

        <section className="preview-wrap">
          <article className={`certificate-sheet ${draft.format === 'minimal' ? 'minimal-format' : ''}`}>
            {draft.format === 'minimal' && <div className="letterhead-guide print-hidden" aria-hidden="true">Letterhead area — kept blank</div>}

            {/* Watermark logo for full format */}
            {draft.format !== 'minimal' && mergedImages.logo && (
              <div className="watermark-logo">
                <img src={mergedImages.logo} alt="Watermark" />
              </div>
            )}

            {/* Certificate header - only in full format */}
            {draft.format !== 'minimal' && (
              <>
                <header className="certificate-header">
                  <ImageSlot src={mergedImages.logo} label="SMB" compact />
                  {/* Fixed wordmark, not editable: it is the company's mark, not
                      certificate data. Two-tone like the letterhead. */}
                  <div className="company-name">
                    <span className="company-name-mark">SMB</span>
                    <span className="company-name-rest">Fitting Industry</span>
                  </div>
                  <div className="badges">
                    <ImageSlot src={mergedImages.badge1} label="ISO"  compact />
                    <ImageSlot src={mergedImages.badge2} label="QMS"  compact />
                    <ImageSlot src={mergedImages.badge3} label="PESO" compact />
                  </div>
                </header>

                <div className="rule" />

                <div className="company-block">
                  <Field value={draft.company.address} onChange={(v) => setCompany("address", v)} className="centered-line" label="Company address" />
                  <Field value={draft.company.contact} onChange={(v) => setCompany("contact", v)} className="centered-line" label="Company contact" />
                </div>
              </>
            )}

            <h2 className="form-title">FORM III C</h2>

            {/* Metadata table */}
            <section className="metadata-table">
              <div>
                {metaLeft.map(([key, label]) => (
                  <div className="meta-row" key={key}>
                    <b>{label}</b>
                    <Field value={draft.metadata[key]} onChange={(v) => setMeta(key, v)} label={label} />
                  </div>
                ))}
              </div>
              <div>
                {metaRight.map(([key, label]) => (
                  <div className="meta-row" key={key}>
                    <b>{label}</b>
                    <Field value={draft.metadata[key]} onChange={(v) => setMeta(key, v)} label={label} />
                  </div>
                ))}
              </div>
              <div className="meta-regulation">
                <Field value={draft.metadata.regulation} onChange={(v) => setMeta("regulation", v)} label="Certificate regulation" />
              </div>
            </section>

            {/* Items */}
            <section className="item-section">
              <div className="item-caption">
                <button type="button" className="add-item print-hidden" onClick={addItem}>+ Add item</button>
              </div>
              <div className="item-table-wrap">
                <table className="certificate-table item-table">
                  <thead>
                    <tr>
                      <th className="part-header" />
                      <th>Wo.No.</th><th>Sr.No.</th><th>Item Description</th>
                      <th>SIZE</th><th>SCH / THK.</th><th>ID No.</th><th>HT No.</th><th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((item, index) => (
                      <tr key={index}>
                        {index === 0 && <th rowSpan={draft.items.length} className="part-label">{draft.items.length <= 2 ? 'N/P' : 'Name of Part'}</th>}
                        <td><Field value={item.wo}          onChange={(v) => updateItem(index, "wo", v)} /></td>
                        <td><Field value={item.sr}          onChange={(v) => updateItem(index, "sr", v)} /></td>
                        <td className="description-cell">
                          <Field area value={item.description} onChange={(v) => updateItem(index, "description", v)} />
                          <button type="button" onClick={() => removeItem(index)} className="remove-item print-hidden" aria-label={`Remove item ${index + 1}`}>×</button>
                        </td>
                        <td><Field value={item.size} onChange={(v) => updateItem(index, "size", v)} /></td>
                        <td><Field value={item.sch}  onChange={(v) => updateItem(index, "sch", v)} /></td>
                        <td><Field value={item.id}   onChange={(v) => updateItem(index, "id", v)} /></td>
                        <td><Field value={item.ht}   onChange={(v) => updateItem(index, "ht", v)} /></td>
                        <td><Field value={item.qty}  onChange={(v) => updateItem(index, "qty", v)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Spec list */}
            <section className="spec-list">
              {specLabels.map((label, index) => (
                <LabelledRow key={label} number={String(index + 2)} label={label}>
                  <Field
                    area={index > 5}
                    value={draft.specs[index]}
                    onChange={(v) => setValue("specs", draft.specs.map((entry, i) => (i === index ? v : entry)))}
                    label={label}
                  />
                </LabelledRow>
              ))}
            </section>

            {/* Heat treatment + chemistry */}
            <section>
              <LabelledRow number="10" label="Heat Treatment">
                <Field value={draft.heatTreatment} onChange={(v) => setValue("heatTreatment", v)} label="Heat Treatment" />
              </LabelledRow>
              <div className="chemistry-wrap">
                <div className="item-caption">
                  <button type="button" className="add-item print-hidden" onClick={addChemistry}>+ Add chemistry row</button>
                </div>
                <table className="certificate-table chemistry-table">
                  <thead>
                    <tr>
                      {chemHeads.map((head) => <th key={head}>{head}</th>)}
                      <th className="print-hidden" style={{ width: '30px' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.chemistry.map((row, i) => (
                      <tr key={i}>
                        {chemKeys.map((key) => (
                          <td key={key}>
                            <Field value={row[key]} onChange={(v) => updateChem(i, key, v)} label={`${row.id} ${key}`} />
                          </td>
                        ))}
                        <td className="print-hidden" style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                          <button 
                            type="button" 
                            onClick={() => removeChemistry(i)} 
                            className="remove-item print-hidden" 
                            aria-label={`Remove chemistry row ${i + 1}`}
                            style={{ position: 'static', margin: '0 auto' }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Raw materials */}
            <section className="raw-section">
              <div className="section-number">11.</div>
              <div className="raw-content">
                <div className="raw-heading">Raw Material</div>
                <div className="item-caption">
                  <button type="button" className="add-item print-hidden" onClick={addRawMaterial}>+ Add raw material</button>
                </div>
                <div className="raw-grid">
                  {draft.rawMaterials.map((block, i) => (
                    <div 
                      className="raw-block" 
                      key={i}
                      style={{
                        gridColumn: (i + 1) % 2 === 1 && i === draft.rawMaterials.length - 1 ? '1 / -1' : 'auto'
                      }}
                    >
                      <div className="raw-id">
                        <span>ID No. </span>
                        <Field 
                          value={block.id} 
                          onChange={(v) => updateRawId(i, v)} 
                          label={`Raw material ${i + 1} ID`}
                          className="raw-id-input"
                        />
                        <button 
                          type="button" 
                          onClick={() => removeRawMaterial(i)} 
                          className="remove-item print-hidden" 
                          aria-label={`Remove raw material ${i + 1}`} 
                          style={{ position: 'static', marginLeft: '8px', flexShrink: 0 }}
                        >
                          ×
                        </button>
                      </div>
                      {rawLabels.map((label, j) => (
                        <div className="raw-row" key={label}>
                          <b>{label}</b>
                          <Field value={block.values[j]} onChange={(v) => updateRaw(i, j, v)} label={`${block.id} ${label}`} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Compliance */}
            <section className="compliance">
              <div className="compliance-number">12.</div>
              <div>
                <Field area value={draft.compliance} onChange={(v) => setValue("compliance", v)} label="Compliance paragraph" />
              </div>
            </section>

            {/* Signature section - full detail restored only for the full format;
                minimal (letterhead) format keeps the compact sign-off. */}
            <section className="signature-section">
              {draft.format === 'minimal' ? (
                <>
                  <Field value={draft.signature.title} onChange={(v) => setValue("signature", { ...draft.signature, title: v })} className="sign-title" />
                  <div className="declaration">
                    <Field area value={draft.declaration} onChange={(v) => setValue("declaration", v)} label="Declaration" />
                  </div>
                </>
              ) : (
                <>
                  <div className="signature-person">
                    <div
                      className="signature-pad"
                      onClick={() => signatureInput.current?.click()}
                      role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && signatureInput.current?.click()}
                    >
                      {draft.images.signature && <img src={draft.images.signature} alt="Signature" />}
                      <input ref={signatureInput} className="hidden-input" type="file" accept="image/*" onChange={upload("signature")} />
                    </div>
                    {draft.images.signature && (
                      <button type="button" className="signature-remove print-hidden" onClick={() => remove("signature")}>Remove signature</button>
                    )}
                    <Field value={draft.signature.title} onChange={(v) => setValue("signature", { ...draft.signature, title: v })} className="sign-title" />
                  </div>
                  <div className="declaration">
                    <Field area value={draft.declaration} onChange={(v) => setValue("declaration", v)} label="Declaration" />
                  </div>
                  <div className="stamp-group">
                    <ImageSlot src={mergedImages.companyStamp} label="" compact />
                  </div>
                  <div className="inspection-group">
                    <ImageSlot src={mergedImages.inspectionStamp} label="" compact />
                  </div>
                </>
              )}
            </section>

            {/* Footer - different for each format */}
            {draft.format === 'minimal' ? (
              <div className="minimal-footer">
                <div className="minimal-footer-left">
                  <div className="minimal-footer-row">
                    <span className="minimal-footer-label">PLACE:-</span>
                    <Field value={draft.footer.place} onChange={(v) => setValue("footer", { ...draft.footer, place: v })} className="minimal-footer-input" />
                  </div>
                  <div className="minimal-footer-row">
                    <span className="minimal-footer-label">DATE:-</span>
                    <Field value={draft.footer.date} onChange={(v) => setValue("footer", { ...draft.footer, date: v })} className="minimal-footer-input" />
                  </div>
                </div>
                <div className="minimal-footer-right">
                  <span className="page-count">Page 1 of 1</span>
                </div>
              </div>
            ) : (
              <div className="certificate-footer">
                <div className="footer-place">
                  <span>PLACE:-</span>
                  <Field value={draft.footer.place} onChange={(v) => setValue("footer", { ...draft.footer, place: v })} />
                  <span>DATE:-</span>
                  <Field value={draft.footer.date}  onChange={(v) => setValue("footer", { ...draft.footer, date: v })} />
                </div>
                <span className="page-count">Page 1 of 1</span>
              </div>
            )}

          </article>
        </section>
      </div>
    </main>
  );
}
