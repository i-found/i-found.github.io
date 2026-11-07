/* 搜索历史：首页 / 音乐页 / 记录页共用一份（localStorage 里同一个 key），
   最多 10 条、最新在前、重复的提前。面板渲染也放在这里，
   免得三个页面各写一套、删除按钮和清空按钮的行为对不上。 */
(function() {
  var KEY = 'suihe_search_history', MAX = 10;

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
  function render(box, opts) {
    opts = opts || {};
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

  window.SearchHistory = {
    key: KEY,
    get: get,
    save: save,
    remove: remove,
    clear: clear,
    render: render
  };
})();
