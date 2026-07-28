import { Bell, CoatHanger, LockKey, MapPin, ShieldCheck, User } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function SettingsTabs({
  activeSection,
  onOpen,
}: {
  activeSection: string;
  onOpen: (sectionId: string) => void;
}) {
  const tab = (id: string, icon: ReactNode, label: string) => (
    <button
      className={activeSection === id ? "is-active" : ""}
      onClick={() => onOpen(id)}
      type="button"
    >
      {icon} {label}
    </button>
  );
  return (
    <nav className="settings-tabs" aria-label="Settings sections">
      {tab("settings-profile", <User size={18} />, "Profile")}
      {tab("settings-style", <CoatHanger size={18} />, "Style & sizes")}
      {tab("settings-location", <MapPin size={18} />, "Location")}
      <button disabled title="Notification preferences are not available yet" type="button">
        <Bell size={18} /> Notifications
      </button>
      {tab("settings-security", <ShieldCheck size={18} />, "Security & sign-in")}
      {tab("settings-privacy", <LockKey size={18} />, "Privacy & data")}
    </nav>
  );
}
