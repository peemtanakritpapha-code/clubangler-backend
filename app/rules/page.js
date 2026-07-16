// app/rules/page.js — กติกาการซื้อขายและข้อพิพาท — D4
import Link from "next/link";

const C = {
  brand: "#0E7E8C", brandDark: "#0B5F6A", brandTint: "#E3F1F3",
  ink: "#101314", muted: "#6B7678", line: "#E5E9EA", bg: "#F4F7F7",
  ok: "#2E8B57", danger: "#C24D42", warnBg: "#FBF2E9", warnBorder: "#F0DCC0", warnText: "#8A5A1E",
  dangerBg: "#FBEEEC", dangerBorder: "#F0CFC9",
};

export const metadata = {
  title: "กติกาการซื้อขายและข้อพิพาท — ClubAngler",
  description: "รายละเอียดกติกาการซื้อขาย เส้นตายแต่ละขั้นตอน และขั้นตอนข้อพิพาททั้งหมดของ ClubAngler",
};

const H = ({ n, children }) => (
  <h2 style={{ fontSize: 15.5, fontWeight: 800, color: C.ink, margin: "26px 0 10px", display: "flex", alignItems: "center", gap: 8 }}>
    <span style={{ width: 22, height: 22, borderRadius: 6, background: C.brand, color: "#fff", fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
    {children}
  </h2>
);
const P = ({ children, style }) => <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.85, margin: "0 0 10px", ...style }}>{children}</p>;
const LI = ({ children }) => <li style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.85, marginBottom: 5 }}>{children}</li>;
const H3 = ({ children }) => <h3 style={{ fontSize: 13.5, fontWeight: 800, color: C.ink, margin: "14px 0 6px" }}>{children}</h3>;

const TL = ({ time, children }) => (
  <div style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: `1px dashed ${C.line}` }}>
    <div style={{ flexShrink: 0, width: 92, fontWeight: 800, color: C.brand, fontSize: 13, paddingTop: 1 }}>{time}</div>
    <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{children}</div>
  </div>
);

const Callout = ({ variant = "note", children }) => {
  const styles = {
    note: { background: C.brandTint, color: C.brandDark, fontStyle: "normal" },
    warn: { background: C.warnBg, border: `1px solid ${C.warnBorder}`, color: C.warnText, fontStyle: "normal" },
    danger: { background: C.dangerBg, border: `1px solid ${C.dangerBorder}`, color: C.danger, fontStyle: "normal" },
    pending: { background: "#F1F1F1", border: "1px dashed #C7C7C7", color: "#666", fontStyle: "italic" },
  };
  return <div style={{ borderRadius: 10, padding: "12px 14px", margin: "10px 0", fontSize: 13, lineHeight: 1.75, ...styles[variant] }}>{children}</div>;
};

const DecisionCard = ({ good, label, children }) => (
  <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, flex: 1 }}>
    <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: .3, marginBottom: 4, color: good ? C.ok : C.danger }}>{label}</div>
    <p style={{ fontSize: 12.5, margin: 0 }}>{children}</p>
  </div>
);

const TOC_ITEMS = [
  ["t1", "เส้นตายที่ควรรู้"],
  ["t2", "ของไม่ตรงปก/ชำรุด"],
  ["t3", "กล่องว่าง/เสียหาย/สูญหายระหว่างส่ง"],
  ["t4", "ยังไม่ได้รับสินค้า"],
  ["t5", "คืนสินค้า"],
  ["t6", "ผู้ขายไม่ส่งของ"],
  ["t7", "รีวิว"],
  ["t8", "เงินค้างโอน"],
];

export default function RulesPage() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 16px" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <Link href="/" style={{ color: C.brand, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>‹ กลับหน้าแรก</Link>
        <div style={{ background: "#fff", borderRadius: 14, padding: "26px 24px", marginTop: 12, boxShadow: "0 4px 16px rgba(0,0,0,.05)" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: C.brand, margin: "0 0 4px" }}>กติกาการซื้อขายและข้อพิพาท</h1>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>มีผลตั้งแต่วันที่ 16 กรกฎาคม 2569 · อ้างอิง DISPUTE-POLICY v1.3</div>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, color: C.brandDark, background: C.brandTint, borderRadius: 20, padding: "3px 10px", marginTop: 6 }}>
            อ่านคู่กับข้อกำหนดการใช้บริการ
          </span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "14px 0 4px" }}>
            {TOC_ITEMS.map(([id, label]) => (
              <a key={id} href={`#${id}`} style={{ fontSize: 11.5, color: C.brandDark, background: C.brandTint, borderRadius: 20, padding: "4px 10px", textDecoration: "none", fontWeight: 600 }}>
                {label}
              </a>
            ))}
          </div>

          <P style={{ marginTop: 14 }}>
            เพื่อความเป็นธรรมทั้งฝั่งผู้ซื้อและผู้ขาย ClubAngler ใช้ระบบเงินฝากปลอดภัย (escrow) ควบคู่กับกติกาที่มีเส้นตายชัดเจนทุกขั้นตอน
            หน้านี้อธิบายรายละเอียดขั้นตอนข้อพิพาททั้งหมด ยึดหลัก 3 ข้อ:
          </P>
          <div style={{ background: C.brandTint, borderRadius: 10, padding: "14px 16px", margin: "14px 0" }}>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              <li style={{ fontWeight: 600, color: C.brandDark, lineHeight: 1.85, fontSize: 13.5 }}>ใครกล่าวอ้างว่ามีปัญหา ต้องเป็นฝ่ายแสดงหลักฐาน</li>
              <li style={{ fontWeight: 600, color: C.brandDark, lineHeight: 1.85, fontSize: 13.5 }}>ทุกขั้นตอนมีเส้นตาย และมีการตัดสินอัตโนมัติถ้าอีกฝ่ายเงียบ</li>
              <li style={{ fontWeight: 600, color: C.brandDark, lineHeight: 1.85, fontSize: 13.5 }}>มีการแจ้งเตือนก่อนถึงเส้นตายเสมอ และคุณต้องกดยอมรับกติกานี้ก่อนใช้งานทุกครั้งที่เกี่ยวข้อง (ระบบเก็บบันทึกไว้)</li>
            </ol>
          </div>

          <H n={1}>เส้นตายที่ควรรู้</H>
          <P>ระบบยังไม่ได้เชื่อมต่อการติดตามพัสดุอัตโนมัติ กติกาด้านล่างจึงอิงจากปุ่มที่กดจริงและเวลาที่เลยกำหนดเป็นหลัก</P>
          <div style={{ margin: "10px 0 16px" }}>
            <TL time="5 นาที">หลังสั่งซื้อ ต้อง<b>ชำระเงินและแนบสลิป</b> ไม่งั้นออเดอร์ถูกยกเลิกอัตโนมัติ เพื่อรักษาสิทธิ์ในการซื้อให้ผู้ใช้ท่านอื่น</TL>
            <TL time="3 วัน*">หลังเงินเข้าระบบ ผู้ขายต้อง<b>กรอกเลขพัสดุ</b> — แนบคลิปแพ็คของด้วยได้ (ถ้ามี) (*สินค้าพรีออเดอร์ใช้จำนวนวันที่ผู้ขายระบุไว้ตอนลงขาย)</TL>
            <TL time="5 วัน">หลังส่งของ ผู้ซื้อมีเวลา<b>ตรวจสอบและกดยืนยันรับ</b> — ไม่กด ระบบยืนยันแทนอัตโนมัติ เงินโอนเข้าผู้ขายทันที</TL>
            <TL time="5 วัน">กรณีแอดมินอนุมัติให้คืนสินค้า ผู้ซื้อมีเวลา<b>ส่งของคืน</b> เท่านี้</TL>
            <TL time="5 วัน">หลังผู้ซื้อกรอกเลขพัสดุคืน ผู้ขายมีเวลา<b>ตรวจของคืน</b> — ไม่ตรวจ ระบบถือว่ารับแล้ว เงินคืนผู้ซื้ออัตโนมัติ</TL>
          </div>
          <Callout variant="note">ระบบจะแจ้งเตือนล่วงหน้าก่อนถึงเส้นตายเสมอ เพื่อให้มีเวลาตัดสินใจก่อนระบบตัดสินแทน</Callout>

          <H n={2}>สินค้าไม่ตรงปก / ชำรุด</H>
          <P><b>แจ้งปัญหาได้เฉพาะก่อนกดยืนยันรับสินค้าเท่านั้น</b> — เมื่อกดยืนยันรับแล้ว ถือว่าจบขั้นตอน เงินจะโอนให้ผู้ขายทันทีและไม่สามารถเปิดเคสย้อนหลังได้</P>
          <H3>หลักฐานที่ต้องแนบตอนเปิดเคส</H3>
          <ul style={{ paddingLeft: 20, margin: "0 0 10px" }}>
            <LI>คลิปวิดีโอตอน<b>เปิดกล่อง</b> 1 ไฟล์ (ไม่เกิน 90 วินาที ไม่เกิน 200MB) — ต้องเริ่มถ่ายตั้งแต่ก่อนแกะสินค้า ให้เห็นสภาพกล่องรอบด้าน</LI>
            <LI>รูปถ่ายจุดที่มีปัญหาอย่างน้อย 1 รูป</LI>
          </ul>
          <Callout variant="warn">💡 แนะนำผู้ขาย: ถ่ายคลิป/รูปตอนแพ็คของ และเก็บใบเสร็จขนส่งที่เห็นน้ำหนักพัสดุไว้เสมอ — เป็นหลักฐานสำคัญที่สุดหากเกิดข้อพิพาท</Callout>
          <P>แอดมินจะตัดสินโดยอ้างอิงจากข้อมูลและรูปสินค้า <b>ณ วันที่คุณสั่งซื้อ</b> (ระบบเก็บสำเนาไว้อัตโนมัติ) ไม่ใช่ประกาศที่ผู้ขายอาจแก้ไขในภายหลัง</P>

          <H n={3}>กล่องว่างเปล่า สินค้าเสียหาย หรือสูญหายระหว่างการขนส่ง</H>
          <P>คู่สัญญากับบริษัทขนส่งคือ<b>ผู้ขาย</b> ดังนั้นหากพบว่ากล่องว่างเปล่า สินค้าเสียหาย หรือสูญหายระหว่างการขนส่ง ผู้ซื้อจะได้รับเงินคืนเต็มจำนวนก่อนเสมอ แล้วให้ผู้ขายเป็นผู้ไปเคลมกับบริษัทขนส่งเอง (ไม่ใช่หน้าที่ผู้ซื้อ)</P>
          <div style={{ display: "flex", gap: 10, margin: "10px 0 16px" }}>
            <DecisionCard good label="ผลตัดสิน">คืนเงินผู้ซื้อเต็มจำนวน · ผู้ขายไปเคลมกับบริษัทขนส่งเอง</DecisionCard>
          </div>
          <Callout variant="warn">💡 แนะนำผู้ขาย: ทำประกันสินค้ากับบริษัทขนส่งนั้นๆ ทุกครั้งที่จัดส่ง เพื่อป้องกันความเสียหายจากกรณีนี้</Callout>

          <H n={4}>ยังไม่ได้รับสินค้า</H>
          <P>ใช้ตอน<b>ของยังไม่มาส่งถึงคุณเลย</b> ทั้งที่พ้นกำหนดวันส่งไปแล้ว (แยกปุ่มจากกรณี "สินค้าไม่ตรงปก/ชำรุด" ในข้อ 2 ที่ใช้ตอนของถึงมือแล้วแต่มีปัญหา)</P>
          <div style={{ display: "flex", gap: 10, margin: "10px 0 16px" }}>
            <DecisionCard good label="ใช้เคสนี้">ของยังไม่ถึงมือเลย ทั้งที่พ้นกำหนดส่งแล้ว</DecisionCard>
            <DecisionCard label="ไม่ใช่เคสนี้">ของถึงมือแล้ว แต่ชำรุด/ไม่ตรงปก → ใช้ข้อ 2 แทน</DecisionCard>
          </div>
          <P>เคสนี้จะพิจารณาแค่ว่า <b>"ของถึงมือคุณหรือยัง"</b> เท่านั้น ไม่เกี่ยวกับสภาพหรือคุณภาพสินค้า (ถ้าของถึงแล้วมีปัญหา ต้องเปิดเคสข้อ 2 ซึ่งต้องแนบคลิปเปิดกล่องแทน)</P>

          <H n={5}>คืนสินค้า และค่าจัดส่ง</H>
          <ul style={{ paddingLeft: 20, margin: "0 0 10px" }}>
            <LI>เมื่อแอดมินอนุมัติให้คืนสินค้า ผู้ซื้อต้องส่งคืนภายใน 5 วัน — เลยกำหนดถือว่าไม่คืน เงินไปทางผู้ขายตามปกติ</LI>
            <LI>ผู้ขายต้องตรวจสอบของที่คืนภายใน 5 วันหลังผู้ซื้อกรอกเลขพัสดุคืน — เงียบเกินกำหนด ระบบถือว่ารับของแล้ว เงินคืนผู้ซื้อทันที</LI>
            <LI><b>ค่าส่งคืน ผู้ซื้อเป็นผู้รับผิดชอบ</b> ส่วนเงินที่คืนให้ผู้ซื้อจะเป็นยอดเต็มรวมค่าส่งขาไปด้วย (ผู้ขายจึงเป็นฝ่ายรับผลกระทบค่าส่งขาไปที่จ่ายไปแล้ว)</LI>
            <LI>กรณีที่ชัดเจนว่าเป็นการฉ้อโกง (สินค้าปลอม สลับสินค้า กล่องว่างเปล่า) แอดมินสามารถสั่งคืนเงินได้โดยไม่ต้องให้ส่งของคืน</LI>
          </ul>
          <Callout variant="danger">การยอมรับกติกาข้อนี้ถือว่าเสร็จสิ้นตั้งแต่ตอนสมัครสมาชิกและย้ำอีกครั้งทุกครั้งที่เปิดเคส — <b>"เปลี่ยนใจ" ไม่ใช่เหตุผลที่ขอคืนสินค้าได้</b></Callout>

          <H n={6}>ผู้ขายไม่ส่งของ / ไม่ตอบสนอง</H>
          <P>หากผู้ขายไม่กรอกเลขพัสดุจนครบกำหนดส่ง ระบบจะยกเลิกออเดอร์อัตโนมัติและคืนเงินเต็มจำนวนให้ผู้ซื้อทันที พร้อมบันทึกสถิติ "ยกเลิกโดยผู้ขาย" แสดงบนหน้าโปรไฟล์ผู้ขายรายนั้น</P>

          <H n={7}>รีวิวสินค้าและผู้ขาย</H>
          <ul style={{ paddingLeft: 20, margin: "0 0 10px" }}>
            <LI>รีวิวได้เฉพาะออเดอร์ที่จบสมบูรณ์แล้วเท่านั้น — 1 ออเดอร์ = 1 รีวิว ภายใน 14 วันหลังจบ</LI>
            <LI>ให้คะแนนดาว เขียนข้อความ และแนบรูปได้ — <b>ลบรีวิวเองไม่ได้</b></LI>
            <LI>ผู้ขายตอบกลับรีวิวได้ 1 ครั้ง</LI>
            <LI>รีวิวที่ไม่เหมาะสมสามารถถูกรายงานให้ทีมงานตรวจสอบและซ่อนได้</LI>
            <LI>ออเดอร์ที่ได้รับเงินคืน (refunded) ไม่มีสิทธิ์รีวิว</LI>
          </ul>

          <H n={8}>บัญชีที่มีเงินค้างโอน</H>
          <P>หากมีคำสั่งซื้อที่ระบบโอนเงินให้คุณไม่ได้เพราะยังไม่ได้ผูกบัญชีรับเงิน ระบบจะ<b>บล็อกการลงขายสินค้าใหม่ทันที</b>จนกว่าจะกรอกข้อมูลยืนยันตัวตนและบัญชีรับเงินที่หน้า KYC ให้ครบถ้วน</P>
          <Callout variant="note">เงินของคุณจะไม่มีวันหายหรือถูกริบ — ระบบแจ้งเตือนซ้ำเป็นระยะและมีรายการเงินค้างโอนให้ตรวจสอบได้ที่แท็บการเงิน เมื่อผูกบัญชีสำเร็จ ทีมงานจะโอนซ้ำให้ทันที</Callout>

          <div style={{ fontSize: 12, color: C.muted, background: C.brandTint, borderRadius: 8, padding: "10px 14px", marginTop: 18 }}>
            หน้านี้อ้างอิงและสรุปจากข้อกำหนดการใช้บริการฉบับเต็ม — อ่านเพิ่มเติมที่ <Link href="/terms" style={{ color: C.brandDark, fontWeight: 700 }}>ข้อกำหนดการใช้บริการ</Link> และ <Link href="/privacy" style={{ color: C.brandDark, fontWeight: 700 }}>นโยบายความเป็นส่วนตัว</Link>
            · มีคำถามติดต่อ <a href="mailto:peem.tanakritpapha@gmail.com" style={{ color: C.brandDark, fontWeight: 700 }}>peem.tanakritpapha@gmail.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
