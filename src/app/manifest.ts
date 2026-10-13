import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BLACKBOX Claims",
    short_name: "BLACKBOX",
    description:
      "Internal claims system of record — Blackline Public Adjusters",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F1EDE4",
    theme_color: "#F1EDE4",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
