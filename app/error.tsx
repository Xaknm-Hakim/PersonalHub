"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
      <p className="font-medium">Something could not be loaded.</p>
      <button
        className="mt-3 rounded-md border px-3 py-2 text-sm"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
