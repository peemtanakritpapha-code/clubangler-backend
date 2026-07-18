// lib/r2.js — V2: ตัวอัปโหลดไฟล์ขึ้น Cloudflare R2 (bucket clubangler-videos)
// ต้องมี R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY ใน .env.local (ตั้งไว้แล้วใน V1)
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = "clubangler-videos";
const PUBLIC_BASE = "https://video.clubangler.com";

let _client = null;
function r2Client() {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

// อัปโหลดไฟล์ 1 ชิ้น คืนค่า URL สาธารณะ (ผ่าน video.clubangler.com — ต่อ custom domain ไว้แล้วใน V1)
export async function uploadToR2(key, buffer, contentType) {
  await r2Client().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${PUBLIC_BASE}/${key}`;
}
