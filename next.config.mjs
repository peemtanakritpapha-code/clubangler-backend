// V4B-BODYSIZE
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    proxyClientMaxBodySize: "100mb", // V4B-BODYSIZE: อัปคลิปวิดีโอสูงสุด 100MB ผ่าน proxy/middleware
    middlewareClientMaxBodySize: "100mb", // เผื่อ Next เวอร์ชันย่อยใช้ชื่อเก่า
  },
};

export default nextConfig;
