import type { MfaEnrollmentData } from "./mfa-enrollment.types";

/**
 * The provisioning material, shown once.
 *
 * Supabase returns the QR as SVG markup. It is rendered through a data URI so
 * the browser treats it as an image rather than as document markup — pasting
 * provider-supplied SVG into the DOM would be a script-execution surface.
 */
export function MfaSetupKey({ enrollment }: { enrollment: MfaEnrollmentData }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- an inline data
          URI has nothing for the image optimizer to fetch or cache. */}
      <img
        alt="QR code for adding Wardrobe AI to your authenticator app"
        height={180}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qr_code)}`}
        width={180}
      />
      <p>
        Cannot scan? Enter this setup key by hand, then keep it somewhere safe — it is shown only
        now and cannot be retrieved later:
      </p>
      <code className="mfa-enrollment__secret">{enrollment.secret}</code>
    </>
  );
}
