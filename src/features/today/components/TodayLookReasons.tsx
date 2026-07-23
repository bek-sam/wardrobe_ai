import { Check, CloudRain, WarningCircle } from "@phosphor-icons/react";

export function TodayLookReasons({ reasons, warnings }: { reasons: string[]; warnings: string[] }) {
  return (
    <ul className="today-look__reasons" aria-label="Recommendation reasons and warnings">
      {reasons.slice(0, 3).map((reason) => (
        <li key={reason}>
          <CloudRain size={15} aria-hidden="true" /> {reason}
        </li>
      ))}
      <li>
        <Check size={15} weight="bold" aria-hidden="true" /> Every displayed item ID was re-verified
        against your wardrobe.
      </li>
      {warnings.map((warning) => (
        <li key={warning}>
          <WarningCircle size={15} aria-hidden="true" /> {warning}
        </li>
      ))}
    </ul>
  );
}
