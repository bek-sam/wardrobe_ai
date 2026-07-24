import { GoogleLogo } from "@phosphor-icons/react/ssr";

export function OAuthGoogleButton({ describedBy }: { describedBy: string }) {
  return (
    <button className="oauth-button" type="button" aria-describedby={describedBy} disabled>
      <GoogleLogo size={19} weight="bold" /> Continue with Google
    </button>
  );
}
