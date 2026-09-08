import { Skeleton } from "@/components/ui/skeleton";

/** Shown in place of a route body while its loader runs for longer than
 *  defaultPendingMs. Deliberately generic: a route with a better-shaped
 *  skeleton of its own overrides this with its own pendingComponent. */
export function RoutePending() {
  return (
    <div className="min-h-[50vh] px-5 py-10">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/5 rounded-md" />
        <Skeleton className="h-4 w-4/5 rounded-md" />
        <Skeleton className="h-4 w-2/5 rounded-md" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
