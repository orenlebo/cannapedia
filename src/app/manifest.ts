import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "קנאפדיה - אנציקלופדיית הקנאביס הרפואי",
    short_name: "קנאפדיה",
    description:
      "מאגר הידע המקיף והמהימן ביותר בישראל בנושא קנאביס רפואי",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f7f4",
    theme_color: "#16a34a",
    orientation: "portrait",
    dir: "rtl",
    lang: "he",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
