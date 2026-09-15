"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  Clock3,
  FileText,
  FolderKanban,
  Home,
  ListTodo,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Tags
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";

const sidebarStorageKey = "personalhub-sidebar-open";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/assignments", label: "Assignments", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/tags", label: "Tags", icon: Tags },
  { href: "/timeline", label: "Timeline", icon: Clock3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  React.useEffect(() => {
    const saved = window.localStorage.getItem(sidebarStorageKey);
    if (saved === "false") setSidebarOpen(false);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen((current) => {
      const next = !current;
      window.localStorage.setItem(sidebarStorageKey, String(next));
      return next;
    });
  }, []);

  return (
    <div
      className={cn(
        "min-h-screen lg:grid",
        sidebarOpen ? "lg:grid-cols-[240px_1fr]" : "lg:grid-cols-[64px_1fr]"
      )}
    >
      <aside className="border-b bg-card lg:min-h-screen lg:border-b-0 lg:border-r">
        <div
          className={cn(
            "flex h-16 items-center gap-2 border-b px-3",
            sidebarOpen
              ? "justify-between lg:px-5"
              : "justify-between lg:flex-col lg:justify-center lg:px-2"
          )}
        >
          {sidebarOpen ? (
            <Link href="/" className="text-lg font-semibold">
              PersonalHub
            </Link>
          ) : (
            <Link
              href="/"
              className="hidden text-lg font-semibold lg:block"
              aria-label="PersonalHub"
            >
              PH
            </Link>
          )}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              onClick={toggleSidebar}
              className="shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
            {sidebarOpen ? <ThemeToggle /> : null}
            {sidebarOpen ? (
              <form action={logoutAction}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </form>
            ) : null}
          </div>
        </div>
        <nav
          className={cn(
            "gap-1 p-3",
            sidebarOpen
              ? "flex overflow-x-auto lg:block lg:space-y-1"
              : "hidden lg:block lg:space-y-1"
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={sidebarOpen ? undefined : item.label}
                title={sidebarOpen ? undefined : item.label}
                className={cn(
                  "flex min-w-fit items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  sidebarOpen ? "gap-2" : "justify-center px-2"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {sidebarOpen ? (
                  item.label
                ) : (
                  <span className="sr-only">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>
        {sidebarOpen ? null : (
          <div className="hidden space-y-2 border-t p-3 lg:block">
            <ThemeToggle />
            <form action={logoutAction}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        )}
      </aside>
      <main
        className={cn(
          "mx-auto w-full px-5 py-6 lg:px-8",
          sidebarOpen ? "max-w-7xl" : "max-w-none"
        )}
      >
        {children}
      </main>
    </div>
  );
}
