// lib/avatar.js — AVA-1: default avatar เจน SVG จากชื่อ (หลังเหตุรูปโปรไฟล์หาย 13 ก.ค.)
// ใช้เป็น fallback เมื่อไม่มี avatar_path — ผู้ใช้ใหม่ทุกคนได้อัตโนมัติ ไม่ต้องอัพไฟล์
export function avatarDataUri(name, shop = false) {
  const n = String(name || "?").trim() || "?";
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  const PAL = [
    ["#088887", "#0AB5B3"], ["#0A6B6A", "#12A5A3"], ["#0E7490", "#22C8E0"],
    ["#065F5E", "#0D9488"], ["#137A7A", "#3FC9BF"], ["#0C4A6E", "#0891B2"],
  ];
  const [c1, c2] = shop ? ["#B26A00", "#F0A500"] : PAL[h % PAL.length];
  const ch = n.charAt(0).toUpperCase();
  const flip = h % 2 ? "" : " transform='translate(80 0) scale(-1 1)'";
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>" +
    "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
    "<stop offset='0' stop-color='" + c1 + "'/><stop offset='1' stop-color='" + c2 + "'/>" +
    "</linearGradient></defs>" +
    "<rect width='80' height='80' fill='url(#g)'/>" +
    "<g fill='#fff' opacity='.17'" + flip + ">" +
    "<path d='M12 63c7-6 19-6 27 0-8 6-20 6-27 0z'/>" +
    "<path d='M39 63l10-6.5v13z'/>" +
    "<circle cx='19' cy='61.5' r='1.7'/>" +
    "</g>" +
    "<text x='40' y='38' text-anchor='middle' dominant-baseline='central' " +
    "font-family='sans-serif' font-size='33' font-weight='700' fill='#fff'>" + ch + "</text>" +
    "</svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
