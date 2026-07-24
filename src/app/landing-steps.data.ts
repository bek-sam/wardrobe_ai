import { CloudRain, CoatHanger, Sparkle } from "@phosphor-icons/react/ssr";

export const steps = [
  {
    number: "01",
    icon: CoatHanger,
    title: "Build your private closet",
    copy: "Add pieces by photo or by hand. Review every AI suggestion before it becomes part of your wardrobe.",
  },
  {
    number: "02",
    icon: CloudRain,
    title: "Add the day’s context",
    copy: "Wardrobe AI considers weather, occasion, comfort, availability, and the way you prefer to dress.",
  },
  {
    number: "03",
    icon: Sparkle,
    title: "Get a look you can wear",
    copy: "Receive a complete outfit made only from pieces you own, with useful swaps when plans change.",
  },
] as const;
