// V4C-FIX-BODYSIZE
// V4B-BODYSIZE
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    proxyClientMaxBodySize: "100mb", // V4C-FIX: อัปคลิปวิดีโอสูงสุด 100MB (ตัด middlewareClientMaxBodySize ออก — Next รุ่นนี้ห้ามตั้งคู่กัน)
  },
};

export default nextConfig;
