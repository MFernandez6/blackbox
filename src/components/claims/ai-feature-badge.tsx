import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function AiFeatureBadge({ className }: { className?: string }) {
  return (
    <Badge
      title="Premium AI feature — runs on Claude via the Anthropic API"
      className={cn("border-brand-gold/40 text-brand-gold", className)}
    >
      Claude AI
    </Badge>
  );
}
