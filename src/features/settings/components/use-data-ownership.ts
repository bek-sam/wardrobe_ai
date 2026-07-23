import { useState } from "react";

import {
  confirmAccountDeletion,
  deleteAccountErrorNotice,
  deleteAccountRequest,
} from "./delete-account";
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

  async function deleteAccount() {
    if (!profile || deletePhrase !== "DELETE" || !deletePassword) return;
    if (!confirmAccountDeletion()) return;
    setBusy("delete");
    setNotice(null);
    try {
      await deleteAccountRequest(profile, deletePassword);
      window.location.assign("/");
    } catch (error) {
      setNotice(deleteAccountErrorNotice(error));
      setDeletePassword("");
      setBusy(null);
    }
  }

  return {
    deleteOpen,
    setDeleteOpen,
    deletePhrase,
    setDeletePhrase,
    deletePassword,
    setDeletePassword,
    exportData,
    deleteAccount,
  };
}
