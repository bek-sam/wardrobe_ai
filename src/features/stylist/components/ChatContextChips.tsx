import { CalendarBlank, CloudRain, MapPin } from "@phosphor-icons/react";

export function ChatContextChips({ date, location }: { date: string; location: string }) {
  return (
    <div className="chat-panel__context">
      <span>
        <CalendarBlank size={15} /> {date || "Choose a date"}
      </span>
      <span>
        <MapPin size={15} /> {location.trim() || "Home location"}
      </span>
      <span>
        <CloudRain size={15} /> Forecast checked when available
      </span>
    </div>
  );
}
