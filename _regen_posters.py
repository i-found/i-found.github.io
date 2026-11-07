# -*- coding: utf-8 -*-
"""封面重截入口（规格见 _workflow.py）：严格视频第一帧，视频不重新转码。

    python _regen_posters.py     # 等价 _workflow.py posters
"""
import sys

from _workflow import main

if __name__ == '__main__':
    sys.exit(main(['posters']))
