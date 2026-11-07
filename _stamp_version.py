# -*- coding: utf-8 -*-
"""静态资源打版本号入口（规则见 _workflow.py）。

覆盖 html / js 里引用的本地资源，以及写死在 JS 里的 Cloudflare R2 媒体地址
（https://media.meimei.qzz.io/vid/x.mp4?v=…，哈希取本地同名文件内容 md5 前 8 位）。

    python _stamp_version.py     # 等价 _workflow.py stamp
"""
import sys

from _workflow import main

if __name__ == '__main__':
    sys.exit(main(['stamp']))
