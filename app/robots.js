// app/robots.js — SEO1: กติกาให้บอทค้นหา (เข้าถึงที่ https://clubangler.com/robots.txt)
// allow ทั้งเว็บ ยกเว้นโซนแอดมิน/API/หน้าส่วนตัวที่ต้องล็อกอิน (crawl ไปก็เจอหน้า login เปลืองงบ crawl เปล่าๆ)
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/seller/", "/api/feed/"], // AEO-FIX: /sell เดิมกินเกิน /seller/ · เปิด /api/feed/ ให้ merchant ดึง feed
        disallow: [
          "/admin",
          "/api/",
          "/orders",
          "/checkout",
          "/cart",
          "/pay",
          "/kyc",
          "/notifications",
          "/my-products",
          "/profile",
          "/sell$", // เจาะจงหน้าลงขายหน้าเดียว — กันชน /seller/
          "/login",
        ],
      },
    ],
    sitemap: "https://clubangler.com/sitemap.xml",
  };
}
