import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings / About" description="PersonalHub 0.1.0" />
      <Card>
        <CardHeader>
          <CardTitle>Local-first personal app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            PersonalHub is intended for personal localhost usage on your laptop.
            The MVP has no authentication, public sharing, cloud sync, team
            workspaces, payments, AI features, or external calendar
            integrations.
          </p>
          <p>
            Database location:{" "}
            <span className="font-mono text-foreground">
              ./data/personalhub.db
            </span>
          </p>
          <p>
            App version:{" "}
            <span className="font-mono text-foreground">0.1.0</span>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
