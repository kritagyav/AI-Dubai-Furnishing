export default function AuthLoading() {
  return (
    <div className="space-y-4">
      <div className="mx-auto h-8 w-40 animate-pulse rounded bg-gray-200" />
      <div className="space-y-3">
        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        <div className="h-10 w-full animate-pulse rounded-md bg-gray-300" />
      </div>
    </div>
  );
}
