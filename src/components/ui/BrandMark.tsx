import Link from "next/link";

export function BrandMark({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      className={`brand-mark${compact ? " brand-mark--compact" : ""}`}
      href={href}
      aria-label="Wardrobe AI home"
    >
      <span className="brand-mark__monogram" aria-hidden="true">
        W
      </span>
      {compact ? null : (
        <span className="brand-mark__wordmark">
          <strong>Wardrobe</strong>
          <small>AI</small>
        </span>
      )}
    </Link>
  );
}
