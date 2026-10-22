/* ==========================================================================
   右下角「随机前往一篇文章」按钮
   --------------------------------------------------------------------------
   1. 把按钮插进主题的 #rightside，直接复用主题自带的样式；
   2. 文章列表从本地搜索的 search.xml 里取（hexo-generator-searchdb 生成），
      首次取到后存进 sessionStorage，之后切页面就不用再请求了。
   ========================================================================== */
(function () {
  'use strict';

  var SEARCH_XML = '/search.xml';
  var CACHE_KEY = 'random-post:urls';

  function warn() {
    if (window.console && console.warn) {
      console.warn.apply(console, ['[random-post]'].concat([].slice.call(arguments)));
    }
  }

  function readCache() {
    try {
      var list = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      return Array.isArray(list) && list.length ? list : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(list) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(list));
    } catch (e) { /* 忽略 */ }
  }

  function fetchUrls() {
    return fetch(SEARCH_XML, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (xml) {
        var doc = new DOMParser().parseFromString(xml, 'text/xml');
        var nodes = doc.querySelectorAll('entry > url');
        var urls = [];
        for (var i = 0; i < nodes.length; i++) {
          var url = (nodes[i].textContent || '').trim();
          if (url) urls.push(url);
        }
        if (!urls.length) throw new Error('文章列表为空');
        writeCache(urls);
        return urls;
      });
  }

  function pick(urls) {
    var here = location.pathname;
    var pool = urls.filter(function (u) { return u !== here; });
    if (!pool.length) pool = urls;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function go(btn) {
    var cached = readCache();
    if (cached) {
      location.href = pick(cached);
      return;
    }
    btn.classList.add('is-loading');
    fetchUrls()
      .then(function (urls) { location.href = pick(urls); })
      .catch(function (err) {
        warn('取文章列表失败：', err);
        btn.classList.remove('is-loading');
      });
  }

  function inject() {
    if (document.getElementById('random-post')) return;
    var host = document.getElementById('rightside-config-show') || document.getElementById('rightside');
    if (!host) return;

    var btn = document.createElement('button');
    btn.id = 'random-post';
    btn.type = 'button';
    btn.title = '随机前往一篇文章';
    btn.setAttribute('aria-label', '随机前往一篇文章');
    btn.innerHTML = '<i class="fas fa-shuffle"></i>';

    var goUp = document.getElementById('go-up');
    host.insertBefore(btn, goUp || null);

    btn.addEventListener('click', function () { go(btn); });

    /* 顺手预取一次，点的时候就不用等了 */
    if (!readCache()) fetchUrls().catch(function () { /* 静默 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
