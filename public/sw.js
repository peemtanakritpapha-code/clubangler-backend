// public/sw.js — Service Worker แบบเบาของ ClubAngler
// กติกา: ไม่ cache ข้อมูลสดใดๆ (API/ออเดอร์/ตะกร้า) — cache แค่หน้า offline หน้าเดียว
const CACHE = "ca-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // ล้าง cache เวอร์ชันเก่า
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // จัดการเฉพาะการเปิดหน้า (navigation) — อย่างอื่นปล่อยผ่านให้เบราว์เซอร์ตามปกติ
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(OFFLINE_URL))
  );
});
