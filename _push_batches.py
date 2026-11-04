# -*- coding: utf-8 -*-
"""把当前改动按体积切成多批，一批一提交一推送。

单个 587MB 的 pack 在 GitHub 上会被掐断（fatal: the remote end hung up），
拆成每批 100MB 左右，每批推完再进下一批，断了只重推那一批。
"""
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
BATCH_BYTES = 110 * 1024 * 1024

ENV = dict(os.environ,
           GIT_AUTHOR_NAME='i-found',
           GIT_AUTHOR_EMAIL='38999574+i-found@users.noreply.github.com',
           GIT_COMMITTER_NAME='i-found',
           GIT_COMMITTER_EMAIL='38999574+i-found@users.noreply.github.com')


def git(args, check=False):
    r = subprocess.run(['git'] + args, capture_output=True, text=True, env=ENV)
    if check and r.returncode != 0:
        print('git %s 失败: %s' % (' '.join(args[:2]), r.stderr.strip()[:300]))
    return r


def log(*a):
    print(*a, flush=True)


# ---- 收集改动（-z 避免中文路径被转义）----
raw = subprocess.run(['git', 'status', '--porcelain', '-z'], capture_output=True, env=ENV).stdout
parts = raw.split(b'\x00')
entries = []
i = 0
while i < len(parts):
    p = parts[i]
    if not p.strip():
        i += 1
        continue
    st = p[:2].decode('utf-8', 'ignore')
    path = p[3:].decode('utf-8', 'ignore')
    entries.append((st.strip(), path))
    if st[:1] in ('R', 'C'):
        i += 1
    i += 1

small, big = [], []
for st, path in entries:
    full = os.path.join(ROOT, path)
    size = os.path.getsize(full) if os.path.exists(full) else 0
    # git 输出永远用 / 分隔，不能拿 os.sep 去比
    if path.startswith('vid/') and path.endswith('.mp4') and size > 512 * 1024:
        big.append((path, size))
    else:
        small.append(path)

big.sort()
batches = []
cur = [p for p in small]
batches.append(('Wallpaper videos: transcode to a third of source size, keep full length, strip audio, cap at 1080p; drop the fullscreen poster blur',
                cur, sum(os.path.getsize(os.path.join(ROOT, p)) for p in small if os.path.exists(os.path.join(ROOT, p)))))
cur, sz = [], 0
for path, size in big:
    if cur and sz + size > BATCH_BYTES:
        batches.append(('Re-encode wallpaper videos, part %d' % (len(batches)), cur, sz))
        cur, sz = [], 0
    cur.append(path)
    sz += size
if cur:
    batches.append(('Re-encode wallpaper videos, part %d' % (len(batches)), cur, sz))

log('共 %d 批，总计 %.0f MB' % (len(batches), sum(b[2] for b in batches) / 1048576))
for idx, (msg, paths, size) in enumerate(batches, 1):
    log('  批%d: %d 个文件 %.0f MB' % (idx, len(paths), size / 1048576))

for idx, (msg, paths, size) in enumerate(batches, 1):
    log('\n=== 批 %d/%d  %.0f MB ===' % (idx, len(batches), size / 1048576))
    r = git(['add', '-A', '--'] + paths, check=True)
    if r.returncode != 0:
        sys.exit(1)
    r = git(['commit', '-q', '-m', msg + (' (batch %d/%d)' % (idx, len(batches)) if idx > 1 else '')])
    if r.returncode != 0 and 'nothing to commit' not in (r.stdout + r.stderr):
        log('提交失败: ' + r.stderr[:300])
        sys.exit(1)
    for attempt in range(1, 5):
        t0 = time.time()
        r = git(['-c', 'http.postBuffer=1048576000', '-c', 'http.version=HTTP/1.1',
                 'push', 'origin', 'HEAD:main'])
        if r.returncode == 0:
            log('推送成功 %.0f 秒' % (time.time() - t0))
            break
        log('第 %d 次推送失败(%.0f 秒): %s' % (attempt, time.time() - t0,
                                          (r.stderr or r.stdout).strip().splitlines()[-1][:160]))
        time.sleep(15)
    else:
        log('批 %d 连续失败，停止' % idx)
        sys.exit(1)

log('\nALL DONE')
