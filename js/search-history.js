/* 搜索历史：每个页面各存一份，互不串门。
     在首页搜的词只留在首页的历史里，音乐页、记录页看不到；
     隔离靠 key 的命名空间实现（suihe_search_history:index / :music / :record），
     命名空间取自当前页面的文件名，不需要各页手动声明。
   每条最多 10 条、最新在前、重复的提前；面板渲染也放在这里，
   免得三个页面各写一套、删除按钮和清空按钮的行为对不上。 */
(function() {
  /* index.html / music.html / record.html → index / music / record */
  function detectNs() {
    var file = (location.pathname.split('/').pop() || '').toLowerCase();
    return file.replace(/\.html?$/, '') || 'index';
  }

  var NS = detectNs();
  var KEY = 'suihe_search_history:' + NS, MAX = 10;

  /* 老版本三页共用一个 key（suihe_search_history），那份数据分不清是哪页搜的，
     抄给任何一页都会让三页看起来又「串」了，直接丢掉，各页从零开始记。 */
  try { localStorage.removeItem('suihe_search_history'); } catch (e) {}

  function get() {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      if (!Array.isArray(list)) return [];
      return list.filter(function(w) { return typeof w === 'string' && w.trim(); }).slice(0, MAX);
    } catch (e) { return []; }
  }

  function put(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch (e) {}
  }

  function save(word) {
    word = (word || '').trim();
    if (!word) return get();
    var list = get().filter(function(w) { return w !== word; });
    list.unshift(word);
    put(list);
    return list;
  }

  /* 删单条 */
  function remove(word) {
    var list = get().filter(function(w) { return w !== word; });
    put(list);
    return list;
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  /* 把历史画进 box，返回 [{ word, isHistory:true }]，顺序与 DOM 一致，供键盘导航用。
     opts.input    输入框（回填 / 聚焦）
     opts.onPick   点了某条词
     opts.onChange 面板内容变了（删除 / 清空），参数是新的 rows */
  /* 记住谁在展示历史：别的标签页写入了新词，就地把这几块面板重画一遍 */
  var panels = [];
  function remember(box, opts) {
    for (var i = 0; i < panels.length; i++) {
      if (panels[i].box === box) { panels[i].opts = opts; return; }
    }
    panels.push({ box: box, opts: opts });
  }

  function render(box, opts) {
    opts = opts || {};
    /* 打标记：只有「正在显示历史」的面板才跟着别的标签页刷新，
       正在显示搜索结果的面板不要被历史覆盖掉 */
    box.dataset.srMode = 'history';
    remember(box, opts);
    box.innerHTML = '';
    var list = get();
    var rows = [];
    if (!list.length) { box.hidden = true; return rows; }

    var head = document.createElement('div');
    head.className = 'sr-head';
    var title = document.createElement('span');
    title.textContent = '最近搜索';
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sr-clear';
    clearBtn.textContent = '清空';
    clearBtn.addEventListener('click', function(e) {
      /* 重建面板后这个按钮已不在文档里，冒泡到 document 会被误判成「点了外部」 */
      e.stopPropagation();
      clear();
      var next = render(box, opts);
      if (opts.onChange) opts.onChange(next);
      if (opts.input) opts.input.focus();
    });
    head.appendChild(title);
    head.appendChild(clearBtn);
    box.appendChild(head);

    list.forEach(function(word) {
      var row = document.createElement('div');
      row.className = 'sr-item sr-history';

      var pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'sr-hword';
      var f = document.createElement('span');
      f.className = 'sr-field';
      f.textContent = word;
      pick.appendChild(f);
      pick.addEventListener('click', function(e) {
        e.stopPropagation();
        if (opts.input) opts.input.value = word;
        save(word);
        if (opts.onPick) opts.onPick(word);
        if (opts.input) opts.input.focus();
      });

      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'sr-del';
      del.title = '删除这条';
      del.setAttribute('aria-label', '删除这条搜索记录');
      del.textContent = '×';
      del.addEventListener('click', function(e) {
        e.stopPropagation();
        remove(word);
        var next = render(box, opts);
        if (opts.onChange) opts.onChange(next);
        if (opts.input) opts.input.focus();
      });

      row.appendChild(pick);
      row.appendChild(del);
      box.appendChild(row);
      rows.push({ word: word, isHistory: true });
    });

    box.hidden = false;
    return rows;
  }

  /* 面板改成显示搜索结果前调一下，免得被别的标签页的历史更新覆盖 */
  function detach(box) {
    if (box) box.dataset.srMode = '';
  }

  /* storage 事件只在「别的标签页」改动时触发：同一页面的另一个标签刚搜的词、
     刚删的词，这边开着的历史面板立刻跟上，不用手动刷新。
     key 里带了页面命名空间，所以别的页面怎么改都不会惊动这里。 */
  window.addEventListener('storage', function(e) {
    if (e.key !== KEY) return;
    for (var i = panels.length - 1; i >= 0; i--) {
      var w = panels[i];
      if (!w.box.isConnected) { panels.splice(i, 1); continue; }
      if (w.box.dataset.srMode !== 'history') continue;
      var rows = render(w.box, w.opts);
      if (w.opts.onChange) w.opts.onChange(rows);
    }
  });

  window.SearchHistory = {
    ns: NS,
    key: KEY,
    get: get,
    save: save,
    remove: remove,
    clear: clear,
    render: render,
    detach: detach
  };
})();
