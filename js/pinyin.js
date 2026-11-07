/* 拼音搜索：让 "tianmao" / "tm" 也能搜到「天猫」。
   规则：输入含中文时照旧按原文匹配；纯字母时依次尝试 原文 → 全拼 → 首字母，
   命中后返回原文里的字符区间，供高亮使用。 */
(function() {
  var DICT = window.PINYIN_DICT || {};
  var MAP = {};
  for (var py in DICT) {
    if (!Object.prototype.hasOwnProperty.call(DICT, py)) continue;
    var charsInPy = DICT[py];
    for (var i = 0; i < charsInPy.length; i++) {
      if (!MAP[charsInPy[i]]) MAP[charsInPy[i]] = py;
    }
  }

  var cache = {}, cacheKeys = [], CACHE_MAX = 400;

  /* 纯字母（可含空格）才值得转拼音，别把 "2025" 也当拼音 */
  function lettersOnly(q) { return /^[a-z]+$/i.test(q); }

  /* 把一段文本展开成「全拼串」和「首字母串」，并记下每个字母来自第几个原字符 */
  function build(text) {
    if (cache[text]) return cache[text];
    var full = '', fullMap = [], first = '', firstMap = [], ch, word, k;
    for (var i = 0; i < text.length; i++) {
      ch = text.charAt(i);
      word = MAP[ch];
      if (word) {
        for (k = 0; k < word.length; k++) { full += word.charAt(k); fullMap.push(i); }
        first += word.charAt(0); firstMap.push(i);
      } else {
        ch = ch.toLowerCase();
        full += ch; fullMap.push(i);
        first += ch; firstMap.push(i);
      }
    }
    var res = { full: full, fullMap: fullMap, first: first, firstMap: firstMap };
    if (cacheKeys.length >= CACHE_MAX) { cache = {}; cacheKeys = []; }
    cache[text] = res;
    cacheKeys.push(text);
    return res;
  }

  /* 命中区间 [start, end)，找不到返回 null */
  function find(text, q) {
    if (!text || !q) return null;
    var ix = text.toLowerCase().indexOf(q.toLowerCase());
    if (ix >= 0) return { start: ix, end: ix + q.length };

    /* "tian mao" 这种按音节隔开的写法也认 */
    var compact = q.replace(/\s+/g, '');
    if (!compact || !lettersOnly(compact)) return null;
    var b = build(text);
    /* 拼音串统一小写，输入 zhanTai 也要能对上 */
    var ql = compact.toLowerCase();

    var p = b.full.indexOf(ql);
    if (p >= 0) return { start: b.fullMap[p], end: b.fullMap[p + ql.length - 1] + 1 };

    /* 首字母太容易撞车，至少两个字母才用 */
    if (ql.length >= 2) {
      var f = b.first.indexOf(ql);
      if (f >= 0) return { start: b.firstMap[f], end: b.firstMap[f + ql.length - 1] + 1 };
    }
    return null;
  }

  function hit(text, q) { return !!find(text, q); }

  window.PinyinMatch = { find: find, hit: hit };
})();
