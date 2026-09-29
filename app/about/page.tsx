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
  title: "About | PersonalHub",
  description: "About the PersonalHub personal productivity application"
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">PersonalHub</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            About PersonalHub
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            A private, single-owner system for personal productivity and
            operational state.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>What PersonalHub manages</CardTitle>
            <CardDescription>
              PersonalHub organizes the owner&apos;s tasks, assignments,
              projects, notes, and related personal planning information.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              The application is intended for personal use by one owner. Its
              authenticated workspace is private and is not exposed through this
              public information page.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optional Google Calendar connection</CardTitle>
            <CardDescription>
              Google Calendar is an optional projection destination, not a
              second source of truth.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>
              When the owner connects Google, eligible dated PersonalHub tasks
              and assignments can be projected into a dedicated Google Calendar
              by choosing Sync Now.
            </p>
            <p>
              PersonalHub remains authoritative. Changes made directly to
              managed Google events may be overwritten by a later Sync Now.
              PersonalHub v3.2 does not import Google Calendar changes or
              provide inbound Google-to-PersonalHub synchronization.
            </p>
          </CardContent>
        </Card>

        <footer className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-5 text-sm text-muted-foreground">
          <Link className="font-medium text-primary underline" href="/privacy">
            Privacy policy
          </Link>
          <Link className="underline" href="/login">
            Owner sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
