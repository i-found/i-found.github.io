# -*- coding: utf-8 -*-
"""视频转码入口（规则与参数都不在这里，见 _workflow.py）。

转码规则、画质策略、封面规格、素材清单统一定义在 _workflow.py，
本文件只是保留老命令行的兼容入口：

    python _transcode_videos.py            # 等价 _workflow.py media
    python _transcode_videos.py 01 07 ...  # 只转指定的几号 corgi
    python _transcode_videos.py --profile=balanced   # 用老的 1/3 体积规则
"""
import sys

from _workflow import main

if __name__ == '__main__':
    sys.exit(main(['media'] + sys.argv[1:]))
