import {
  confirmAccountDeletion,
  deleteAccountErrorNotice,
  deleteAccountRequest,
  startDeletionReauthentication,
} from "./delete-account";
import type { Notice, Profile } from "./settings.types";

type DeleteAccountInput = {
  profile: Profile | null;
  deletePhrase: string;
  deletePassword: string;
  setDeletePassword: (value: string) => void;
  setBusy: (value: string | null) => void;
  setNotice: (notice: Notice | null) => void;
};

export function useDeleteAccount(input: DeleteAccountInput) {
  /** Google and passwordless accounts prove identity through their provider. */
  async function reauthenticate() {
    input.setBusy("reauthenticate");
    input.setNotice(null);
    try {
      const redirectUrl = await startDeletionReauthentication();
      if (redirectUrl) return window.location.assign(redirectUrl);
      input.setNotice({
        tone: "success",
        message: "Check your email for a confirmation link, then come back here to delete.",
      });
    } catch (error) {
      input.setNotice(deleteAccountErrorNotice(error));
    } finally {
      input.setBusy(null);
    }
  }

  async function deleteAccount() {
    if (!input.profile || input.deletePhrase !== "DELETE") return;
    if (!confirmAccountDeletion()) return;
    input.setBusy("delete");
    input.setNotice(null);
    try {
      await deleteAccountRequest(input.profile, input.deletePassword);
      // A public page, because the session no longer exists — anything
      // authenticated would bounce to a login screen for a deleted account.
      // It also explains that file cleanup finishes in the background.
      window.location.assign("/account-deleted");
    } catch (error) {
      input.setNotice(deleteAccountErrorNotice(error));
      input.setDeletePassword("");
      input.setBusy(null);
    }
  }

  return { deleteAccount, reauthenticate };
}
