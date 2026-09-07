export type Images = { logo: string | null; badge1: string | null; badge2: string | null; badge3: string | null; companyStamp: string | null; inspectionStamp: string | null; signature: string | null };
export type Item = { wo: string; sr: string; description: string; size: string; sch: string; id: string; ht: string; qty: string };
export type Chemistry = { id: string; c: string; cr: string; ni: string; mo: string; mn: string; p: string; s: string; si: string; v: string; cu: string; ce: string; ys: string; uts: string; gl: string; el: string; bend: string; flat: string };
export type RawMaterial = { id: string; values: string[] };
export type CertificateDraft = {
  company: { name: string; address: string; contact: string };
  metadata: { client: string; workOrder: string; certificate: string; date: string; po: string; poDate: string; authorityCertificate: string; authorityDate: string; regulation: string };
  items: Item[]; specs: string[]; heatTreatment: string; chemistry: Chemistry[]; rawMaterials: RawMaterial[];
  compliance: string; declaration: string; signature: { name: string; title: string }; inspection: { person: string; authorization: string; date: string }; footer: { place: string; date: string; contactName: string; phone: string; address: string; email: string }; images: Images;
  format?: 'full' | 'minimal'; // Format toggle: 'full' includes header/footer, 'minimal' has watermark only
};
