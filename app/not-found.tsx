import Link from "next/link";
export default function NotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8">
      <h1 className="text-xl font-semibold">That item no longer exists</h1>
      <p className="mt-2 text-muted-foreground">
        It may have been deleted or the link is incomplete.
      </p>
      <Link className="mt-4 inline-block underline" href="/">
        Return to dashboard
      </Link>
    </div>
  );
}
