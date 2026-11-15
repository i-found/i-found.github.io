/* 首页「日历计划」：卡片里是本月迷你月历 → 点整块卡片进全屏月历 → 点某一天弹当天的计划卡。
   两层嵌套沿用音乐页「专辑卡片 → 专辑详情 → 单曲浮层」的那套手感。

   本地存 localStorage 的 suihe_todos，每天一份：
     { "2026-11-08": { items: [ { id, text, done } ], at: 1762…, del: false } }
   at 是这一天最后一次改动的时间，本机和云端靠它比新旧；del 是「整天被清空」的墓碑，
   有了它，删掉的计划才不会被另一台设备的旧副本重新推回来。
   老版本把当天直接存成数组，load 时会自动升级，已经写过的计划不丢。

   云端与记录页共用同一套密钥（localStorage 的 suihe_records_key）和同一台 API 主机，
   端点 /api/todos 收发 { todos: {...} }，整份 JSON 放进 R2 的 todo-list 桶。 */
(function() {
  var STORE_KEY = 'suihe_todos';
  var TOKEN_KEY = 'suihe_records_key';           /* 与 record.html 共用 */
  var API_BASE = 'https://meimei.qzz.io';        /* 与 record.html 共用 */
  var API_PATH = '/api/todos';                   /* Worker 路由，数据落 R2 桶 todo-list */

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var data = load();
  var cardEl = null, fullEl = null, gridEl = null, titleEl = null, dayEl = null;
  var viewYear = 0, viewMonth = 0;   /* 全屏月历当前显示的月份 */
  var dayKey = '';                   /* 计划卡正在编辑的日期 */
  var pushTimer = null;
  var lastPull = 0;                  /* 上次拉取时间，回到前台时按需再拉 */

  /* ---------- 数据 ---------- */
  /* 一天的数据统一成 { items, at, del }：老版本存的是裸数组，at 记 0，
     第一次改动时才会写上时间戳。 */
  function normalizeDay(v) {
    if (Array.isArray(v)) return { items: v, at: 0, del: false };
    if (v && typeof v === 'object') {
      return {
        items: Array.isArray(v.items) ? v.items : [],
        at: Number(v.at) || 0,
        del: !!v.del
      };
    }
    return null;
  }
  function load() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { raw = {}; }
    var out = {};
    if (!raw || typeof raw !== 'object') return out;
    Object.keys(raw).forEach(function(k) {
      var d = normalizeDay(raw[k]);
      if (d) out[k] = d;
    });
    return out;
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function listOf(key) {
    var d = data[key];
    return d && Array.isArray(d.items) ? d.items : [];
  }
  /* 写一天：list 为空等于把这一天删干净，留个墓碑挡住云端旧副本 */
  function setList(key, list) {
    list = list || [];
    data[key] = { items: list, at: Date.now(), del: !list.length };
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function keyOf(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function nowToday() { var t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate(), w: t.getDay() }; }

  /* 6×7 的月历格子：从本月 1 号所在那一周的周日开始排 */
  function monthCells(y, m) {
    var first = new Date(y, m, 1);
    var start = new Date(y, m, 1 - first.getDay());
    var out = [];
    for (var i = 0; i < 42; i++) {
      var dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      out.push({
        y: dt.getFullYear(),
        m: dt.getMonth(),
        d: dt.getDate(),
        key: keyOf(dt.getFullYear(), dt.getMonth(), dt.getDate()),
        inMonth: dt.getMonth() === m
      });
    }
    return out;
  }

  /* ---------- 云同步 ---------- */
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  var syncState = { mode: '', tip: '仅保存在本机浏览器' };
  function setSync(mode, tip) {
    syncState = { mode: mode || '', tip: tip || '' };
    var nodes = document.querySelectorAll('.todo-sync');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].className = 'todo-sync' + (mode ? ' ' + mode : '');
      nodes[i].title = tip || '';
    }
  }
  function pushSoon() {
    if (!getToken()) { setSync('', '仅保存在本机浏览器'); return; }
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 900);
  }
  function push() {
    var token = getToken();
    if (!token) { setSync('', '仅保存在本机浏览器'); return Promise.resolve(false); }
    clearTimeout(pushTimer);
    setSync('busy', '正在备份…');
    return fetch(API_BASE + API_PATH, {
      method: 'POST',
      headers: { 'X-Records-Key': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: data })
    }).then(function(r) {
      if (r.status === 401) throw { unauthorized: true };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setSync('ok', '已备份到云端');
      return true;
    }).catch(function(err) {
      if (err && err.unauthorized) setSync('warn', '密钥不正确，只保存在本机');
      else setSync('warn', '云端暂不可用，已保存在本机');
      return false;
    });
  }
  function pull() {
    var token = getToken();
    if (!token) { setSync('', '仅保存在本机浏览器'); return; }
    lastPull = Date.now();
    setSync('busy', '正在同步…');
    fetch(API_BASE + API_PATH, { headers: { 'X-Records-Key': token }, cache: 'no-store' })
      .then(function(r) {
        if (r.status === 401) throw { unauthorized: true };
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function(d) {
        var cloud = (d && d.todos) || {};
        /* 同一天谁的时间戳更新就用谁的：另一台设备刚改过的计划能拉下来，
           本机刚写的也不会被云端旧副本盖掉 */
        var changed = false;
        Object.keys(cloud).forEach(function(k) {
          var c = normalizeDay(cloud[k]);
          if (!c) return;
          var mine = data[k];
          if (!mine || c.at > mine.at) { data[k] = c; changed = true; }
        });
        if (changed) { persist(); renderAll(); }
        setSync('ok', '已备份到云端');
        /* 本机有比云端新的日子（比如离线写的），补推一次把两边对齐 */
        var needPush = Object.keys(data).some(function(k) {
          var c = normalizeDay(cloud[k]);
          return !c || data[k].at > c.at;
        });
        if (needPush) push();
      })
      .catch(function(err) {
        if (err && err.unauthorized) setSync('warn', '密钥不正确，只保存在本机');
        else setSync('warn', '云端暂不可用，已保存在本机');
      });
  }

  /* ---------- 卡片（首页那一块） ---------- */
  function renderCard() {
    if (!cardEl) return;
    var t = nowToday();
    var todayKey = keyOf(t.y, t.m, t.d);
    var todayList = listOf(todayKey);
    var undone = todayList.filter(function(x) { return !x.done; }).length;

    var html = '<div class="todo-card-body">'
      + '<div class="todo-card-top">'
      + '<div>'
      + '<p class="todo-eyebrow">今天 · 星期' + WEEK[t.w] + '</p>'
      + '<p class="todo-big">' + pad(t.d) + '</p>'
      + '</div>'
      + '<div class="todo-card-side">'
      + '<span class="todo-month">' + t.y + ' 年 ' + (t.m + 1) + ' 月</span>'
      + '<span class="todo-sync" title="仅保存在本机浏览器"></span>'
      + '</div>'
      + '</div>'
      + '<div class="todo-mini-head">' + WEEK.map(function(w) { return '<span>' + w + '</span>'; }).join('') + '</div>'
      + '<div class="todo-mini">' + miniCells(t) + '</div>'
      + '<div class="todo-card-foot">'
      + '<p class="todo-count">' + (todayList.length
        ? '今天 ' + todayList.length + ' 项计划' + (undone ? '，' + undone + ' 项待完成……' : '，全部完成！')
        : '今天还没有计划') + '</p>'
      + '<p class="todo-preview">' + previewHtml(todayList) + '</p>'
      + '</div>'
      + '</div>';
    cardEl.innerHTML = html;
    /* 卡片整块重建过，同步状态点要跟着补回来 */
    setSync(syncState.mode, syncState.tip);
  }

  function miniCells(t) {
    var cells = monthCells(t.y, t.m);
    var html = '';
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var cls = 'todo-mini-cell';
      if (!c.inMonth) cls += ' is-out';
      if (c.key === keyOf(t.y, t.m, t.d)) cls += ' is-today';
      var list = listOf(c.key);
      if (list.length) {
        cls += ' has-plan';
        /* 那天全部做完：日期下面的小圆点转绿；今天则是日期圆底转绿 */
        var done = 0;
        for (var j = 0; j < list.length; j++) if (list[j].done) done++;
        if (done === list.length) cls += ' is-all-done';
      }
      html += '<span class="' + cls + '">' + c.d + '</span>';
    }
    return html;
  }

  /* 预览：一行三条，最多九条；超过九条第 9 格放省略号，
     每条前面一个小圆点——没做完粉红，做完绿色 */
  function previewHtml(list) {
    if (!list.length) return '<span class="todo-preview-empty">点一下这块，打开日历写今天要做的事</span>';
    var max = 9;
    var show = list.length > max ? max - 1 : list.length;
    var html = '';
    for (var i = 0; i < show; i++) {
      html += '<span class="todo-preview-i' + (list[i].done ? ' is-done' : '') + '">'
        + esc(list[i].text) + '</span>';
    }
    if (list.length > max) html += '<span class="todo-preview-i is-more">…</span>';
    return html;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------- 全屏月历 ---------- */
  function buildFull() {
    fullEl = document.createElement('div');
    fullEl.className = 'todo-full';
    fullEl.hidden = true;
    fullEl.innerHTML = '<div class="todo-panel">'
      + '<div class="todo-panel-head">'
      + '<div>'
      + '<h2 class="todo-panel-title" id="todoTitle"></h2>'
      + '<p class="todo-panel-sub">点某一天，写当天的计划</p>'
      + '</div>'
      + '<div class="todo-panel-tools">'
      + '<button type="button" class="todo-btn icon" data-act="prev" aria-label="上个月">‹</button>'
      + '<button type="button" class="todo-btn" data-act="today">今天</button>'
      + '<button type="button" class="todo-btn icon" data-act="next" aria-label="下个月">›</button>'
      + '<button type="button" class="todo-btn" data-act="import">导入</button>'
      + '<button type="button" class="todo-btn" data-act="export">导出</button>'
      + '<button type="button" class="todo-btn" data-act="close">关闭</button>'
      + '</div>'
      + '</div>'
      + '<div class="todo-week">' + WEEK.map(function(w) { return '<span>' + w + '</span>'; }).join('') + '</div>'
      + '<div class="todo-grid"></div>'
      + '<input type="file" class="todo-import-input" accept=".md,.markdown,text/markdown,text/plain" hidden>'
      + '</div>';
    document.body.appendChild(fullEl);
    gridEl = fullEl.querySelector('.todo-grid');
    titleEl = fullEl.querySelector('#todoTitle');

    var fileInput = fullEl.querySelector('.todo-import-input');
    if (fileInput) fileInput.addEventListener('change', onFilePicked);

    fullEl.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-act]');
      if (btn) {
        var act = btn.getAttribute('data-act');
        if (act === 'close') closeFull();
        else if (act === 'prev') shiftMonth(-1);
        else if (act === 'next') shiftMonth(1);
        else if (act === 'export') exportMarkdown();
        else if (act === 'import') pickMarkdown();
        else if (act === 'today') {
          var t = nowToday();
          viewYear = t.y; viewMonth = t.m;
          renderGrid();
        }
        return;
      }
      var cell = ev.target.closest('.todo-cell');
      if (cell) { openDay(cell.getAttribute('data-key')); return; }
      /* 点月历面板外面 = 收起全屏 */
      if (!ev.target.closest('.todo-panel')) closeFull();
    });
  }

  function openFull() {
    var t = nowToday();
    viewYear = t.y; viewMonth = t.m;
    fullEl.hidden = false;      /* 先显示再画，否则格子量不到高度，省略号算不出来 */
    renderGrid();
    document.body.classList.add('todo-open');
  }
  function closeFull() {
    closeDay();
    if (fullEl) fullEl.hidden = true;
    document.body.classList.remove('todo-open');
  }
  function shiftMonth(delta) {
    var m = viewMonth + delta, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    viewMonth = m; viewYear = y;
    renderGrid();
  }

  function renderGrid() {
    if (!gridEl) return;
    var t = nowToday();
    var todayKey = keyOf(t.y, t.m, t.d);
    titleEl.textContent = viewYear + ' 年 ' + (viewMonth + 1) + ' 月';
    var cells = monthCells(viewYear, viewMonth);
    var html = '';
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var list = listOf(c.key);
      var doneCount = 0;
      for (var d = 0; d < list.length; d++) if (list[d].done) doneCount++;
      var allDone = list.length > 0 && doneCount === list.length;
      var isToday = c.key === todayKey;
      var cls = 'todo-cell';
      if (!c.inMonth) cls += ' is-out';
      if (isToday) cls += ' is-today';
      /* 整格绿色主调只给今天；别的日期全做完只把项数变绿，其余照常 */
      if (allDone) cls += isToday ? ' is-done-all' : ' is-all-done';
      /* 左边一列只放日期 + 项数（未做完=还剩几项，全做完=共几项），
         右边一列逐条列内容（未完成红点、已完成绿点） */
      var tag = '';
      if (list.length) {
        tag = '<span class="todo-cell-tag">'
          + (allDone ? list.length : list.length - doneCount) + '</span>';
      }
      var head = '<span class="todo-cell-head">'
        + '<span class="todo-cell-d">' + c.d + '</span>' + tag
        + '</span>';
      var body = list.length
        ? '<span class="todo-cell-list">' + list.map(function(x) {
            return '<span class="todo-cell-i' + (x.done ? ' is-done' : '') + '">' + esc(x.text) + '</span>';
          }).join('') + '</span>'
        : '';
      html += '<button type="button" class="' + cls + '" data-key="' + c.key + '">'
        + head + body + '</button>';
    }
    gridEl.innerHTML = html;
    /* 等这一帧排版稳定再量高度，否则算不准能放几行 */
    if (window.requestAnimationFrame) window.requestAnimationFrame(clampCellLists);
    else clampCellLists();
  }

  /* 格子高度有限，条目放不下时按真实像素位置逐条收起（不用行高做除法，
     浏览器缩放、字体回退都不会算偏），只隐藏不删除，尺寸变了能原样回来。
     收起来的条目在格子左下角挂一个小省略号提示（不占内容行），
     这样能显示几条就显示几条，不会为了省略号白扔一条内容。 */
  function clampCellLists() {
    if (!gridEl) return;
    var lists = gridEl.querySelectorAll('.todo-cell-list');
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      var rows = list.querySelectorAll('.todo-cell-i');
      if (!rows.length) continue;
      for (var j = 0; j < rows.length; j++) rows[j].style.display = '';
      var box = list.getBoundingClientRect();
      if (!box.height) continue;          /* 还没排版出高度就别动 */
      var limit = box.bottom + 1;
      var shown = rows.length;
      while (shown > 0 && rows[shown - 1].getBoundingClientRect().bottom > limit) {
        shown--;
        rows[shown].style.display = 'none';
      }
      if (shown === rows.length) list.classList.remove('has-more');
      else list.classList.add('has-more');
    }
  }

  /* ---------- 当天计划卡 ---------- */
  function buildDay() {
    dayEl = document.createElement('div');
    dayEl.className = 'todo-day';
    dayEl.hidden = true;
    dayEl.innerHTML = '<div class="todo-day-card">'
      + '<div class="todo-day-head">'
      + '<h3 class="todo-day-title"></h3>'
      + '<span class="todo-day-week"></span>'
      + '<button type="button" class="todo-day-close" aria-label="关闭">✕</button>'
      + '</div>'
      + '<ul class="todo-list"></ul>'
      + '<form class="todo-form">'
      + '<input type="text" placeholder="添加一条计划，回车保存" autocomplete="off">'
      + '<button type="submit" class="todo-add" title="添加" aria-label="添加">'
      + '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
      + '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor"'
      + ' stroke-width="2.2" stroke-linecap="round"/>'
      + '</svg></button>'
      + '</form>'
      + '</div>';
    document.body.appendChild(dayEl);

    /* ---- 左滑露出「删除」：按住这一行往左拖，过一半松手就吸附打开 ---- */
    var SW = 46;   /* 滑开露出的宽度：删除圆 30px + 右边留白 */
    var sw = { row: null, main: null, x0: 0, y0: 0, base: 0, dragging: false, suppressClick: false };

    function setSwipe(row, open) {
      var main = row.querySelector('.todo-row-main');
      if (!main) return;
      row.classList.toggle('is-open', open);
      main.style.transform = open ? 'translateX(-' + SW + 'px)' : '';
    }
    function swipeCloseAll(except) {
      var rows = dayEl.querySelectorAll('.todo-row.is-open');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] !== except) setSwipe(rows[i], false);
      }
    }

    dayEl.addEventListener('pointerdown', function(ev) {
      if (ev.button) return;                       /* 只认左键 / 触摸 */
      if (ev.target.closest('.todo-edit') || ev.target.closest('.todo-done')) return;
      var main = ev.target.closest('.todo-row-main');
      if (!main) return;
      var row = main.closest('.todo-row');
      if (row.classList.contains('is-editing')) return;   /* 正在改文字，别滑 */
      sw.row = row; sw.main = main;
      sw.x0 = ev.clientX; sw.y0 = ev.clientY;
      sw.base = row.classList.contains('is-open') ? -SW : 0;
      sw.dragging = false;
      swipeCloseAll(row);
    });

    window.addEventListener('pointermove', function(ev) {
      if (!sw.main) return;
      var dx = ev.clientX - sw.x0, dy = ev.clientY - sw.y0;
      if (!sw.dragging) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;  /* 竖向滑动交给列表滚动 */
        sw.dragging = true;
        sw.main.classList.add('dragging');
      }
      var x = sw.base + dx;
      x = x > 0 ? 0 : (x < -SW ? -SW : x);
      sw.main.style.transform = 'translateX(' + x + 'px)';
      if (ev.cancelable) ev.preventDefault();
    }, { passive: false });

    function endSwipe() {
      if (!sw.main) return;
      var row = sw.row, main = sw.main;
      main.classList.remove('dragging');
      if (sw.dragging) {
        var m = /-?[\d.]+/.exec(main.style.transform || '');
        var cur = m ? parseFloat(m[0]) : 0;
        setSwipe(row, cur < -SW / 2);
        /* 滑完那一下松手会补一个 click，别让它把复选框勾上 */
        sw.suppressClick = true;
        setTimeout(function() { sw.suppressClick = false; }, 80);
      }
      sw.row = null; sw.main = null; sw.dragging = false;
    }
    window.addEventListener('pointerup', endSwipe);
    window.addEventListener('pointercancel', endSwipe);

    /* ---- 编辑：点右侧铅笔，正文原地变成输入框，回车/对勾保存，Esc 取消 ---- */
    function beginEdit(row) {
      if (!row || row.classList.contains('is-editing')) return;
      var span = row.querySelector('.todo-text');
      var input = row.querySelector('.todo-edit-input');
      var text = span ? span.textContent : '';
      row.classList.add('is-editing');
      input.value = text;
      input.focus();
      input.setSelectionRange(text.length, text.length);
    }

    /* save=true 写回数据，false 只退出编辑（下次渲染还原原文） */
    function endEdit(row, save) {
      if (!row || !row.classList.contains('is-editing')) return;
      var input = row.querySelector('.todo-edit-input');
      var text = (input.value || '').trim();
      row.classList.remove('is-editing');
      if (save) editItem(row.getAttribute('data-id'), text);
    }

    dayEl.addEventListener('keydown', function(ev) {
      var input = ev.target;
      if (!input.classList || !input.classList.contains('todo-edit-input')) return;
      if (ev.key === 'Enter') {
        ev.preventDefault();
        endEdit(input.closest('.todo-row'), true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();               /* 别让 Esc 把整个卡片关掉 */
        endEdit(input.closest('.todo-row'), false);
      }
    });

    /* 点到别处就保存，跟记录页一致；延迟一下，免得和「✓」的 click 抢 */
    dayEl.addEventListener('focusout', function(ev) {
      var input = ev.target;
      if (!input.classList || !input.classList.contains('todo-edit-input')) return;
      var row = input.closest('.todo-row');
      setTimeout(function() {
        if (!row || !row.classList.contains('is-editing')) return;
        endEdit(row, true);
      }, 120);
    });

    dayEl.addEventListener('click', function(ev) {
      if (sw.suppressClick) { ev.preventDefault(); return; }
      if (ev.target.closest('.todo-day-close')) { closeDay(); return; }
      if (!ev.target.closest('.todo-day-card')) { closeDay(); return; }

      var row = ev.target.closest('.todo-row');
      if (!row) { swipeCloseAll(); return; }

      if (ev.target.closest('.todo-del')) { removeItem(row.getAttribute('data-id')); return; }
      if (ev.target.closest('.todo-edit')) { swipeCloseAll(); beginEdit(row); return; }
      if (ev.target.closest('.todo-done')) { endEdit(row, true); return; }

      /* 已经滑开的行：点正文只是把它推回去，别顺手勾上 */
      if (row.classList.contains('is-open')) {
        ev.preventDefault();
        setSwipe(row, false);
        return;
      }
      /* 编辑中点到这一行别的地方：当作保存 */
      if (row.classList.contains('is-editing') && !ev.target.closest('.todo-edit-input')) {
        endEdit(row, true);
      }
    });

    dayEl.addEventListener('change', function(ev) {
      if (!ev.target.classList.contains('todo-check')) return;
      var row = ev.target.closest('.todo-row');
      toggleItem(row.getAttribute('data-id'), ev.target.checked);
    });

    dayEl.querySelector('.todo-form').addEventListener('submit', function(ev) {
      ev.preventDefault();
      var input = this.querySelector('input');
      var text = (input.value || '').trim();
      if (!text) { input.focus(); return; }
      addItem(text);
      input.value = '';
      input.focus();
    });
  }

  function openDay(key) {
    dayKey = key;
    if (!dayEl) buildDay();
    dayEl.hidden = false;
    renderDay();
    var input = dayEl.querySelector('.todo-form input');
    if (input) setTimeout(function() { input.focus(); }, 60);
  }
  function closeDay() {
    if (dayEl) dayEl.hidden = true;
    dayKey = '';
  }

  function renderDay() {
    if (!dayEl || !dayKey) return;
    var parts = dayKey.split('-');
    var dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    dayEl.querySelector('.todo-day-title').textContent = (dt.getMonth() + 1) + ' 月 ' + dt.getDate() + ' 日';
    dayEl.querySelector('.todo-day-week').textContent = '星期' + WEEK[dt.getDay()];

    var list = listOf(dayKey);
    var ul = dayEl.querySelector('.todo-list');
    if (!list.length) {
      ul.innerHTML = '<li class="todo-empty">这一天还没有计划</li>';
      return;
    }
    /* 底层是「删除」，往左滑才露出来；正文层右边常驻 ✎ 编辑（编辑时换成 ✓ 保存） */
    ul.innerHTML = list.map(function(x) {
      return '<li class="todo-row' + (x.done ? ' done' : '') + '" data-id="' + x.id + '">'
        + '<button type="button" class="todo-del" title="删除" aria-label="删除">'
        + '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" focusable="false">'
        + '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor"'
        + ' stroke-width="2" stroke-linecap="round"/>'
        + '</svg></button>'
        + '<div class="todo-row-main">'
        + '<input type="checkbox" class="todo-check"' + (x.done ? ' checked' : '') + '>'
        + '<span class="todo-text">' + esc(x.text) + '</span>'
        + '<input type="text" class="todo-edit-input" autocomplete="off">'
        + '<button type="button" class="todo-edit" title="编辑" aria-label="编辑">'
        + '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false">'
        + '<path d="M4 20l1-5 10-10 4 4-10 10-5 1z" fill="none" stroke="currentColor"'
        + ' stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>'
        + '</svg></button>'
        + '<button type="button" class="todo-done" title="保存" aria-label="保存">'
        + '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">'
        + '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor"'
        + ' stroke-width="2.2" stroke-linecap="round" stroke-linejoin="miter"/>'
        + '</svg></button>'
        + '</div>'
        + '</li>';
    }).join('');
  }

  /* ---------- 增 / 删 / 勾 ---------- */
  function addItem(text) {
    if (!dayKey) return;
    var list = listOf(dayKey).slice();
    list.push({ id: 't' + Date.now() + Math.floor(Math.random() * 1000), text: text, done: false });
    setList(dayKey, list);
    persist(); pushSoon(); renderAll();
  }
  function toggleItem(id, done) {
    var list = listOf(dayKey).slice();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].done = !!done; break; }
    }
    setList(dayKey, list);
    persist(); pushSoon(); renderAll();
  }
  function removeItem(id) {
    /* 删空了也留一条空记录（del 墓碑），否则联网后会被云端旧副本补回来 */
    setList(dayKey, listOf(dayKey).filter(function(x) { return x.id !== id; }));
    persist(); pushSoon(); renderAll();
  }
  /* 改一条的文字；改成空的就等于删掉这条 */
  function editItem(id, text) {
    if (!dayKey) return;
    var list = listOf(dayKey), i;
    for (i = 0; i < list.length; i++) {
      if (list[i].id === id) break;
    }
    if (i >= list.length) return;
    if (!text) { removeItem(id); return; }
    if (list[i].text === text) return;
    list[i].text = text;
    setList(dayKey, list);
    persist(); pushSoon(); renderAll();
  }

  /* ---------- 导入 / 导出（Markdown） ----------
     和记录页一样：导出一份自包含的纯文本，导入时与本地按「日期 + 文字」合并去重，
     已存在的条目只更新完成状态，不会把本机多出来的计划删掉。 */
  function two(n) { return n < 10 ? '0' + n : '' + n; }
  function weekdayOf(key) {
    var p = key.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)).getDay();
  }
  function stampNow() {
    var t = new Date();
    return t.getFullYear() + '-' + two(t.getMonth() + 1) + '-' + two(t.getDate())
      + ' ' + two(t.getHours()) + ':' + two(t.getMinutes());
  }
  function buildMarkdown() {
    var keys = Object.keys(data).filter(function(k) {
      return data[k] && data[k].items && data[k].items.length;
    }).sort();
    var out = ['# Todo List', '', '> 导出时间：' + stampNow(), ''];
    keys.forEach(function(k) {
      out.push('## ' + k + ' 星期' + WEEK[weekdayOf(k)], '');
      data[k].items.forEach(function(it) {
        out.push('- [' + (it.done ? 'x' : ' ') + '] ' + (it.text || ''));
      });
      out.push('');
    });
    return { text: out.join('\n'), days: keys.length };
  }
  function exportMarkdown() {
    var md = buildMarkdown();
    if (!md.days) { toast('还没有计划可以导出'); return; }
    var t = new Date();
    var name = 'todo-list-' + t.getFullYear() + '-' + two(t.getMonth() + 1) + '-' + two(t.getDate()) + '.md';
    var blob = new Blob([md.text], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 400);
    toast('已导出 ' + md.days + ' 天计划');
  }
  /* 认两种写法：`## 2026-11-15 星期日` 或 `## 2026年11月15日`，下面是 `- [ ] / - [x]` 清单。
     没有日期标题的清单段落跳过，宁可少读也不乱塞。 */
  function parseMarkdown(text) {
    var out = {};
    var cur = null;
    var headRe = /^\s{0,3}#{1,6}\s*(.+?)\s*$/;
    var dateRe = /(\d{4})\s*[-\/年.]\s*(\d{1,2})\s*[-\/月.]\s*(\d{1,2})/;
    var itemRe = /^\s{0,3}[-*+]\s+\[([ xX])\]\s*(.+?)\s*$/;
    var lines = String(text || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h = headRe.exec(line);
      if (h) {
        cur = null;
        var dm = dateRe.exec(h[1]);
        if (dm) {
          var y = parseInt(dm[1], 10), mo = parseInt(dm[2], 10), d = parseInt(dm[3], 10);
          if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            cur = y + '-' + two(mo) + '-' + two(d);
            if (!out[cur]) out[cur] = [];
          }
        }
        continue;
      }
      if (!cur) continue;
      var it = itemRe.exec(line);
      if (it) {
        var txt = it[2].trim();
        if (txt) out[cur].push({ text: txt, done: it[1].toLowerCase() === 'x' });
      }
    }
    return out;
  }
  function importMarkdown(text) {
    var parsed = parseMarkdown(text);
    var days = Object.keys(parsed).filter(function(k) { return parsed[k].length; });
    if (!days.length) { toast('没读到计划，检查一下是不是 Markdown 清单'); return; }
    var added = 0, fixed = 0, touched = 0;
    days.forEach(function(k) {
      var list = listOf(k).slice();
      var byText = {};
      list.forEach(function(x) { byText[x.text] = x; });
      var changed = false;
      parsed[k].forEach(function(x) {
        var hit = byText[x.text];
        if (hit) {
          if (!!hit.done !== !!x.done) { hit.done = !!x.done; fixed++; changed = true; }
          return;
        }
        var item = { id: 't' + Date.now() + Math.floor(Math.random() * 1000), text: x.text, done: !!x.done };
        list.push(item);
        byText[x.text] = item;
        added++;
        changed = true;
      });
      if (changed) { setList(k, list); touched++; }
    });
    if (!touched) { toast('文件里的计划和本机一致，没有变动'); return; }
    persist(); pushSoon(); renderAll();
    toast('导入完成：新增 ' + added + ' 项' + (fixed ? '，更新完成状态 ' + fixed + ' 项' : '') + '，涉及 ' + touched + ' 天');
  }
  function pickMarkdown() {
    var input = fullEl && fullEl.querySelector('.todo-import-input');
    if (!input) return;
    input.value = '';          /* 同一个文件连导两次也能触发 change */
    input.click();
  }
  function onFilePicked(ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
      try { importMarkdown(String(reader.result || '')); }
      catch (e) { toast('导入失败：' + (e && e.message ? e.message : e)); }
    };
    reader.onerror = function() { toast('导入失败：文件读不出来'); };
    reader.readAsText(file, 'utf-8');
  }
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'todo-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.className = 'todo-toast out'; }, 1800);
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 2300);
  }

  function renderAll() {
    renderCard();
    if (fullEl && !fullEl.hidden) renderGrid();
    if (dayEl && !dayEl.hidden) renderDay();
  }

  /* ---------- 绑定 & 入口 ---------- */
  function mount(el) {
    if (!el) return;
    cardEl = el;
    cardEl.setAttribute('role', 'button');
    cardEl.setAttribute('tabindex', '0');
    cardEl.setAttribute('aria-label', '打开日历计划');
    cardEl.addEventListener('click', function() { openFull(); });
    cardEl.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openFull(); }
    });
    buildFull();
    renderCard();
    setSync('', getToken() ? '正在同步…' : '仅保存在本机浏览器');
    pull();
    /* 日期跨零点：回来切到前台时重画一次，别让「今天」停在昨天；
       顺带拉一次云端，手机上刚改的计划切到电脑就能看到 */
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) return;
      renderCard();
      if (Date.now() - lastPull > 15000) pull();
    });
    /* 窗口尺寸变了，格子能放几行也跟着变，整片重画一遍（被省略号收掉的条目要还回来） */
    window.addEventListener('resize', function() {
      if (fullEl && !fullEl.hidden) renderGrid();
    });
    /* 断网时改动只落本地，网络回来立刻补推 */
    window.addEventListener('online', function() { pull(); });
    /* 关页前把还没推上去的改动赶一赶（fire-and-forget，浏览器允许） */
    window.addEventListener('pagehide', function() {
      if (getToken() && pushTimer) { clearTimeout(pushTimer); push(); }
    });
  }

  document.addEventListener('keydown', function(ev) {
    if (ev.key !== 'Escape') return;
    if (dayEl && !dayEl.hidden) { closeDay(); return; }
    if (fullEl && !fullEl.hidden) closeFull();
  });

  window.TodoCalendar = { mount: mount, open: openFull, close: closeFull };
})();
