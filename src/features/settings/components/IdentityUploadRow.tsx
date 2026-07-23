import { useRef } from "react";

import { Button } from "@/components/ui/Button";

export function IdentityUploadRow({
  hasReference,
  busy,
  disabled,
  onUpload,
}: {
  hasReference: boolean;
  busy: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
}) {
  const fileInput = useRef<HTMLInputElement | null>(null);
  return (
    <div className="toggle-row toggle-row--identity-upload">
      <span>
        <strong>Identity reference photo</strong>
        <small>
          {hasReference
            ? "A private reference photo is on file. Upload a new one to replace it."
            : "Required before modeled preview consent can be enabled."}
        </small>
      </span>
      <Button disabled={disabled || busy} onClick={() => fileInput.current?.click()} type="button">
        {busy ? "Uploading…" : hasReference ? "Replace photo" : "Upload photo"}
      </Button>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
        ref={fileInput}
        type="file"
      />
    </div>
  );
}
