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
      <div className="grid grid-cols-1 gap-0 border border-brand-white/10 md:grid-cols-3">
        <Skeleton className="h-24 border-b border-brand-white/10 md:border-b-0 md:border-r" />
        <Skeleton className="h-24 border-b border-brand-white/10 md:border-b-0 md:border-r" />
        <Skeleton className="h-24" />
      </div>
      <div className="space-y-0 border border-brand-white/10">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-b border-brand-white/10 last:border-0" />
        ))}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="space-y-0 border border-brand-white/10">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full border-b border-brand-white/10 last:border-0" />
        ))}
      </div>
    </div>
  );
}
