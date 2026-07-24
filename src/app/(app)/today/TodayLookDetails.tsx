import { Check, CloudRain, Heart, Shuffle } from "@phosphor-icons/react/ssr";

import { Button } from "@/components/ui/Button";

export function TodayLookDetails() {
  return (
    <div className="today-look__details">
      <p className="eyebrow">Office · 62° · light rain</p>
      <h2 id="today-look-title">Workday ease</h2>
      <p className="today-look__summary">
        The camel layer adds warmth without bulk, while the navy trouser keeps the relaxed shirt
        appropriate for work.
      </p>
      <ul className="today-look__reasons">
        <li>
          <Check size={15} weight="bold" /> Light outer layer for the cooler morning
        </li>
        <li>
          <CloudRain size={15} /> Leather shoes handle light rain better
        </li>
        <li>
          <Check size={15} weight="bold" /> No unavailable pieces selected
        </li>
      </ul>
      <div className="today-look__actions">
        <Button>
          <Heart size={16} /> Save look
        </Button>
        <Button variant="secondary">
          <Shuffle size={16} /> Swap a piece
        </Button>
      </div>
      <div className="today-look__alternatives">
        <span>Make it</span>
        <button type="button">More casual</button>
        <button type="button">Warmer</button>
        <button type="button">Different shoes</button>
      </div>
    </div>
  );
}
