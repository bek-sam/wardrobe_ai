"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/Button";

import { PHOTO_GUIDANCE } from "./photo-guidance.data";

type Props = { busy: boolean; onUpload: (file: File) => void };

export function IdentityUploadStep({ busy, onUpload }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="identity-step">
      <h3>Add a reference photo</h3>
      <p className="identity-step__lead">
        The try-on needs one photo of you so the generated image is recognizably you rather than a
        stock model.
      </p>
      <ul className="identity-step__guidance">
        {PHOTO_GUIDANCE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <Button disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Checking your photo…" : "Choose a photo"}
      </Button>
    </div>
  );
}
