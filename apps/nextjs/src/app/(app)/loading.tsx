export default function AppLoading() {
  return (
    <div className="space-y-6 py-4">
      {/* Page title skeleton */}
      <div className="h-9 w-48 animate-pulse rounded-md bg-gray-200" />
      <div className="h-4 w-72 animate-pulse rounded-md bg-gray-100" />

      {/* Content skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-lg border p-6">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
