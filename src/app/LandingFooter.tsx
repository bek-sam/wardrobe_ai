import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="public-footer">
      <span>Wardrobe AI</span>
      <p>Thoughtful technology for the clothes you already own.</p>
      <nav aria-label="Legal links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
