import { AppShell } from "@/components/navigation/AppShell";
import { SettingsPage } from "@/components/settings/SettingsPage";

export default function SettingsRoute() {
  return (
    <AppShell activeTab="settings">
      <SettingsPage />
    </AppShell>
  );
}
