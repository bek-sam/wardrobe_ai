import { useState } from "react";

import { useDeleteAccount } from "./use-delete-account";
import { useExportData } from "./use-export-data";
import type { Notice, Profile } from "./settings.types";

export function useDataOwnership(
  profile: Profile | null,
  setBusy: (value: string | null) => void,
  setNotice: (notice: Notice | null) => void,
) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const exportData = useExportData(setBusy, setNotice);
  const deletion = useDeleteAccount({
    profile,
    deletePhrase,
    deletePassword,
    setDeletePassword,
    setBusy,
    setNotice,
  });

  return {
    deleteOpen,
    setDeleteOpen,
    deletePhrase,
    setDeletePhrase,
    deletePassword,
    setDeletePassword,
    exportData,
    ...deletion,
  };
}
