import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export function PublicHeader() {
  return (
    <header className="public-header">
      <BrandMark />
      <nav aria-label="Public navigation">
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <div className="public-header__actions">
        <Link className="public-header__login" href="/login">
          Log in
        </Link>
        <Link className="button button--primary button--small" href="/signup">
          Create account <ArrowRight size={15} />
        </Link>
      </div>
    </header>
  );
}
