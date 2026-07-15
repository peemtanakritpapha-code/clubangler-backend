# -*- coding: utf-8 -*-
# patch-loadmore.py — D4 LOADMORE
#   ฟีด: ปุ่ม "ดูเพิ่มเติม" โหลดโพสต์ต่อทีละ 40 (query ชุดเดียวกับ server + กันซ้ำด้วย id + ดึงสถานะไลก์ของชุดใหม่)
#   ตลาด: แบ่งหน้า ?page= ทีละ 60 — ปุ่ม "ดูเพิ่มเติม" เป็นลิงก์จริง Google เดินตามได้ (สูตร Shopee/Mercari)
#   หมายเหตุ: หน้าหมวด /market/[cat] ยังไม่แตะรอบนี้ (ข้อมูลต่อหมวดยังน้อย — จดไว้เป็นงานต่อ)
# กติกา: anchor บรรทัดเดียว + assert count == 1 + ช่วงแบบโปรแกรมเมื่อจำเป็น + marker LOADMORE + all-or-nothing
# วิธีรัน: py patch-loadmore.py

import io, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
FEED = os.path.join(ROOT, "app", "FeedClient.js")
MKT  = os.path.join(ROOT, "app", "market", "page.js")

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()
def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)
def L(*lines):
    return "\r\n".join(lines)

for p in (FEED, MKT):
    if "LOADMORE" in read(p):
        print("SKIP: พบ marker LOADMORE ใน", os.path.relpath(p, ROOT), "— เคยรันแล้ว ไม่ทำซ้ำ"); sys.exit(0)

FEED_STATE = L(
'export default function FeedClient({ posts, latest, user, myLikes, myFollows, myProducts, myBlocks }) {',
'  // LOADMORE: โหลดโพสต์ต่อทีละ 40 — query ชุดเดียวกับ app/page.js เป๊ะ (Iron Rule: FK ระบุเส้นทางชัด)',
'  const [morePosts, setMorePosts] = useState([]);',
'  const [moreLikes, setMoreLikes] = useState([]);',
'  const [feedEnd, setFeedEnd] = useState(posts.length < 40);',
'  const [loadingMore, setLoadingMore] = useState(false);',
'  const loadMore = async () => {',
'    if (loadingMore || feedEnd) return;',
'    setLoadingMore(true);',
'    const sb = createClient();',
'    const off = posts.length + morePosts.length;',
'    const { data } = await sb.from("posts")',
'      .select("*, profiles!posts_author_id_fkey(name, is_shop, avatar_path), products(id, name, price, images), post_likes(count), post_comments(count)")',
'      .neq("status", "removed")',
'      .order("created_at", { ascending: false })',
'      .range(off, off + 39);',
'    if ((data || []).length < 40) setFeedEnd(true);',
'    const seen = new Set([...posts, ...morePosts].map(x => x.id));',
'    const fresh = (data || []).filter(x => !seen.has(x.id)); // กันซ้ำ (มีโพสต์ใหม่แทรกทำ offset ขยับ)',
'    if (fresh.length && user) {',
'      const { data: lk } = await sb.from("post_likes").select("post_id").eq("user_id", user.id).in("post_id", fresh.map(x => x.id));',
'      setMoreLikes(l => [...l, ...(lk || []).map(x => x.post_id)]);',
'    }',
'    setMorePosts(l => [...l, ...fresh]);',
'    setLoadingMore(false);',
'  };')

FEED_BUTTON = L(
'',
'        {/* LOADMORE: ปุ่มดูเพิ่มเติม — โหลดจนหมดแล้วปุ่มหาย */}',
'        {!feedEnd && (',
'          <button onClick={loadMore} disabled={loadingMore}',
'            style={{ height: 44, borderRadius: 999, border: `1.5px solid ${C.brand}`, background: "#fff", color: C.brand, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>',
'            {loadingMore ? "กำลังโหลด..." : "ดูเพิ่มเติม"}',
'          </button>',
'        )}')

MKT_PAGER = L(
'      {/* LOADMORE: แบ่งหน้าแบบลิงก์จริง — Google เดินตามเก็บสินค้าได้ทุกหน้า */}',
'      <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "6px 0 26px" }}>',
'        {page > 1 && (',
'          <a href={page === 2 ? "/market" : `/market?page=${page - 1}`}',
'            style={{ height: 44, lineHeight: "44px", padding: "0 22px", borderRadius: 999, border: "1.5px solid #E5E9EA", background: "#fff", color: "#6B7678", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>‹ ก่อนหน้า</a>',
'        )}',
'        {hasMore && (',
'          <a href={`/market?page=${page + 1}`}',
'            style={{ height: 44, lineHeight: "44px", padding: "0 26px", borderRadius: 999, border: "1.5px solid #0E7E8C", background: "#fff", color: "#0E7E8C", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>ดูเพิ่มเติม ›</a>',
'        )}',
'      </div>')

EDITS = [
    # ── ฟีด ──
    (FEED,
     'export default function FeedClient({ posts, latest, user, myLikes, myFollows, myProducts, myBlocks }) {',
     FEED_STATE, 1),
    (FEED,
     'const list = useMemo(() => posts.filter(p => {',
     'const list = useMemo(() => [...posts, ...morePosts].filter(p => { // LOADMORE: รวมชุดที่โหลดเพิ่ม', 1),
    (FEED,
     '  }), [posts, filter, myFollows, user, blocks]);',
     '  }), [posts, morePosts, filter, myFollows, user, blocks]);', 1),
    (FEED,
     'liked0={myLikes.includes(p.id)} following0={myFollows.includes(p.author_id)}',
     'liked0={myLikes.includes(p.id) || moreLikes.includes(p.id)} following0={myFollows.includes(p.author_id)}', 1),
    # ── ตลาด ──
    (MKT,
     'export default async function MarketPage() {',
     L('export default async function MarketPage({ searchParams }) { // LOADMORE',
       '  const sp = await searchParams; // Next 15+: searchParams เป็น Promise ต้อง await',
       '  const page = Math.max(1, parseInt(sp?.page, 10) || 1);',
       '  const PER = 60;'), 1),
    (MKT,
     '    .limit(60);',
     '    .range((page - 1) * PER, page * PER); // LOADMORE: ดึงเกินไว้ 1 ชิ้นเพื่อเช็คว่ามีหน้าถัดไป', 1),
    (MKT,
     '  const rows = (products || []).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));',
     L('  const hasMore = (products || []).length > PER; // LOADMORE',
       '  const rows = (products || []).slice(0, PER).map(p => ({ ...p, seller: sellerMap[p.seller_id] || null }));'), 1),
    (MKT,
     '<MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} catBar={<CatSlider title="ช้อปตามหมวดหมู่" auto />} />',
     '<MarketClient products={rows} loggedIn={!!user} extraBrands={extraBrands} catBar={<CatSlider title="ช้อปตามหมวดหมู่" auto />} />\r\n' + MKT_PAGER, 1),
]

# ═══ ตรวจก่อนแตะ ═══
contents = {p: read(p) for p in (FEED, MKT)}
for path, old, _new, expect in EDITS:
    n = contents[path].count(old)
    assert n == expect, "anchor คาด %d เจอ %d ใน %s: %s" % (expect, n, os.path.relpath(path, ROOT), old[:60])

# ปุ่มฟีด: หาจุดปิด list.map แบบโปรแกรม (บรรทัด "))}" ตัวแรกหลัง {list.map)
f = contents[FEED]
i0 = f.index('{list.map(p => (')
i1 = f.index('\r\n        ))}', i0)
assert 0 < i1 - i0 < 700, "ช่วง list.map ยาวผิดปกติ"
ins = i1 + len('\r\n        ))}')

# ═══ ลงมือ ═══
f = f[:ins] + FEED_BUTTON + f[ins:]
for path, old, new, _e in EDITS:
    src = f if path == FEED else contents[MKT]
    src = src.replace(old, new, 1)
    if path == FEED: f = src
    else: contents[MKT] = src
write(FEED, f)
print("OK: patch app/FeedClient.js")
write(MKT, contents[MKT])
print("OK: patch app/market/page.js")
print("DONE: LOADMORE ครบ 2 ไฟล์ — ต่อไป: npm run build")
