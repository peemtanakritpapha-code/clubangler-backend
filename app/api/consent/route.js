// app/api/consent/route.js — CONSENT-1: บันทึกการกดยอมรับกติกา (จุด: signup / order_terms / ship_terms / return_terms)
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const POINTS = ["signup", "order_terms", "ship_terms", "return_terms"];

export async function POST(req) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const point = String(body.point || "");
  if (!POINTS.includes(point)) return NextResponse.json({ error: "จุดยอมรับไม่ถูกต้อง" }, { status: 400 });

  const row = { user_id: user.id, point };
  if (body.order_id != null) row.order_id = String(body.order_id);

  const admin = createAdminClient();
  const { error } = await admin.from("consent_logs").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
