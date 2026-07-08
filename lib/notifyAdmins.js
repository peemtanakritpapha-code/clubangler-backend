// lib/notifyAdmins.js — AD5: แจ้งเตือนแอดมินทุกคน พร้อม link กดเข้าคิวตรง (?tab=...)
// จุดเดียวทั้งระบบ — ห้ามเขียน insert แจ้งเตือนแอดมินซ้ำที่อื่น
export async function notifyAdmins(admin, { icon = "🛎", title, body = "", ref = null, link = null }) {
  const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
  if (!admins?.length) return;
  await admin.from("notifications").insert(
    admins.map(a => ({ to_user: a.id, icon, title, body, ref, link }))
  );
}
