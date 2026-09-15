import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { optionalOwnerSession } from "@/lib/auth/web-session";
import { ownerIsConfigured } from "@/lib/auth/owner";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await optionalOwnerSession()) redirect("/");
  const configured = await ownerIsConfigured();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to PersonalHub</CardTitle>
        </CardHeader>
        <CardContent>
          {configured ? (
            <LoginForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              The owner has not been initialized. Run the documented owner
              bootstrap command on the server.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
