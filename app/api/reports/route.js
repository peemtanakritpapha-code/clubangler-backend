// app/api/reports/route.js — POST2: รับรายงานเนื้อหา (โพสต์/คอมเมนต์/สินค้า)
// เหตุที่ต้องเป็น API (Iron Rule 17): ต้องยิงแจ้งเตือนถึงแอดมินด้วย service key ในจังหวะเดียวกัน
// ตาราง reports ไม่มี RLS policy ฝั่ง client เลย — เขียนได้จากที่นี่ที่เดียว
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notifyAdmins";

const TYPES = { post: "โพสต์", comment: "คอมเมนต์", product: "สินค้า" };
const REASONS = [
  "สแปม / หลอกลวง / ชวนซื้อขายนอกระบบ",
  "สินค้าต้องห้าม / ผิดกฎหมาย",
  "เนื้อหาไม่เหมาะสม / ก้าวร้าว",
  "ของปลอม / ละเมิดลิขสิทธิ์",
  "อื่นๆ",
];

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json();
  const targetType = String(body?.targetType || "");
  const targetId = Number(body?.targetId);
  const reason = String(body?.reason || "").trim();
  const detail = String(body?.detail || "").trim().slice(0, 1000) || null;

  if (!TYPES[targetType] || !Number.isFinite(targetId) || targetId <= 0)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  if (!REASONS.includes(reason))
    return NextResponse.json({ error: "กรุณาเลือกเหตุผล" }, { status: 400 });

  const admin = createAdminClient();

  // ตรวจว่าเป้าหมายมีจริง (กันรายงานลอย/ยิง id มั่ว)
  const table = targetType === "post" ? "posts" : targetType === "comment" ? "post_comments" : "products";
  const { data: target } = await admin.from(table).select("id").eq("id", targetId).single();
  if (!target) return NextResponse.json({ error: "ไม่พบเนื้อหาที่รายงาน" }, { status: 404 });

  // insert — unique index (reporter+เป้า ที่ยัง open) กันซ้ำระดับ DB: ซ้ำ = ตอบสำเร็จเงียบๆ ไม่สร้างแถวใหม่
  const { error } = await admin.from("reports").insert({
    reporter_id: user.id, target_type: targetType, target_id: targetId, reason, detail,
  });
  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true, duplicate: true });
    console.error("reports insert:", error);
    return NextResponse.json({ error: "บันทึกรายงานไม่สำเร็จ" }, { status: 500 });
  }

  // notifyAdmins จุดที่ 6 — คิวจัดการจริงมาใน POST3 (?tab=reports)
  await notifyAdmins(admin, {
    icon: "🚩",
    title: `มีรายงานใหม่: ${TYPES[targetType]}`,
    body: `${reason}${detail ? ` — ${detail.slice(0, 80)}` : ""}`,
    ref: `report:${targetType}:${targetId}`,
    link: "/admin?tab=reports",
  });

  return NextResponse.json({ ok: true });
}
