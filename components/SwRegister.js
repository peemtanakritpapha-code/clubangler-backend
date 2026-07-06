"use client";
// components/SwRegister.js — ลงทะเบียน service worker (ไม่แสดงผลอะไรบนจอ)
import { useEffect } from "react";

export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
