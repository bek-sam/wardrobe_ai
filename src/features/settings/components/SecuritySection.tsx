"use client";

import { ShieldCheck } from "@phosphor-icons/react";

import { Card } from "@/components/ui/Card";

import { SecurityPanels } from "./SecurityPanels";
import type { Notice } from "./settings.types";
import type { useAccountSecurity } from "./use-account-security";
import { useSecurityActions } from "./use-security-actions";

export function SecuritySection({
  security,
  setNotice,
}: {
  security: ReturnType<typeof useAccountSecurity>;
  setNotice: (notice: Notice) => void;
}) {
  const { account, loading, error, reload } = security;
  const actions = useSecurityActions(reload, setNotice);

  return (
    <Card as="section" className="settings-section" id="settings-security">
      <div className="settings-section__heading">
        <div>
          <p className="eyebrow">Security &amp; sign-in</p>
          <h2>How you get in</h2>
          <p>Manage your password, sign-in methods, two-factor authentication, and sessions.</p>
        </div>
        <ShieldCheck size={22} />
      </div>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {loading || !account ? (
        <p role="status">Loading your security settings…</p>
      ) : (
        <SecurityPanels account={account} actions={actions} />
      )}
    </Card>
  );
}
