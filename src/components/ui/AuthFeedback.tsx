import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";

import { sanitizeAuthMessage } from "./sanitize-auth-message";
import type { SearchParamValue } from "./search-param-value";

export function AuthFeedback({
  error,
  notice,
}: {
  error?: SearchParamValue;
  notice?: SearchParamValue;
}) {
  const safeError = sanitizeAuthMessage(error);
  const safeNotice = sanitizeAuthMessage(notice);

  return (
    <>
      {safeError ? (
        <div className="auth-feedback auth-feedback--error" role="alert" aria-live="assertive">
          <WarningCircle aria-hidden="true" size={17} weight="fill" />
          <p>{safeError}</p>
        </div>
      ) : null}
      {safeNotice ? (
        <div className="auth-feedback auth-feedback--notice" role="status" aria-live="polite">
          <CheckCircle aria-hidden="true" size={17} weight="fill" />
          <p>{safeNotice}</p>
        </div>
      ) : null}
    </>
  );
}
