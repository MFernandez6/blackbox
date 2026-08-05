import type { ClaimStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/claims/labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <Badge className={cn(STATUS_BADGE_CLASS[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
