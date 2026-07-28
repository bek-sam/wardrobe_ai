"use client";

import { Button } from "@/components/ui/Button";
import type { AccountSecurity } from "@/features/settings/account-security.types";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/constants";

import { PasswordPanelFields } from "./PasswordPanelFields";
import { usePasswordPanel } from "./use-password-panel";

/** Change an existing password, or add a first one to a Google-only account. */
export function PasswordPanel({
  account,
  onChanged,
}: {
  account: AccountSecurity;
  onChanged: (message: string) => void;
}) {
  const form = usePasswordPanel(account.hasPassword, onChanged);

  return (
    <div className="security-panel">
      <h3>{account.hasPassword ? "Change password" : "Add a password"}</h3>
      {form.error ? (
        <p className="form-field__error" role="alert">
          {form.error}
        </p>
      ) : null}
      <PasswordPanelFields form={form} hasPassword={account.hasPassword} />
      <Button
        disabled={form.pending || form.next.length < PASSWORD_MIN_LENGTH}
        onClick={() => void form.submit()}
      >
        {form.pending ? "Saving…" : account.hasPassword ? "Change password" : "Add password"}
      </Button>
    </div>
  );
}
