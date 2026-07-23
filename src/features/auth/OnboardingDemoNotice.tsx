import { DemoNotice } from "@/components/ui/DemoNotice";

export function OnboardingDemoNotice({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <div className="form-section">
      <DemoNotice>
        Preview mode: configure Supabase to save this private style profile. You can still skip
        ahead and explore the interface.
      </DemoNotice>
    </div>
  );
}
