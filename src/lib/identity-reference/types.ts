import type { ValidatedImage } from "@/lib/image/validation";
import type { IdentityReferenceAssessment } from "@/lib/visualization";

export type NormalizedIdentityUpload = ValidatedImage & { sha256: string };

export type IdentityReferenceRow = {
  id: string;
  storage_path: string;
  width: number;
  height: number;
  validation_status: "pending" | "pass" | "warn" | "fail";
  validation_summary: IdentityReferenceAssessment | Record<string, never>;
  created_at: string;
};

export type ActiveIdentityReference = {
  id: string;
  bucketId: string;
  storagePath: string;
  sha256: string;
  consentVersion: string;
};
