import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Privacy | PersonalHub",
  description: "PersonalHub privacy policy and Google user-data handling"
};

const scopeClass =
  "break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">PersonalHub</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy policy
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            How this personal-use application handles Google Calendar data.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Google data accessed</CardTitle>
            <CardDescription>
              PersonalHub requests only the two Calendar permissions needed by
              its manual projection feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              <code className={scopeClass}>calendar.app.created</code> is used
              to create a dedicated PersonalHub secondary calendar and to
              create, update, or delete managed events on calendars created by
              PersonalHub.
            </p>
            <p>
              <code className={scopeClass}>calendar.calendarlist.readonly</code>{" "}
              is used to read Calendar List metadata and rediscover the
              PersonalHub-managed calendar after a failure between Google
              calendar creation and local persistence.
            </p>
            <p>PersonalHub does not import arbitrary Google Calendar events.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data stored</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            <p>
              PersonalHub stores encrypted Google refresh authorization, Google
              account and integration state required by the connection, the
              managed calendar ID, managed event IDs and mappings, and
              synchronization metadata.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security and disclosure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              Google refresh credentials are encrypted at rest with
              application-layer authenticated encryption. Google access tokens
              are short-lived and are not persisted. Credentials are not
              intentionally logged.
            </p>
            <p>
              PersonalHub does not sell Google user data and does not share it
              with advertisers or unrelated third parties.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Synchronization and disconnect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              PersonalHub remains authoritative in v3.2. Synchronization occurs
              only when the owner selects Sync Now. Direct Google edits to
              managed projection events can be overwritten by a later sync;
              Google changes are not imported into PersonalHub.
            </p>
            <p>
              Disconnect clears PersonalHub&apos;s local Google authorization
              state. It does not automatically delete the dedicated Google
              calendar or events already projected into it.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner and contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              PersonalHub is a personal-use application operated for one owner;
              it does not represent a separate company or legal entity.
            </p>
            <p>
              Privacy or support requests may be sent to the developer contact
              displayed on the PersonalHub Google OAuth consent screen.
            </p>
          </CardContent>
        </Card>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-sm text-muted-foreground">
          <Link className="font-medium text-primary underline" href="/about">
            About PersonalHub
          </Link>
          <Link className="underline" href="/login">
            Owner sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
