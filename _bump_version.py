# -*- coding: utf-8 -*-
"""站点版本号 +1 入口（规则见 _workflow.py）。

约定：末位是发布序号，V1.10.00 → V1.10.01 → … → V1.10.99 → V1.11.00，
每推送一次 +1，主版本手动改。

    python _bump_version.py           # 等价 _workflow.py bump
    python _bump_version.py --show    # 只打印当前版本，不改文件
"""
import sys

from _workflow import main

if __name__ == '__main__':
    sys.exit(main(['bump'] + sys.argv[1:]))
