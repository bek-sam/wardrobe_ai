import { exportAccountData } from "./export-data";
import type { Notice } from "./settings.types";

export function useExportData(
  setBusy: (value: string | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  return async function exportData() {
    setBusy("export");
    setNotice(null);
    try {
      await exportAccountData();
      setNotice({ tone: "success", message: "Your private data export was downloaded." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Your export could not be prepared.",
      });
    } finally {
      setBusy(null);
    }
  };
}
