"use client";

import { useEffect } from "react";
import { googleOAuthCompletionTarget } from "@/services/integrations/google/completion";

export function GoogleOAuthCompletionBounce() {
  useEffect(() => {
    const input = Object.fromEntries(
      new URLSearchParams(window.location.hash.slice(1))
    );
    window.location.replace(googleOAuthCompletionTarget(input));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5">
      <p className="text-sm text-muted-foreground">
        Finishing Google connection…
      </p>
    </main>
  );
}
