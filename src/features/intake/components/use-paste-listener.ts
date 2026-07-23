import { useEffect } from "react";

export function usePasteListener(configured: boolean, processFile: (file: File) => Promise<void>) {
  useEffect(() => {
    if (!configured) return;
    function paste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) void processFile(file);
    }
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [configured, processFile]);
}
