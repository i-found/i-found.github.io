# -*- coding: utf-8 -*-
"""全站动态视频统一转码脚本。

============================ 转 码 规 则 ============================
1. 保留完整时长，绝不截取。原片多长成片就多长。
2. 成片体积 ≈ 原片体积 × TARGET_SIZE_RATIO（默认 1/3）。
   用两遍 ABR 按目标体积倒算码率，实际误差通常在 ±5% 内。
3. 分辨率只降不升：超过 MAX_W×MAX_H 的源（4K / 2.5K）等比缩到 1080p，
   本来就是 1080p 及以下的保持原样。帧率一律保持原始，不抽帧。
4. 音轨一律去掉（DROP_AUDIO=True）。壁纸是无声播放的，音频轨纯属浪费体积。
5. 统一 H.264 High / yuv420p / faststart，保证浏览器边下边播。
6. 封面（vid/*.jpg）一律截视频第一帧，严格 -ss 0，不允许带任何偏移。
   全屏落下来先显示这张图、视频再从 0 秒开播，差一帧就会看到跳变。
====================================================================

用法：
    python _transcode_videos.py            # 全部重转
    python _transcode_videos.py 01 07 ...  # 只转指定的几号 corgi
"""
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
VID = os.path.join(ROOT, 'vid')
SRC = r'D:\个人网站\动态视频'

TARGET_SIZE_RATIO = 1 / 3     # 成片体积 = 原片 × 1/3
MAX_W, MAX_H = 1920, 1080     # 分辨率上限
DROP_AUDIO = True             # 去音轨
PRESET = 'fast'
MIN_BITRATE_KBPS = 250        # 码率下限，防止极端小片压成马赛克
GOP = 48

MUSIC_MAP = {
    'dark-night': '4、dark night.mp4',
    'within-monochrome': '10、Within Monochrome·作者Drioyard.mp4',
    'seaside-rain': '6、海边 雨中少女·作者Alex西瓜.mp4',
    'dark-leaf': '1、Dark Leaf·作者northway.mp4',
    'misty-valley': '2、Misty Valley·作者northway.mp4',
    'girl-ame-13': '3、girl ame 13·作者akiame秋雨.mp4',
    'firewatch-tower': '5、Black And White Firewatch Tower.mp4',
    'sandblack': '8、sandblack·作者\xa0Law D.Jhon.mp4',
    'temporal-acceleration': '9、Temporal Acceleration·作者northway.mp4',
    'anime-girl-night': '11、anime girl night·作者akiame秋雨.mp4',
    'moon-touch': '12、Moon Touch·作者ANWYES.mp4',
    'endless-pain': '13、Endless Pain·作者Vitti.mp4',
    'beyoud': '14、Beyoud·作者Vitti.mp4',
    'a-curse-paper-lily': '15、A Curse - Paper Lily·作者Starcasm.mp4',
    'feihua-rumeng': '无缝-星瞳藏刃 飞花入梦(2).mp4',
    'such-beautiful-eyes': '怎么会有这么美的眼睛！？_视频.mp4',
    'jianghu-years': '我行走江湖那些年_视频.mp4',
    'eye-strike': '绝美眼眸暴击，你有见过吗？_视频.mp4',
    'fairy-beauty': '这是什么神仙颜值，太美了！_视频.mp4',
    'sword-beauties': '一组刀剑美人图_视频.mp4',
}


def probe(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(r.stdout.strip())


def ffmpeg_has_force_divisible_by():
    r = subprocess.run(['ffmpeg', '-hide_banner', '-h', 'filter=scale'],
                       capture_output=True, text=True)
    return 'force_divisible_by' in r.stdout


SCALE = ('scale=%d:%d:force_original_aspect_ratio=decrease' % (MAX_W, MAX_H))
if ffmpeg_has_force_divisible_by():
    SCALE += ':force_divisible_by=2'


def transcode(src, out, label):
    if not os.path.exists(src):
        print('  源文件不存在: %s' % src)
        return False
    dur = probe(src)
    src_size = os.path.getsize(src)
    # 已经转过的（体积明显小于原片）直接跳过，支持断点续跑
    if os.path.exists(out) and os.path.getsize(out) < src_size * 0.55:
        return False
    target_bytes = src_size * TARGET_SIZE_RATIO
    vkbps = max(MIN_BITRATE_KBPS, int(target_bytes * 8 / dur / 1000 * 0.985))

    tmp = out + '.part.mp4'
    logdir = tempfile.mkdtemp(prefix='x264pass_')
    log = os.path.join(logdir, 'pass')
    base = ['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', SCALE,
            '-c:v', 'libx264', '-preset', PRESET, '-profile:v', 'high',
            '-pix_fmt', 'yuv420p', '-b:v', '%dk' % vkbps, '-maxrate', '%dk' % int(vkbps * 1.6),
            '-bufsize', '%dk' % int(vkbps * 3), '-g', str(GOP), '-passlogfile', log]
    if DROP_AUDIO:
        base += ['-an']

    # 两遍编码的编码参数必须完全一致（x264 的 stats 是按同一套参数算的），
    # 所以 pass1 不能偷偷换 preset，否则 pass2 直接报 -22 写出空文件。
    r1 = subprocess.run(base + ['-pass', '1', '-f', 'null', os.devnull], capture_output=True)
    if r1.returncode != 0:
        print('  pass1 失败: %s' % r1.stderr.decode('utf-8', 'ignore')[-200:])
        return False
    r2 = subprocess.run(base + ['-pass', '2', '-movflags', '+faststart', tmp], capture_output=True)
    if r2.returncode != 0:
        print('  pass2 失败: %s' % r2.stderr.decode('utf-8', 'ignore')[-200:])
        return False

    os.replace(tmp, out)
    new_size = os.path.getsize(out)
    print('  %-22s %6.1fs  %7.2f MB -> %6.2f MB (%4.1f%%)  %5d kbps'
          % (label, dur, src_size / 1048576, new_size / 1048576,
             new_size / src_size * 100, vkbps))
    return True


def poster(mp4, jpg, w, h, square=False):
    """封面必须严格取视频第一帧，禁止 -ss。
    全屏时先显示这张图、紧接着视频从 0 秒开播，两者只要不是同一帧就会跳一下。"""
    vf = 'crop=ih:ih,scale=%d:%d' % (w, h) if square else \
         'scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d' % (w, h, w, h)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-frames:v', '1',
                    '-vf', vf, '-q:v', '2', jpg], capture_output=True)


def main():
    only = set(sys.argv[1:])
    done = 0
    for line in open(os.path.join(ROOT, '_corgi_map.txt'), encoding='utf-8'):
        if not line.strip():
            continue
        num, name = line.rstrip('\n').split('\t')
        if only and num not in only:
            continue
        out = os.path.join(VID, 'corgi-%s.mp4' % num)
        if transcode(os.path.join(SRC, name), out, 'corgi-%s' % num):
            poster(out, os.path.join(VID, 'corgi-%s.jpg' % num), 1920, 1080)
            done += 1

    if not only:
        for key, name in MUSIC_MAP.items():
            out = os.path.join(VID, key + '.mp4')
            if transcode(os.path.join(SRC, name), out, key):
                poster(out, os.path.join(VID, key + '.jpg'), 1920, 1080)
                poster(out, os.path.join(VID, key + '-disc.jpg'), 480, 480, square=True)
                done += 1
    print('完成 %d 条' % done)


if __name__ == '__main__':
    main()
