# -*- coding: utf-8 -*-
"""强制某一行进入播放态，量图标右边缘与歌名起点的间距。"""
from playwright.sync_api import sync_playwright

UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')

FORCE = """() => {
  var l = document.querySelectorAll('#play-list ul li');
  for (var i = 0; i < l.length; i++) l[i].classList.remove('playing');
  if (l[4]) l[4].classList.add('playing');
}"""

CHECK = """() => {
  var li = document.querySelector('#play-list ul li.playing');
  if (!li) return 'no playing row';
  var ic = li.querySelector('i.ic');
  var lr = li.getBoundingClientRect();
  var ir = ic.getBoundingClientRect();
  var indent = parseFloat(getComputedStyle(li).textIndent);
  return {
    liLeft: Math.round(lr.x), iconLeft: Math.round(ir.x), iconRight: Math.round(ir.right),
    iconDisplay: getComputedStyle(ic).display,
    textIndent: Math.round(indent), textStart: Math.round(lr.x + indent),
    gap: Math.round(lr.x + indent - ir.right), title: li.textContent.trim().slice(0, 4)
  };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel='msedge', args=['--autoplay-policy=no-user-gesture-required'])
    for name, vp, mobile in [('移动', {'width': 390, 'height': 844}, True),
                             ('桌面', {'width': 1440, 'height': 900}, False)]:
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile,
                            device_scale_factor=2 if mobile else 1,
                            user_agent=UA if mobile else None)
        pg = ctx.new_page()
        pg.goto('http://127.0.0.1:8765/Albums/自定义/', wait_until='domcontentloaded', timeout=60000)
        pg.wait_for_timeout(2500)
        pg.evaluate("() => { document.getElementById('stage').style.display='none'; document.querySelector('#control .list').click(); }")
        pg.wait_for_timeout(900)
        pg.evaluate(FORCE)
        pg.wait_for_timeout(300)
        print(name, ':', pg.evaluate(CHECK))
        if mobile:
            pg.screenshot(path='_li_mobile.png')
        ctx.close()
    b.close()
