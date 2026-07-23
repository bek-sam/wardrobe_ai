import Link from "next/link";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

import { IdentityUploadRow } from "./IdentityUploadRow";
import { ModeledPreviewToggle } from "./ModeledPreviewToggle";
import { PrivacyStaticToggles } from "./PrivacyStaticToggles";
import type { PrivacySectionProps } from "./settings.types";

export function PrivacySection({
  identityReferencePath,
  modeledPreviewConsent,
  previewConsentBusy,
  disabled,
  onToggleConsent,
  onUpload,
}: PrivacySectionProps) {
  return (
    <Card as="section" className="settings-section" id="settings-privacy">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">AI & privacy</p>
          <h2>Your controls</h2>
          <p>Sensitive or expensive capabilities are always opt-in.</p>
        </div>
        <Badge tone="outline">Partially stored</Badge>
      </div>
      <div className="toggle-list">
        <PrivacyStaticToggles />
        <ModeledPreviewToggle
          checked={modeledPreviewConsent}
          disabled={disabled || previewConsentBusy}
          hasReference={Boolean(identityReferencePath)}
          onToggle={onToggleConsent}
        />
        <IdentityUploadRow
          busy={previewConsentBusy}
          disabled={disabled}
          hasReference={Boolean(identityReferencePath)}
          onUpload={onUpload}
        />
      </div>
      <div className="settings-form-actions">
        <Link href="/privacy">Read the privacy policy</Link>
      </div>
    </Card>
  );
}
