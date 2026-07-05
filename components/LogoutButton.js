"use client";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createClient();
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
  return (
    <button onClick={logout}
      style={{ height: 42, padding: "0 28px", border: "1px solid #E5E9EA", borderRadius: 10, background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
      ออกจากระบบ
    </button>
  );
}
