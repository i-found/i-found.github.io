/* 首页「日历计划」：卡片里是本月迷你月历 → 点整块卡片进全屏月历 → 点某一天弹当天的计划卡。
   两层嵌套沿用音乐页「专辑卡片 → 专辑详情 → 单曲浮层」的那套手感。

   数据存 localStorage 的 suihe_todos，形如
     { "2026-11-08": [ { id, text, done } ] }
   云端与记录页共用同一套密钥（localStorage 的 suihe_records_key）和同一台 API 主机，
   demo 阶段的端点约定为 /api/todos，收发 { todos: {...} }；
   后端还没这个接口时静默退回「仅本机」，不影响使用。 */
(function() {
  var STORE_KEY = 'suihe_todos';
  var TOKEN_KEY = 'suihe_records_key';           /* 与 record.html 共用 */
  var API_BASE = 'https://meimei.qzz.io';        /* 与 record.html 共用 */
  var API_PATH = '/api/todos';                   /* demo 约定，后端就绪后即可打通 */

  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  var data = load();
  var cardEl = null, fullEl = null, gridEl = null, titleEl = null, dayEl = null;
  var viewYear = 0, viewMonth = 0;   /* 全屏月历当前显示的月份 */
  var dayKey = '';                   /* 计划卡正在编辑的日期 */
  var pushTimer = null;

  /* ---------- 数据 ---------- */
  function load() {
    try {
      var d = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return d && typeof d === 'object' ? d : {};
    } catch (e) { return {}; }
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }
  function listOf(key) {
    var l = data[key];
    return Array.isArray(l) ? l : [];
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
    if (!getToken()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 900);
  }
  function push() {
    var token = getToken();
    if (!token) return;
    fetch(API_BASE + API_PATH, {
      method: 'POST',
      headers: { 'X-Records-Key': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ todos: data })
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setSync('ok', '已同步到云端');
    }).catch(function() {
      setSync('warn', '云端暂不可用，已保存在本机');
    });
  }
  function pull() {
    var token = getToken();
    if (!token) { setSync('', '仅保存在本机浏览器'); return; }
    setSync('', '正在同步…');
    fetch(API_BASE + API_PATH, { headers: { 'X-Records-Key': token } })
      .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function(d) {
        var cloud = d && d.todos;
        if (!cloud || typeof cloud !== 'object') { setSync('ok', '已同步到云端'); return; }
        /* demo 的合并规则：本机没有的日期才从云端补，避免覆盖刚编辑的内容 */
        var changed = false;
        Object.keys(cloud).forEach(function(k) {
          if (!data[k] && Array.isArray(cloud[k]) && cloud[k].length) { data[k] = cloud[k]; changed = true; }
        });
        if (changed) { persist(); renderAll(); }
        setSync('ok', '已同步到云端');
        if (changed) push();   /* 把补下来的并集再推回去，两边一致 */
      })
      .catch(function() {
        setSync('warn', '云端暂不可用，已保存在本机');
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
        ? '今天 ' + todayList.length + ' 项计划' + (undone ? '，还有 ' + undone + ' 项没做' : '，全部完成')
        : '今天还没有计划') + '</p>'
      + '<p class="todo-preview">' + previewText(todayList) + '</p>'
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
      if (listOf(c.key).length) cls += ' has-plan';
      html += '<span class="' + cls + '">' + c.d + '</span>';
    }
    return html;
  }

  function previewText(list) {
    if (!list.length) return '点一下这块，打开日历写今天要做的事';
    return list.slice(0, 3).map(function(x) {
      return '<b>·</b> ' + (x.done ? '<s>' + esc(x.text) + '</s>' : esc(x.text));
    }).join('<br>');
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
      + '<span class="todo-sync" title="仅保存在本机浏览器"></span>'
      + '<button type="button" class="todo-btn icon" data-act="prev" aria-label="上个月">‹</button>'
      + '<button type="button" class="todo-btn" data-act="today">今天</button>'
      + '<button type="button" class="todo-btn icon" data-act="next" aria-label="下个月">›</button>'
      + '<button type="button" class="todo-btn" data-act="close">关闭</button>'
      + '</div>'
      + '</div>'
      + '<div class="todo-week">' + WEEK.map(function(w) { return '<span>' + w + '</span>'; }).join('') + '</div>'
      + '<div class="todo-grid"></div>'
      + '</div>';
    document.body.appendChild(fullEl);
    gridEl = fullEl.querySelector('.todo-grid');
    titleEl = fullEl.querySelector('#todoTitle');

    fullEl.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-act]');
      if (btn) {
        var act = btn.getAttribute('data-act');
        if (act === 'close') closeFull();
        else if (act === 'prev') shiftMonth(-1);
        else if (act === 'next') shiftMonth(1);
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
    renderGrid();
    fullEl.hidden = false;
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
      var doneCount = list.filter(function(x) { return x.done; }).length;
      var cls = 'todo-cell';
      if (!c.inMonth) cls += ' is-out';
      if (c.key === todayKey) cls += ' is-today';
      var tag = list.length
        ? '<span class="todo-cell-tag">' + list.length + ' 项' + (doneCount === list.length ? ' · 已完成' : '') + '</span>'
        : '';
      var preview = list.length
        ? '<span class="todo-cell-t">' + list.slice(0, 2).map(function(x) {
            return x.done ? '<s>' + esc(x.text) + '</s>' : esc(x.text);
          }).join('<br>') + '</span>'
        : '';
      html += '<button type="button" class="' + cls + '" data-key="' + c.key + '">'
        + '<span class="todo-cell-d">' + c.d + '</span>' + tag + preview + '</button>';
    }
    gridEl.innerHTML = html;
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
      + '<button type="submit">添加</button>'
      + '</form>'
      + '</div>';
    document.body.appendChild(dayEl);

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
      if (ev.target.closest('.todo-day-close')) { closeDay(); return; }
      if (!ev.target.closest('.todo-day-card')) { closeDay(); return; }

      var row = ev.target.closest('.todo-row');
      if (!row) return;

      if (ev.target.closest('.todo-del')) { removeItem(row.getAttribute('data-id')); return; }
      if (ev.target.closest('.todo-edit')) { beginEdit(row); return; }
      if (ev.target.closest('.todo-done')) { endEdit(row, true); return; }

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
    /* 每条右边三个小圆钮：✎ 编辑、✓ 保存（编辑时才出现）、× 删除 */
    ul.innerHTML = list.map(function(x) {
      return '<li class="todo-row' + (x.done ? ' done' : '') + '" data-id="' + x.id + '">'
        + '<div class="todo-row-main">'
        + '<input type="checkbox" class="todo-check"' + (x.done ? ' checked' : '') + '>'
        + '<span class="todo-text">' + esc(x.text) + '</span>'
        + '<input type="text" class="todo-edit-input" autocomplete="off">'
        + '</div>'
        + '<div class="todo-act">'
        + '<button type="button" class="todo-edit" title="编辑">✎</button>'
        + '<button type="button" class="todo-done" title="保存">✓</button>'
        + '<button type="button" class="todo-del" title="删除">×</button>'
        + '</div>'
        + '</li>';
    }).join('');
  }

  /* ---------- 增 / 删 / 勾 ---------- */
  function addItem(text) {
    if (!dayKey) return;
    var list = listOf(dayKey).slice();
    list.push({ id: 't' + Date.now() + Math.floor(Math.random() * 1000), text: text, done: false });
    data[dayKey] = list;
    persist(); pushSoon(); renderAll();
  }
  function toggleItem(id, done) {
    var list = listOf(dayKey);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].done = !!done; break; }
    }
    data[dayKey] = list;
    persist(); pushSoon(); renderAll();
  }
  function removeItem(id) {
    data[dayKey] = listOf(dayKey).filter(function(x) { return x.id !== id; });
    if (!data[dayKey].length) delete data[dayKey];
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
    data[dayKey] = list;
    persist(); pushSoon(); renderAll();
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
    setSync('', '仅保存在本机浏览器');
    pull();
    /* 日期跨零点：回来切到前台时重画一次，别让「今天」停在昨天 */
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden) renderCard();
    });
  }

  document.addEventListener('keydown', function(ev) {
    if (ev.key !== 'Escape') return;
    if (dayEl && !dayEl.hidden) { closeDay(); return; }
    if (fullEl && !fullEl.hidden) closeFull();
  });

  window.TodoCalendar = { mount: mount, open: openFull, close: closeFull };
})();
