// app/manifest.js — Next.js สร้าง /manifest.webmanifest + ใส่ <link> ใน head ให้อัตโนมัติ
export default function manifest() {
  return {
    name: "ClubAngler — ตลาดอุปกรณ์ตกปลา",
    short_name: "ClubAngler",
    description: "ซื้อขายอุปกรณ์ตกปลามือหนึ่ง-มือสอง ผ่านระบบเงินฝากปลอดภัย (escrow)",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0E7E8C",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
