# -*- coding: utf-8 -*-
"""生成 js/pinyin-data.js：汉字 → 拼音（无声调），按拼音分组，省体积。"""
import json
import os

from pypinyin import lazy_pinyin

ROOT = os.path.dirname(os.path.abspath(__file__))

chars = []
seen = set()
for hi in range(0xB0, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            c = bytes([hi, lo]).decode('gb2312')
        except Exception:
            continue
        if '\u4e00' <= c <= '\u9fff' and c not in seen:
            seen.add(c)
            chars.append(c)

groups = {}
for c in chars:
    py = lazy_pinyin(c)[0]
    if not py.isalpha():
        continue
    groups.setdefault(py.lower(), []).append(c)

data = {py: ''.join(sorted(set(cs))) for py, cs in sorted(groups.items())}

js = '/* 汉字 → 拼音（无声调），按拼音分组存，省体积。由 pypinyin 生成，勿手改。 */\n'
js += 'window.PINYIN_DICT = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'

out = os.path.join(ROOT, 'js', 'pinyin-data.js')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)

print('%d 字 / %d 音节 / %.1f KB' % (len(chars), len(data), len(js.encode('utf-8')) / 1024.0))
