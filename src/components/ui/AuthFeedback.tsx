import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";

export type SearchParamValue = string | string[] | undefined;

const MAX_MESSAGE_LENGTH = 240;
const MAX_RETURN_TO_LENGTH = 500;

function firstValue(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function sanitizeAuthMessage(value: SearchParamValue): string | null {
  const candidate = firstValue(value);
  if (!candidate) return null;

  const normalized = candidate
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);

  return normalized || null;
}

export function sanitizeReturnTo(value: SearchParamValue): string {
  const candidate = firstValue(value)?.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return "/today";
  }
  return candidate.slice(0, MAX_RETURN_TO_LENGTH);
}

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
