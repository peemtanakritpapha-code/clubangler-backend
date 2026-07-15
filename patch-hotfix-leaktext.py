# patch-hotfix-leaktext.py — HOTFIX: ลบ "// EXTEND-REASON" ที่หลุดไปแสดงเป็นข้อความบนเว็บ
# สาเหตุ: คอมเมนต์อยู่นอกวงเล็บ {} ในตำแหน่ง JSX children ทำให้กลายเป็นข้อความจริงที่ต้องแสดง
# รันจาก root: python patch-hotfix-leaktext.py
import io

PATH = "app/orders/[id]/OrderDetailClient.js"
DONE_MARKER = "HOTFIX-LEAKTEXT"

def read(p):
    with io.open(p, "r", encoding="utf-8", newline="") as f: return f.read()

def write(p, s):
    with io.open(p, "w", encoding="utf-8", newline="") as f: f.write(s)

def eol_of(src):
    return "\r\n" if "\r\n" in src else "\n"

s = read(PATH)
if DONE_MARKER in s:
    print("SKIP: ถูกแก้ไปแล้ว")
else:
    EOL = eol_of(s)
    old = "              </div>" + EOL + "            </div>" + EOL + "          )} // EXTEND-REASON"
    n = s.count(old)
    assert n == 1, "ANCHOR ERROR: พบ %d จุด (ต้องการ 1) — หยุด แจ้ง Claude" % n
    new = "              </div>" + EOL + "            </div>" + EOL + "          )} {/* " + DONE_MARKER + " */}"
    s = s.replace(old, new)
    write(PATH, s)
    print("PATCHED OK: %s [EOL=%s] — ลบข้อความที่หลุดเรียบร้อย" % (PATH, "CRLF" if EOL == "\r\n" else "LF"))
