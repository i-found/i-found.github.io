# -*- coding: utf-8 -*-
"""全站媒体与发布工作流的唯一权威定义。

一次「上新视频」要做的事情，全部在这个文件里定义，别再散到别的脚本：

    1) 转码   SRC 里的原始视频  ->  vid/*.mp4
    2) 封面   vid/*.mp4         ->  vid/*.jpg（全屏首帧）+ vid/*-disc.jpg（1:1 唱片图）
    3) 打号   页面 / JS 里的 ?v=  ->  文件内容 md5 前 8 位（本地资源 + R2 资源都算）
    4) 版本   首页 V1.10.xx +1
    5) 发布   git add / commit / push

============================ 画 质 策 略 ============================
QUALITY（默认 'best'）只决定用 PROFILES 里的哪一组数字，脚本其他地方没有任何魔法参数。

best —— 最高画质，体积不作为约束（默认）
    1. 分辨率上限 2K（MAX_W×MAX_H = 2560×1440，竖屏素材自动对调为 1440×2560）：
       长边不超过 2560、短边不超过 1440。超出的源（4K）等比缩到这个盒子里，
       没超的（1080p / 2K）原样保留，绝不放大。
    2. 源已经是 H.264 / yuv420p，且不超过上述上限 -> 直接流复制，画质等于源，
       体积≈源。这类片源码率往往只有 2~3 Mbps，压到 1/3 就是肉眼可见的糊。
    3. 其他源（4K、HEVC、10bit…）-> 保持原始帧率，CRF 18 + preset slow 质量优先编码；
       不按目标体积倒算码率。
    4. 音轨一律去掉（壁纸是无声播放的，音频轨只占体积，不影响画质）。
    5. 统一 H.264 High / yuv420p / faststart，保证浏览器边下边播。

balanced —— 旧的「1080p 上限 + 原片 1/3 体积」两遍 ABR 规则
    只在确实要省流量、牺牲画质时才用：python _workflow.py media --profile balanced

============================ 封 面 规 格 ============================
POSTER_* 里的尺寸。封面必须严格取视频第一帧，禁止 -ss 偏移：
全屏时先显示这张图、紧接着视频从 0 秒开播，两者只要不是同一帧就会跳一下。

============================ R 2 约 定 ============================
mp4 不进仓库（.gitignore），传到 Cloudflare R2，URL 形如
    https://media.meimei.qzz.io/vid/corgi-01.mp4?v=<本地文件 md5 前 8 位>
这个 ?v= 以前靠手改，现在由第 3 步按本地文件哈希自动维护；本地没有对应文件时原样保留。

上传走 rclone（`python _workflow.py upload`），需要先 `rclone config` 配好 R2 的 S3 remote，
再把文件顶部的 UPLOAD_REMOTE / UPLOAD_BUCKET / UPLOAD_PREFIX 改成自己的名字。
?v= 取的是本地文件哈希，只有「R2 上的字节 == 本地文件」时缓存击穿才准确，
所以顺序固定为：转码 -> 上传 -> 打号 -> 版本号 -> push。

============================ 用 法 ============================
    python _workflow.py status             # 看当前画质策略 / 版本号 / 待提交文件
    python _workflow.py media              # 1) 转码全部视频
    python _workflow.py media 01 07        #    只转指定的 corgi 编号
    python _workflow.py posters            # 2) 重截全部封面
    python _workflow.py upload             # 3) 把 vid/*.mp4 传上 R2（rclone，--dry-run 可预演）
    python _workflow.py stamp              # 4) 打版本号（本地 + R2）
    python _workflow.py bump               # 5) 站点版本号 +1
    python _workflow.py release            # 1、2、4、5 按顺序跑完，不提交
    python _workflow.py push "提交说明"     # 6) 提交并推送（代理挂了自动改直连重试）

断点续跑：转码结果记录在 _workflow_state.json（不进仓库）。只有「源没动 + 画质参数没变」
才会跳过，所以改了 PROFILES 之后重新跑会老老实实全部重转。
"""
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
VID = os.path.join(ROOT, 'vid')
SRC = r'D:\个人网站\动态视频'
STATE = os.path.join(ROOT, '_workflow_state.json')

# ====================== 1. 画质策略 ======================
QUALITY = 'best'

PROFILES = {
    # 最高画质：不重编码，或质量优先 CRF；分辨率上限 2K（竖屏素材脚本里自动对调）
    'best': {
        'mode': 'crf',        # crf | abr | copy
        'crf': 18,            # x264 视觉无损档；数字越小越清晰、体积越大
        'preset': 'slow',
        'max_w': 2560,        # 2K 横屏上限：长边 2560、短边 1440
        'max_h': 1440,
        'gop': 48,
        'audio': False,
    },
    # 旧的省流量规则：1080p 上限 + 原片 1/3 体积两遍 ABR
    'balanced': {
        'mode': 'abr',
        'size_ratio': 1 / 3,
        'max_w': 1920,
        'max_h': 1080,
        'preset': 'fast',
        'min_kbps': 250,
        'gop': 48,
        'audio': False,
    },
}

# ====================== 2. 封面规格 ======================
POSTER_FULL = (1920, 1080)   # 全屏首帧
POSTER_DISC = (480, 480)     # 圆形唱片封面（1:1）
POSTER_QUALITY = 2           # ffmpeg -q:v，2 ≈ 视觉无损

# ====================== 3. 站点版本号 ======================
INDEX = os.path.join(ROOT, 'index.html')
VERSION_PAT = re.compile(r'(<span class="site-version" id="siteVersion">)V(\d+)\.(\d+)\.(\d+)(</span>)')
VERSION_STEP = 100           # 末位满 100 进次版本

# ====================== 4. 打版本号 ======================
MEDIA_BASE = 'https://media.meimei.qzz.io'
EXTS = 'mp4|m4a|mp3|ogg|jpe?g|png|webp|gif|js|css'
MEDIA_EXTS = 'mp4|m4a|mp3|ogg|jpe?g|png|webp|gif'

# <script src="x.js"> / <link href="x.css"> / <img src="x.png"> / <video poster="x.jpg">
ATTR_REF = re.compile(r'\b(src|href|poster)="([^"?]+\.(?:%s))(?:\?[^"]*)?"' % EXTS)
# 写在 JS 字符串里的本地资源： "vid/x.mp4" / "../../vid/x.jpg"
STR_REF = re.compile(r'"((?:\./|\.\./)*(?:vid|img|Albums)/[^"?]+\.(?:%s))(?:\?[^"]*)?"' % MEDIA_EXTS)
# 写在 JS 字符串里的 R2 资源： "https://media.meimei.qzz.io/vid/x.mp4?v=..."
ABS_REF = re.compile(r'%s/([^"\'?\s)]+?\.(?:%s))(?:\?v=[0-9a-f]+)?'
                     % (re.escape(MEDIA_BASE), MEDIA_EXTS))
# 需要扫 ?v= 的文件：所有 html + 所有 js
STAMP_FILES = ('*.html', 'Albums/*/index.html', 'js/*.js')

# ====================== 5. R2 上传 ======================
# rclone 的 remote 名（`rclone config` 里自己起的）与桶名，按本机配置填。
# 上传前会先校验 remote / 桶是否存在，名字不对会直接告诉你现有的是哪些。
UPLOAD_REMOTE = 'r2'      # 例如 rclone config 里叫 r2 / r2media / cloudflare
UPLOAD_BUCKET = 'media'   # R2 桶名
UPLOAD_PREFIX = 'vid'     # 桶内前缀：本地 vid/x.mp4 -> <桶>/vid/x.mp4

# ====================== 6. 素材清单 ======================
# 壁纸视频：_corgi_map.txt 每行「编号 \t 源文件名」
CORGI_MAP = os.path.join(ROOT, '_corgi_map.txt')

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


# ======================================================================
# 小工具
# ======================================================================
def run(cmd, check=True):
    r = subprocess.run(cmd, capture_output=True, encoding='utf-8', errors='ignore')
    if check and r.returncode != 0:
        raise SystemExit('命令失败: %s\n%s' % (cmd[0], (r.stderr or '')[-400:]))
    return r


def profile(name=None):
    name = name or QUALITY
    if name not in PROFILES:
        raise SystemExit('未知画质策略: %s（可选 %s）' % (name, '/'.join(PROFILES)))
    return PROFILES[name]


def profile_tag(p):
    """画质参数指纹：参数一变，指纹就变，断点续跑就不会误判「已完成」。"""
    return hashlib.md5(json.dumps(p, sort_keys=True).encode()).hexdigest()[:8]


def probe_duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'csv=p=0', path], check=False)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 0.0


def probe_video(path):
    """取视频流编码信息。用 default=nw=1 拿「键=值」，csv 的字段顺序不保证是请求顺序。"""
    r = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
             '-show_entries', 'stream=codec_name,pix_fmt,width,height,bit_rate',
             '-of', 'default=nw=1', path], check=False)
    d = {}
    for line in (r.stdout or '').strip().splitlines():
        if '=' in line:
            k, v = line.split('=', 1)
            d[k.strip()] = v.strip()
    if 'codec_name' not in d or 'width' not in d:
        return None
    try:
        return {'codec': d['codec_name'], 'pix': d.get('pix_fmt', ''),
                'w': int(d['width']), 'h': int(d['height']),
                'kbps': int(d.get('bit_rate', 0) or 0) // 1000}
    except (ValueError, KeyError):
        return None


_FFMPEG_SCALE_OPTS = None


def _ffmpeg_scale_opts():
    global _FFMPEG_SCALE_OPTS
    if _FFMPEG_SCALE_OPTS is None:
        r = run(['ffmpeg', '-hide_banner', '-h', 'filter=scale'], check=False)
        _FFMPEG_SCALE_OPTS = 'force_divisible_by' in (r.stdout or '')
    return _FFMPEG_SCALE_OPTS


def box(p, info=None):
    """分辨率上限盒子（横屏 2560×1440）。
    竖屏素材自动对调成 1440×2560，让「长边 ≤ 2560、短边 ≤ 1440」对横竖两个方向都成立，
    免得竖屏片子只按 1440 高度被砍成 810×1440。
    """
    w, h = p.get('max_w'), p.get('max_h')
    if not w and not h:
        return None, None
    if info and info['h'] > info['w'] and w and h and w > h:
        return h, w
    return w, h


def scale_filter(p, info=None):
    """分辨率上限过滤链；不限分辨率时返回 None（连 scale 都不挂，绝不白吃一次缩放）。
    每个方向都取 min(上限, 原始)，再配 force_original_aspect_ratio=decrease 保持比例：
    超过上限的缩到盒子里，没超的一点不动。
    （只写 scale=W:H 再靠 decrease 是不行的 —— 那样小片会被放大到盒子尺寸。）"""
    w, h = box(p, info)
    if not w and not h:
        return None
    f = "scale=w='min(%s,iw)':h='min(%s,ih)':force_original_aspect_ratio=decrease" % (w or 'iw', h or 'ih')
    if _ffmpeg_scale_opts():
        f += ':force_divisible_by=2'
    return f


def can_stream_copy(info, p):
    """能否零重编码直接流复制：编码/色彩空间已经是网页能播的，且没超过分辨率上限。"""
    if not info or info['codec'] != 'h264' or info['pix'] != 'yuv420p':
        return False
    w, h = box(p, info)
    if w and info['w'] > w:
        return False
    if h and info['h'] > h:
        return False
    return True


# ======================================================================
# 断点续跑状态
# ======================================================================
def load_state():
    if not os.path.isfile(STATE):
        return {}
    try:
        return json.load(open(STATE, encoding='utf-8'))
    except (ValueError, OSError):
        return {}


def save_state(state):
    json.dump(state, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)


def state_key(rel):
    return rel.replace('\\', '/')


def is_done(state, out, src, tag):
    """输出文件存在、且「源没动 + 画质参数没变」才算完成。"""
    ent = state.get(state_key(os.path.relpath(out, ROOT)))
    if not ent or not os.path.isfile(out) or os.path.getsize(out) == 0:
        return False
    st = os.stat(src)
    return (ent.get('tag') == tag and ent.get('src_size') == st.st_size
            and ent.get('src_mtime') == int(st.st_mtime))


def mark_done(state, out, src, tag):
    st = os.stat(src)
    state[state_key(os.path.relpath(out, ROOT))] = {
        'tag': tag, 'src_size': st.st_size, 'src_mtime': int(st.st_mtime),
        'out_size': os.path.getsize(out),
    }
    save_state(state)


# ======================================================================
# 1) 转码
# ======================================================================
def transcode(src, out, label, p, state):
    if not os.path.exists(src):
        print('  源文件不存在: %s' % src)
        return False
    tag = profile_tag(p)
    if is_done(state, out, src, tag):
        return False

    dur = probe_duration(src)
    src_size = os.path.getsize(src)
    info = probe_video(src)
    tmp = out + '.part.mp4'

    # --- 直接流复制：画质等于源，体积≈源 ---
    if can_stream_copy(info, p):
        cmd = ['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:v', 'copy',
               '-movflags', '+faststart']
        if not p['audio']:
            cmd += ['-an']
        r = run(cmd + [tmp], check=False)
        if r.returncode != 0:
            print('  流复制失败: %s' % (r.stderr or '')[-200:])
            return False
        os.replace(tmp, out)
        print('  %-22s %6.1fs  %7.2f MB -> %6.2f MB  流复制，零重编码，画质等于源'
              % (label, dur, src_size / 1048576, os.path.getsize(out) / 1048576))
        mark_done(state, out, src, tag)
        return True

    vf = scale_filter(p, info)
    base = ['ffmpeg', '-y', '-v', 'error', '-i', src]
    if vf:
        base += ['-vf', vf]
    base += ['-c:v', 'libx264', '-preset', p['preset'], '-profile:v', 'high',
             '-pix_fmt', 'yuv420p', '-g', str(p['gop'])]
    if not p['audio']:
        base += ['-an']

    # --- 质量优先（CRF）：体积不设限，画质是唯一目标 ---
    if p['mode'] == 'crf':
        r = run(base + ['-crf', str(p['crf']), '-movflags', '+faststart', tmp], check=False)
        if r.returncode != 0:
            print('  编码失败: %s' % (r.stderr or '')[-200:])
            return False
        os.replace(tmp, out)
        o = probe_video(out) or {}
        print('  %-22s %6.1fs  %7.2f MB -> %6.2f MB  CRF%d %s  %dx%d -> %dx%d'
              % (label, dur, src_size / 1048576, os.path.getsize(out) / 1048576,
                 p['crf'], p['preset'], (info or {}).get('w', 0), (info or {}).get('h', 0),
                 o.get('w', 0), o.get('h', 0)))
        mark_done(state, out, src, tag)
        return True

    # --- 省流量（两遍 ABR）：按目标体积倒算码率 ---
    target_bytes = src_size * p['size_ratio']
    vkbps = max(p['min_kbps'], int(target_bytes * 8 / max(dur, 1) / 1000 * 0.985))
    log = os.path.join(tempfile.mkdtemp(prefix='x264pass_'), 'pass')
    # 两遍编码的参数必须完全一致（x264 的 stats 按同一套参数算），
    # 否则 pass2 会直接 -22 写出空文件。
    abr = base + ['-b:v', '%dk' % vkbps, '-maxrate', '%dk' % int(vkbps * 1.6),
                  '-bufsize', '%dk' % int(vkbps * 3), '-passlogfile', log]
    r1 = run(abr + ['-pass', '1', '-f', 'null', os.devnull], check=False)
    if r1.returncode != 0:
        print('  pass1 失败: %s' % (r1.stderr or '')[-200:])
        return False
    r2 = run(abr + ['-pass', '2', '-movflags', '+faststart', tmp], check=False)
    if r2.returncode != 0:
        print('  pass2 失败: %s' % (r2.stderr or '')[-200:])
        return False
    os.replace(tmp, out)
    print('  %-22s %6.1fs  %7.2f MB -> %6.2f MB (%4.1f%%)  %5d kbps'
          % (label, dur, src_size / 1048576, os.path.getsize(out) / 1048576,
             os.path.getsize(out) / src_size * 100, vkbps))
    mark_done(state, out, src, tag)
    return True


# ======================================================================
# 2) 封面
# ======================================================================
def poster(mp4, jpg, w, h, square=False):
    """严格取视频第一帧，禁止 -ss 偏移：全屏时先显示这张图、视频再从 0 秒开播。"""
    vf = 'crop=ih:ih,scale=%d:%d' % (w, h) if square else \
         'scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d' % (w, h, w, h)
    run(['ffmpeg', '-y', '-v', 'error', '-i', mp4, '-frames:v', '1',
         '-vf', vf, '-q:v', str(POSTER_QUALITY), jpg], check=False)


def media(only=None, name=None):
    """1) 转码 + 封面。only 为空则全部。"""
    p = profile(name)
    state = load_state()
    only = set(only or ())
    done = 0

    if not only and not state:
        print('提示: 没有断点记录（_workflow_state.json），本次会把全部源片按「%s」重转一遍。'
              % (name or QUALITY))
        print('      只想试一条: python _workflow.py media 01')

    if os.path.isfile(CORGI_MAP):
        for line in open(CORGI_MAP, encoding='utf-8'):
            if not line.strip():
                continue
            num, src_name = line.rstrip('\n').split('\t')
            if only and num not in only:
                continue
            out = os.path.join(VID, 'corgi-%s.mp4' % num)
            if transcode(os.path.join(SRC, src_name), out, 'corgi-%s' % num, p, state):
                poster(out, os.path.join(VID, 'corgi-%s.jpg' % num), *POSTER_FULL)
                done += 1

    if not only:
        for key, src_name in MUSIC_MAP.items():
            out = os.path.join(VID, key + '.mp4')
            if transcode(os.path.join(SRC, src_name), out, key, p, state):
                poster(out, os.path.join(VID, key + '.jpg'), *POSTER_FULL)
                poster(out, os.path.join(VID, key + '-disc.jpg'), *POSTER_DISC, square=True)
                done += 1
    print('转码完成 %d 条' % done)
    return done


def posters():
    """2) 只重截封面，视频不动。"""
    done = missing = 0
    for jpg in sorted(glob.glob(os.path.join(VID, '*.jpg'))):
        if jpg.endswith('-disc.jpg'):
            mp4, spec = jpg[:-len('-disc.jpg')] + '.mp4', dict(square=True)
            size = POSTER_DISC
        else:
            mp4, spec = jpg[:-4] + '.mp4', {}
            size = POSTER_FULL
        if not os.path.exists(mp4):
            print('  没有视频: %s' % os.path.basename(jpg))
            missing += 1
            continue
        poster(mp4, jpg, size[0], size[1], **spec)
        done += 1
    print('重截 %d 张，缺视频 %d 张' % (done, missing))
    return done


# ======================================================================
# 3) 打版本号
# ======================================================================
_cache = {}
_missing = []


def digest(path):
    if path not in _cache:
        _cache[path] = hashlib.md5(open(path, 'rb').read()).hexdigest()[:8]
    return _cache[path]


def resolve(base, rel):
    """先按所在目录解析，再退回站点根目录（js/ 里写 ../../vid/ 这种）"""
    p = os.path.normpath(os.path.join(base, rel))
    if os.path.isfile(p):
        return p
    stripped = re.sub(r'^(?:\.\./)+', '', rel.replace('\\', '/'))
    p = os.path.normpath(os.path.join(ROOT, stripped))
    return p if os.path.isfile(p) else None


def _note_missing(tag):
    if tag not in _missing:
        _missing.append(tag)


def _stamp_attr(fp, text):
    """html 里的 src=/href=/poster= 本地资源"""
    def repl(m):
        attr, rel = m.group(1), m.group(2)
        if rel.startswith(('http:', 'https:', '//', '/', 'data:')):
            return m.group(0)      # 外链与站点根绝对路径不打号
        target = resolve(os.path.dirname(fp), rel)
        if not target:
            _note_missing(os.path.relpath(fp, ROOT) + ' -> ' + rel)
            return m.group(0)
        return '%s="%s?v=%s"' % (attr, rel, digest(target))
    return ATTR_REF.sub(repl, text)


def _stamp_str(fp, text):
    """JS 字符串里的本地媒体路径"""
    def repl(m):
        rel = m.group(1)
        target = resolve(os.path.dirname(fp), rel)
        if not target:
            _note_missing(os.path.relpath(fp, ROOT) + ' -> ' + rel)
            return m.group(0)
        return '"%s?v=%s"' % (rel, digest(target))
    return STR_REF.sub(repl, text)


def _stamp_abs(fp, text):
    """JS 字符串里的 R2 媒体地址：?v= 用本地同名文件哈希（本地没有就原样保留）"""
    def repl(m):
        rel = urllib.parse.unquote(m.group(1))
        target = os.path.normpath(os.path.join(ROOT, *rel.split('/')))
        if not os.path.isfile(target):
            return m.group(0)
        return '%s/%s?v=%s' % (MEDIA_BASE, m.group(1), digest(target))
    return ABS_REF.sub(repl, text)


def _write(fp, text):
    raw = open(fp, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    new = text.encode('utf-8-sig' if bom else 'utf-8')
    if new == raw:
        return False
    open(fp, 'wb').write(new)
    return True


def _stamp_once():
    _cache.clear()      # 上一轮可能刚改过文件，缓存哈希必须失效
    changed = []
    for pat in STAMP_FILES:
        for fp in sorted(glob.glob(os.path.join(ROOT, pat.replace('/', os.sep)))):
            text = open(fp, encoding='utf-8').read()
            new = _stamp_abs(fp, _stamp_str(fp, _stamp_attr(fp, text)))
            if _write(fp, new):
                changed.append(os.path.relpath(fp, ROOT))
    return changed


def stamp():
    """3) 打版本号。改了 js 之后引用它的 html 哈希也会变，所以反复跑到稳定。"""
    _missing.clear()
    changed = []
    for _ in range(4):
        c = _stamp_once()
        if not c:
            break
        for x in c:
            if x not in changed:
                changed.append(x)
    print('已更新: %s' % (', '.join(changed) if changed else '无（都是最新）'))
    if _missing:
        print('找不到文件（未打号，检查路径）:')
        for m in _missing[:20]:
            print('  -', m)
        if len(_missing) > 20:
            print('  ... 共 %d 条' % len(_missing))
    return changed


# ======================================================================
# 4) 站点版本号
# ======================================================================
def read_version():
    m = VERSION_PAT.search(open(INDEX, encoding='utf-8').read())
    if not m:
        return None
    return 'V%d.%d.%02d' % (int(m.group(2)), int(m.group(3)), int(m.group(4)))


def bump(show=False):
    """4) 首页版本号 +1：末位满 VERSION_STEP 进次版本，主版本手动改。"""
    if not os.path.isfile(INDEX):
        print('找不到 index.html')
        return None
    text = open(INDEX, encoding='utf-8').read()
    m = VERSION_PAT.search(text)
    if not m:
        print('没找到版本号标记 <span class="site-version" id="siteVersion">V1.10.00</span>')
        return None
    cur = 'V%d.%d.%02d' % (int(m.group(2)), int(m.group(3)), int(m.group(4)))
    if show:
        print(cur)
        return cur
    major, minor, patch = int(m.group(2)), int(m.group(3)), int(m.group(4)) + 1
    if patch >= VERSION_STEP:
        patch, minor = 0, minor + 1
    new = 'V%d.%d.%02d' % (major, minor, patch)
    new_text = VERSION_PAT.sub(lambda mm: '%s%s%s' % (mm.group(1), new, mm.group(5)), text, count=1)
    raw = open(INDEX, 'rb').read()
    bom = raw.startswith(b'\xef\xbb\xbf')
    open(INDEX, 'wb').write(new_text.encode('utf-8-sig' if bom else 'utf-8'))
    print('%s → %s' % (cur, new))
    return new


# ======================================================================
# 5) 上传 R2
# ======================================================================
def _rclone():
    exe = shutil.which('rclone')
    if not exe:
        print('没找到 rclone。装好后 `rclone config` 选 Amazon S3 -> Cloudflare R2，'
              '填 Access Key / Secret / 账号 ID，再把本文件顶部的 '
              'UPLOAD_REMOTE / UPLOAD_BUCKET 改成你配的名字。')
    return exe


def upload(force=False, dry=False):
    """5) 把 vid/*.mp4 传到 Cloudflare R2。

    ?v= 用的是本地文件 md5，只有「传上去的字节 == 本地文件」时才成立，
    所以顺序是 转码 -> 上传 -> 打号(stamp) -> 版本号 -> push。
    """
    exe = _rclone()
    if not exe:
        return 1

    remotes = [x.strip().rstrip(':') for x in
               (run([exe, 'listremotes'], check=False).stdout or '').splitlines() if x.strip()]
    if UPLOAD_REMOTE not in remotes:
        print('rclone 里没有名为 %r 的 remote，现有: %s'
              % (UPLOAD_REMOTE, ', '.join(remotes) or '（空）'))
        return 1

    buckets = [x.strip().rstrip('/') for x in
               (run([exe, 'lsf', UPLOAD_REMOTE + ':', '--dirs-only', '--max-depth', '1'],
                    check=False).stdout or '').splitlines() if x.strip()]
    if UPLOAD_BUCKET not in buckets:
        print('桶 %r 不在 %s: 下面，现有: %s'
              % (UPLOAD_BUCKET, UPLOAD_REMOTE, ', '.join(buckets) or '（空）'))
        return 1

    files = sorted(glob.glob(os.path.join(VID, '*.mp4')))
    dst = '%s:%s/%s' % (UPLOAD_REMOTE, UPLOAD_BUCKET, UPLOAD_PREFIX)
    print('上传 %d 个 mp4 -> %s%s' % (len(files), dst, '（dry-run）' if dry else ''))

    cmd = [exe, 'copy', VID, dst, '--include', '*.mp4',
           '--transfers', '4', '--checkers', '8',
           '--stats', '5s', '--stats-one-line']
    if force:
        cmd += ['--ignore-times']     # 文件名/体积没变也要重传（比如重编码后体积恰好相同）
    if dry:
        cmd += ['--dry-run', '-v']
    # 不捕获输出：rclone 的进度条直接打在终端上
    rc = subprocess.run(cmd).returncode
    if rc != 0:
        print('rclone 返回 %d，检查网络/凭据后重试' % rc)
        return 1
    print('上传完成。接着跑 python _workflow.py stamp && python _workflow.py bump && python _workflow.py push "..."')
    return 0


# ======================================================================
# 6) 发布
# ======================================================================
def git(*args, check=False):
    return run(['git'] + list(args), check=check)


def status():
    p = profile()
    print('画质策略: %s  %s' % (QUALITY, {k: p[k] for k in p if k in
                                       ('mode', 'crf', 'preset', 'max_w', 'max_h', 'size_ratio')}))
    print('站点版本: %s' % read_version())
    mp4 = glob.glob(os.path.join(VID, '*.mp4'))
    no_poster = [os.path.basename(x) for x in mp4
                 if not os.path.isfile(x[:-4] + '.jpg')]
    print('本地视频: %d 条，缺封面 %d 条%s' % (len(mp4), len(no_poster),
                                        ('（%s…）' % ', '.join(no_poster[:5])) if no_poster else ''))
    dirty = [l for l in (git('status', '--porcelain').stdout or '').splitlines() if l.strip()]
    print('待提交: %d 个文件' % len(dirty))
    for l in dirty[:10]:
        print('  ' + l)
    return 0


def push(msg):
    """5) 提交并推送。代理挂掉时 git 会死等 300 秒，这里自动改直连重试一次。"""
    git('add', '-A')
    r = git('commit', '-m', msg)
    if r.returncode != 0 and 'nothing to commit' not in (r.stdout or ''):
        print((r.stdout or '') + (r.stderr or ''))
        return 1
    print((r.stdout or '').strip())
    remotes = (git('remote').stdout or '').split()
    remote = 'origin' if 'origin' in remotes else (remotes[0] if remotes else 'origin')
    r = git('push', remote, 'HEAD')
    if r.returncode != 0:
        print('  推送失败，去掉代理配置（http.proxy）改直连重试 …')
        r = run(['git', '-c', 'http.proxy=', '-c', 'https.proxy=', 'push', remote, 'HEAD'])
        if r.returncode != 0:
            print((r.stderr or '').strip())
            return 1
    print(((r.stdout or '') + (r.stderr or '')).strip())
    return 0


def release(only=None, name=None):
    """转码 + 封面 + 打号 + 版本号 一条龙，不提交、不上传。"""
    media(only, name)
    posters()
    stamp()
    bump()
    print('本地准备完毕。剩下两步: python _workflow.py upload  →  python _workflow.py push "提交说明"')
    return 0


# ======================================================================
# CLI
# ======================================================================
def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], True)
                for a in argv if a.startswith('--'))
    name = opts.get('profile') if isinstance(opts.get('profile'), str) else None
    cmd = args[0] if args else 'status'

    if cmd == 'status':
        return status()
    if cmd == 'media':
        media(args[1:], name)
        return 0
    if cmd == 'posters':
        posters()
        return 0
    if cmd == 'stamp':
        stamp()
        return 0
    if cmd == 'bump':
        bump(show='show' in opts)
        return 0
    if cmd == 'upload':
        return upload(force='force' in opts, dry='dry-run' in opts)
    if cmd == 'release':
        return release(args[1:], name)
    if cmd == 'push':
        if len(args) < 2:
            print('用法: python _workflow.py push "提交说明"')
            return 1
        return push(args[1])
    if cmd in ('-h', 'help'):
        print(__doc__)
        return 0
    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
