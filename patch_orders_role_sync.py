# patch_orders_role_sync.py — แก้บั๊ก: กดเมนู ?role= ระหว่างหน้าเปิดอยู่แล้วบทบาทไม่สลับ
# วิธีใช้: วางที่รากโปรเจกต์ แล้วรัน  python patch_orders_role_sync.py
import io

PATH = "app/orders/OrdersClient.js"

OLD_IMPORT = 'import { useMemo, useState } from "react";'
NEW_IMPORT = 'import { useEffect, useMemo, useState } from "react";'

ANCHOR = 'const [quick, setQuick] = useState(null);'
INSERT = (
    "\n  // \u0e40\u0e21\u0e19\u0e39 dropdown \u0e2a\u0e48\u0e07 ?role= \u0e21\u0e32\u0e23\u0e30\u0e2b\u0e27\u0e48\u0e32\u0e07\u0e17\u0e35\u0e48\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e1b\u0e34\u0e14\u0e2d\u0e22\u0e39\u0e48 \u2014 state \u0e44\u0e21\u0e48\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15\u0e40\u0e2d\u0e07\u0e15\u0e2d\u0e19 client nav \u0e15\u0e49\u0e2d\u0e07 sync \u0e15\u0e32\u0e21 prop"
    "\n  useEffect(() => { setRole(initialRole === \"sell\" ? \"sell\" : \"buy\"); setTab(\"\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14\"); setQuick(null); }, [initialRole]);"
)

src = io.open(PATH, "r", encoding="utf-8", newline="").read()
assert src.count(OLD_IMPORT) == 1, "import line not found — abort"
assert src.count(ANCHOR) == 1, "anchor not found — abort"
assert "sync \u0e15\u0e32\u0e21 prop" not in src, "already patched — abort"

src = src.replace(OLD_IMPORT, NEW_IMPORT, 1)
i = src.index(ANCHOR)
line_end = src.index("\n", i)
src = src[:line_end] + INSERT + src[line_end:]

io.open(PATH, "w", encoding="utf-8", newline="").write(src)
print("OK: patched", PATH)
