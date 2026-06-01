import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CheckSquare, Clock3, FileText, FolderKanban, Home, ListTodo, Settings } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "PersonalHub",
  description: "Local-first personal productivity app"
};

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/assignments", label: "Assignments", icon: ListTodo },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/timeline", label: "Timeline", icon: Clock3 },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
try {
  const saved = localStorage.getItem("personalhub-theme");
  const theme = saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
} catch {
  document.documentElement.style.colorScheme = "light";
}
})();`
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
            <aside className="border-b bg-card lg:min-h-screen lg:border-b-0 lg:border-r">
              <div className="flex h-16 items-center justify-between gap-3 border-b px-5">
                <Link href="/" className="text-lg font-semibold">
                  PersonalHub
                </Link>
                <ThemeToggle />
              </div>
              <nav className="flex gap-1 overflow-x-auto p-3 lg:block lg:space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex min-w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </aside>
            <main className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
