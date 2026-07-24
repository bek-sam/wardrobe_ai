import type { ReactNode } from "react";

import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { MobileTopbar } from "./MobileTopbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <DesktopNavigation />
      <div className="app-workspace">
        <MobileTopbar />
        <main className="app-content" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
      <MobileNavigation />
    </div>
  );
}
