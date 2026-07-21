import { Info } from "@phosphor-icons/react/ssr";

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <aside className="demo-notice" aria-label="Preview content notice">
      <Info aria-hidden="true" size={17} />
      <p>{children}</p>
    </aside>
  );
}
