# -*- coding: utf-8 -*-
"""静态资源自动打版本号（内容哈希）—— 改完页面/脚本/图片后跑一次即可。

为什么需要
  GitHub Pages + Cloudflare 对 .js/.css/.mp4/.jpg 都带 Cache-Control: max-age=14400（4 小时）。
  文件内容变了但 URL 不变，浏览器 4 小时内不会重新下载 → 页面看着像"没生效"。
  在 URL 后挂 ?v=<文件内容哈希> 之后就变成：
    文件没改 → 哈希不变 → URL 不变 → 继续用缓存（不浪费流量）
    文件改了 → 哈希变   → URL 变   → 浏览器必然重新下载
  所以以后不用再手工 +1 版本号，也不需要在 DevTools 里勾"停用缓存"。

覆盖范围
  1) 根目录所有 *.html、Albums/*/index.html 里的 src="..." / href="..." 本地资源
  2) js/video-bg.js 与 music.html 里用字符串写的媒体路径（vid/、../../vid/、Albums/…/img/、img/）

用法
  python _stamp_version.py            # 扫描并打号，列出改动的文件和找不到的引用
  幂等：连续跑两次，第二次一定是"无".
"""
import hashlib
import os
import re
import sys
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))
EXTS = "mp4|jpe?g|png|webp|gif|js|css"
MEDIA_EXTS = "mp4|jpe?g|png|webp|gif"

# <script src="x.js"> / <link href="x.css"> / <img src="x.png">
ATTR_REF = re.compile(r'\b(src|href)="([^"?]+\.(?:%s))(?:\?[^"]*)?"' % EXTS)
# 写在 JS 字符串里的资源： "vid/x.mp4" / "./vid/x.mp4" / "../../vid/x.jpg" / "Albums/…/img/x.png"
STR_REF = re.compile(r'"((?:\./|\.\./)*(?:vid|img|Albums)/[^"?]+\.(?:%s))(?:\?[^"]*)?"' % MEDIA_EXTS)

_cache = {}
missing = []


def digest(path):
    if path not in _cache:
        _cache[path] = hashlib.md5(open(path, "rb").read()).hexdigest()[:8]
    return _cache[path]


def resolve(base, rel):
    """先按所在目录解析，再退回站点根目录（解决 js/ 里写 ../../vid/ 这种）"""
    p = os.path.normpath(os.path.join(base, rel))
    if os.path.isfile(p):
        return p
    # 去掉开头的 ../../ 后按站点根目录找
    stripped = re.sub(r'^(?:\.\./)+', '', rel.replace("\\", "/"))
    p = os.path.normpath(os.path.join(ROOT, stripped))
    if os.path.isfile(p):
        return p
    return None


def stamp(fp, pattern, keep_attr):
    base = os.path.dirname(fp)
    text = open(fp, encoding="utf-8").read()

    def repl(m):
        if keep_attr:
            attr, rel = m.group(1), m.group(2)
            head = '%s="' % attr
        else:
            rel = m.group(1)
            head = '"'
        if rel.startswith(("http:", "https:", "//", "/", "data:")):
            return m.group(0)   # 外链与站点根绝对路径不打号（如 /follow.js 由站点根提供）
        target = resolve(base, rel)
        if not target:
            tag = os.path.relpath(fp, ROOT) + " -> " + rel
            if tag not in missing:
                missing.append(tag)
            return m.group(0)
        return '%s%s?v=%s"' % (head, rel, digest(target))

    return pattern.sub(repl, text)


def write(fp, text):
    raw = open(fp, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    new = text.encode("utf-8-sig" if bom else "utf-8")
    if new == raw:
        return False
    open(fp, "wb").write(new)
    return True


def run_once():
    _cache.clear()   # 上一轮可能刚改写文件，缓存里的哈希必须失效
    changed = []
    html_files = glob.glob(os.path.join(ROOT, "*.html")) + \
        glob.glob(os.path.join(ROOT, "Albums", "*", "index.html"))

    for fp in sorted(set(html_files)):
        t = stamp(fp, ATTR_REF, True)
        if write(fp, t):
            changed.append(os.path.relpath(fp, ROOT))

    # 这几处把媒体路径写在 JS 字符串里，属性正则扫不到
    for rel in ("index.html", "js/video-bg.js", "js/home-wallpapers.js", "music.html"):
        fp = os.path.join(ROOT, *rel.split("/"))
        if os.path.isfile(fp):
            t = stamp(fp, STR_REF, False)
            if write(fp, t):
                if rel not in changed:
                    changed.append(rel)
    return changed


def main():
    # 改了 video-bg.js 之后，引用它的 html 哈希也会变，所以要反复跑到稳定
    changed = []
    for _ in range(4):
        c = run_once()
        if not c:
            break
        for x in c:
            if x not in changed:
                changed.append(x)

    print("已更新: %s" % (", ".join(changed) if changed else "无（都是最新）"))
    if missing:
        print("找不到文件（未打号，检查路径）:")
        for m in missing[:20]:
            print("  -", m)
        if len(missing) > 20:
            print("  ... 共 %d 条" % len(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
