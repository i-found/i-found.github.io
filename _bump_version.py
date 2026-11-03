# -*- coding: utf-8 -*-
"""把首页导航栏的站点版本号 +1 —— 每次推送前跑一次，刷新页面看到的就是唯一版本。

约定
  末位是发布序号：V1.10.00 → V1.10.01 → … → V1.10.99 → V1.11.00
  也就是每推送一次 +1，满 100 进位到次版本，主版本手动改。

用法
  python _bump_version.py           # 版本号 +1 并写回 index.html
  python _bump_version.py --show    # 只打印当前版本，不改文件
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(ROOT, "index.html")
PAT = re.compile(r'(<span class="site-version" id="siteVersion">)V(\d+)\.(\d+)\.(\d+)(</span>)')


def main():
    if not os.path.isfile(INDEX):
        print("找不到 index.html")
        return 1
    text = open(INDEX, encoding="utf-8").read()
    m = PAT.search(text)
    if not m:
        print('没找到版本号标记 <span class="site-version" id="siteVersion">V1.10.00</span>')
        return 1

    major, minor, patch = int(m.group(2)), int(m.group(3)), int(m.group(4))
    cur = "V%d.%d.%02d" % (major, minor, patch)
    if "--show" in sys.argv:
        print(cur)
        return 0

    patch += 1
    if patch > 99:
        patch = 0
        minor += 1
    new = "V%d.%d.%02d" % (major, minor, patch)

    new_text = PAT.sub(lambda mm: "%s%s%s" % (mm.group(1), new, mm.group(5)), text, count=1)
    raw = open(INDEX, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    open(INDEX, "wb").write(new_text.encode("utf-8-sig" if bom else "utf-8"))
    print("%s → %s" % (cur, new))
    return 0


if __name__ == "__main__":
    sys.exit(main())
