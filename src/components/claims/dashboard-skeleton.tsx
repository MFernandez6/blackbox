import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-3 gap-0 border border-hairline">
        <Skeleton className="h-24 border-r border-hairline" />
        <Skeleton className="h-24 border-r border-hairline" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-40 w-full" />
      <div className="space-y-0 border border-hairline">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-b border-hairline last:border-0" />
        ))}
      </div>
    </div>
  );
}
