/** Build a Google Maps search URL for a property address (+ optional ZIP). */
export function googleMapsUrl(address: string, zipCode?: string | null): string {
  const query = [address, zipCode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
