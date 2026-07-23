import { DemoNotice } from "@/components/ui/DemoNotice";

export function StylistAiDisabledNotice({ aiConfigured }: { aiConfigured: boolean }) {
  if (aiConfigured) return null;
  return (
    <DemoNotice>
      Your account is connected, but the AI stylist service is not fully configured. The composer is
      disabled and no sample recommendation is shown as live data.
    </DemoNotice>
  );
}
