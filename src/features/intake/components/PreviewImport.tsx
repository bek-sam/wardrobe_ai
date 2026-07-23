import { Camera, ImageSquare, UploadSimple } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";

import { ImportSteps } from "./ImportSteps";
import { PreviewCandidateGrid } from "./PreviewCandidateGrid";

export function PreviewImport() {
  return (
    <>
      <DemoNotice>
        This is an explicitly labeled workflow preview because Supabase is not configured. Connect
        Supabase to upload private images and create resumable import jobs.
      </DemoNotice>
      <ImportSteps current={1} />
      <section className="upload-zone" aria-labelledby="preview-upload-title">
        <div className="upload-zone__icon">
          <UploadSimple size={31} weight="light" />
        </div>
        <h2 id="preview-upload-title">Drop clothing photos here</h2>
        <p>JPG, PNG, or WebP up to 20 MB. Upload is disabled in preview mode.</p>
        <div>
          <Button disabled>
            <ImageSquare size={16} /> Choose photo
          </Button>
          <Button disabled variant="secondary">
            <Camera size={16} /> Use camera
          </Button>
        </div>
      </section>
      <PreviewCandidateGrid />
    </>
  );
}
