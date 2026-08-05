import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { googleMapsUrl } from "@/lib/maps";

type Props = {
  address: string;
  zipCode?: string | null;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "solid" | "secondary";
  className?: string;
};

export function GoogleMapsButton({
  address,
  zipCode,
  size = "sm",
  variant = "outline",
  className,
}: Props) {
  if (!address.trim()) return null;

  const href = googleMapsUrl(address, zipCode);

  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-2 h-3 w-3" />
        Open in Maps
      </a>
    </Button>
  );
}
