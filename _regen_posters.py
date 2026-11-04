# -*- coding: utf-8 -*-
"""按 _transcode_videos.py 的规则重截全部封面：严格视频第一帧。
视频不重新转码，只覆盖 vid/*.jpg。"""
import glob
import os
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, ROOT)
from _transcode_videos import poster  # noqa: E402  规则只保留一份

VID = os.path.join(ROOT, 'vid')

done = missing = 0
for jpg in sorted(glob.glob(os.path.join(VID, '*.jpg'))):
    if jpg.endswith('-disc.jpg'):
        mp4 = jpg[:-len('-disc.jpg')] + '.mp4'
        w, h, square = 480, 480, True
    else:
        mp4 = jpg[:-4] + '.mp4'
        w, h, square = 1920, 1080, False
    if not os.path.exists(mp4):
        print('  没有视频: %s' % os.path.basename(jpg))
        missing += 1
        continue
    poster(mp4, jpg, w, h, square=square)
    done += 1
print('重截 %d 张，缺视频 %d 张' % (done, missing))
