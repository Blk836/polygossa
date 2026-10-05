import { ThemePicker } from "@/components/theme-picker";

export default function AppearancePage() {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted">System follows your device&apos;s light or dark setting. Saved on this device.</p>
      <div className="mt-3"><ThemePicker /></div>
    </section>
  );
}
