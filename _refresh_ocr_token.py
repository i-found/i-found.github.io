# -*- coding: utf-8 -*-
"""刷新 ocr_token.json —— 百度 OCR 的 access_token，30 天有效。

前端只读这个 JSON，所以 AK/SK 不出现在网页里。
用法（PowerShell）：
    $env:BAIDU_AK='你的 API Key'; $env:BAIDU_SK='你的 Secret Key'; python _refresh_ocr_token.py
凭据也可以写进 _r2_secret.py（已在 .gitignore 里），本脚本会一并尝试。
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'ocr_token.json')
TOKEN_API = 'https://aip.baidubce.com/oauth/2.0/token'


def load_creds():
    """环境变量优先，其次 _r2_secret.py 里的 BAIDU_AK / BAIDU_SK 常量。"""
    ak = os.environ.get('BAIDU_AK', '')
    sk = os.environ.get('BAIDU_SK', '')
    if ak and sk:
        return ak, sk
    fp = os.path.join(ROOT, '_r2_secret.py')
    if os.path.isfile(fp):
        ns = {}
        try:
            with open(fp, encoding='utf-8') as f:
                exec(f.read(), ns)  # noqa: S102 —— 本地凭据文件
        except Exception:
            ns = {}
        ak = ak or ns.get('BAIDU_AK', '')
        sk = sk or ns.get('BAIDU_SK', '')
    return ak, sk


def main():
    ak, sk = load_creds()
    if not ak or not sk:
        print('缺少凭据：请设置环境变量 BAIDU_AK / BAIDU_SK，或在 _r2_secret.py 里写同名常量')
        return 1
    url = '%s?grant_type=client_credentials&client_id=%s&client_secret=%s' % (
        TOKEN_API, urllib.parse.quote(ak), urllib.parse.quote(sk))
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.loads(r.read().decode())
    token = d.get('access_token')
    if not token:
        print('换取失败：', d.get('error'), d.get('error_description'))
        return 1
    ttl = int(d.get('expires_in') or 2592000)
    now = int(time.time())
    data = {
        'token': token,
        'issued_at': now,
        'expires_at': now + ttl,
        'expires_readable': time.strftime('%Y-%m-%d %H:%M', time.localtime(now + ttl)),
        'note': '百度 OCR access_token，只用于识别记录图片里的文字；过期后重跑 _refresh_ocr_token.py',
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('已写入 %s' % OUT)
    print('有效期至 %s' % data['expires_readable'])
    return 0


if __name__ == '__main__':
    sys.exit(main())
