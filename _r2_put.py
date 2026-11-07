# -*- coding: utf-8 -*-
"""用 boto3 上传 vid/*.mp4 到 R2 桶 media。

- 8MB 分片、并发 2、SDK 自带重试，避开家宽单请求超时
- 默认只传「远端大小 != 本地大小」的文件（自动发现残缺对象）
- 也可显式指定文件：python _r2_put.py vid/xxx.mp4 ...
"""
import os
import sys
import time

import boto3
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.exceptions import ClientError

import _workflow as w

env = w._secrets()
AK = env[w.ENV_S3_KEY]
SK = env[w.ENV_S3_SECRET]
ACCT = env[w.ENV_ACCOUNT_ID]
EP = 'https://%s.r2.cloudflarestorage.com' % ACCT
BUCKET = w.R2_BUCKET

s3 = boto3.client(
    's3',
    endpoint_url=EP,
    aws_access_key_id=AK,
    aws_secret_access_key=SK,
    region_name='auto',
    config=Config(
        signature_version='s3v4',
        s3={'addressing_style': 'path'},
        retries={'max_attempts': 10, 'mode': 'standard'},
        connect_timeout=20,
        read_timeout=120,
    ),
)

CFG = TransferConfig(
    multipart_threshold=8 * 1024 * 1024,
    multipart_chunksize=8 * 1024 * 1024,
    max_concurrency=2,
    use_threads=True,
)


def remote_size(key):
    try:
        h = s3.head_object(Bucket=BUCKET, Key=key)
        return int(h['ContentLength'])
    except ClientError as e:
        code = e.response.get('Error', {}).get('Code', '')
        if code in ('404', 'NoSuchKey', 'NotFound'):
            return None
        raise


def upload_one(path, key):
    size = os.path.getsize(path)
    t0 = time.time()
    last = [0.0]

    def cb(n):
        now = time.time()
        if now - last[0] > 3:
            last[0] = now
            pct = n * 100.0 / size
            print('    %-34s %5.1f%%  %.2f/%.2f MB' % (key, pct, n / 1048576.0, size / 1048576.0), flush=True)

    try:
        s3.upload_file(path, BUCKET, key, Config=CFG, Callback=cb,
                       ExtraArgs={'ContentType': 'video/mp4'})
    except Exception as e:
        print('  %-34s FAIL %s' % (key, e), flush=True)
        return False

    rs = remote_size(key)
    dt = time.time() - t0
    ok = rs == size
    print('  %-34s %s  %7.2fMB  %6.1fs  %5.2fMB/s  remote=%s'
          % (key, 'OK  ' if ok else 'SIZE-MISMATCH', size / 1048576.0, dt,
             size / 1048576.0 / max(dt, 0.001), rs), flush=True)
    return ok


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith('--')]
    force = '--force' in sys.argv[1:]
    targets = []
    if argv:
        for a in argv:
            p = a.replace('\\', '/')
            if not os.path.isabs(p):
                p = os.path.join(os.getcwd(), p)
            name = os.path.basename(p)
            targets.append((p, 'vid/' + name))
    else:
        for fn in sorted(os.listdir('vid')):
            if not fn.lower().endswith('.mp4'):
                continue
            p = os.path.join('vid', fn)
            targets.append((p, 'vid/' + fn))

    print('检查 %d 个文件...%s' % (len(targets), '（--force：忽略大小比对）' if force else ''), flush=True)
    todo = []
    for p, k in targets:
        rs = remote_size(k)
        ls = os.path.getsize(p)
        if force or rs != ls:
            todo.append((p, k, ls, rs))

    if not todo:
        print('全部一致，无需上传。')
        return 0
    print('待传 %d 个：' % len(todo))
    for p, k, ls, rs in todo:
        print('  %-34s 本地 %7.2fMB  远端 %s' % (k, ls / 1048576.0,
                                            '无' if rs is None else '%.2fMB' % (rs / 1048576.0)))
    print()

    bad = 0
    for p, k, ls, rs in todo:
        if not upload_one(p, k):
            bad += 1
    print('\n完成：成功 %d，失败 %d' % (len(todo) - bad, bad))
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
