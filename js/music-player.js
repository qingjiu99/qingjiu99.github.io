/* ==========================================================================
   迷你音乐播放器 · APlayer + Meting API（网易云歌单）
   --------------------------------------------------------------------------
   行为：
     1. 页面加载后请求 Meting 接口，拿到歌单数据，在左下角创建 APlayer；
     2. mini + fixed 形态 → 圆形唱片；点右侧箭头展开为卡片 + 歌单；
     3. 用 sessionStorage 记住「在放哪首 / 放到第几秒」，站内翻页后接着放；
     4. 把播放状态写到容器的 data-playing，样式据此决定唱片是否旋转。

   想换歌单：只改下面的 CONFIG.id（网易云歌单 ID）即可。
   想换颜色：改 _config.butterfly.yml → inject.head 里的 --heo-main。
   想换接口：改下面的 CONFIG.apis，:server / :type / :id 会被自动替换。
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    id: '17994049368',            /* 网易云歌单 ID */
    server: 'netease',            /* 平台：netease / tencent / kugou ... */
    type: 'playlist',             /* 类型：playlist / song / album / artist */
    apis: [
      'https://api.i-meto.com/meting/api?server=:server&type=:type&id=:id&r=:r',
      'https://api.injahow.cn/meting/?server=:server&type=:type&id=:id'
    ],
    theme: '#4f6ef7',             /* 兜底主题色，优先读 --heo-main */
    volume: 0.7,
    listMaxHeight: '320px',       /* 歌单面板最大高度，必须带单位 */
    storageName: 'mini-music-player',
    /* 命中这些路径就不显示迷你播放器（例如以后自建的音乐页） */
    exclude: [/^\/music(\/|$)/]
  };

  var STORAGE_KEY = 'mini-music-player:position';

  /* 供音乐馆页面（source/js/music-page.js）复用同一份歌单配置与取数据逻辑 */
  window.miniMusic = {
    config: CONFIG,
    load: function () { return loadPlaylist(0); },
    themeColor: themeColor
  };

  function warn() {
    if (window.console && console.warn) {
      console.warn.apply(console, ['[mini-music]'].concat([].slice.call(arguments)));
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /* 读取站点主色：跟随 inject.head 中的 --heo-main */
  function themeColor() {
    try {
      var value = getComputedStyle(document.documentElement).getPropertyValue('--heo-main').trim();
      if (value) return value;
    } catch (e) { /* 忽略 */ }
    return CONFIG.theme;
  }

  function buildUrl(template) {
    return template
      .replace(':server', CONFIG.server)
      .replace(':type', CONFIG.type)
      .replace(':id', CONFIG.id)
      .replace(':auth', '')
      .replace(':r', String(Math.random()));
  }

  /* 依次尝试各个 Meting 接口；整轮都失败就歇一下再来一轮（公共接口偶尔抽风） */
  function loadPlaylist(index, round) {
    round = round || 1;
    if (index >= CONFIG.apis.length) {
      if (round < 2) {
        warn('这一轮接口都失败了，稍后整体重试一次');
        return new Promise(function (resolve) {
          setTimeout(resolve, 1500);
        }).then(function () {
          return loadPlaylist(0, round + 1);
        });
      }
      return Promise.reject(new Error('所有 Meting 接口都不可用'));
    }
    var url = buildUrl(CONFIG.apis[index]);
    return fetch(url, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) throw new Error('歌单数据为空');
        return data;
      })
      .catch(function (err) {
        warn('接口不可用，换下一个：' + url, err);
        return loadPlaylist(index + 1, round);
      });
  }

  /* 播放进度记忆：站内翻页后接着放 */
  function readSaved() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function createPlayer(box, list) {
    var player = new window.APlayer({
      container: box,
      audio: list,
      fixed: true,
      mini: true,
      autoplay: false,          /* 浏览器会拦截自动播放，交给用户点一下 */
      mutex: true,
      preload: 'metadata',
      lrcType: 0,               /* 迷你播放器不展示歌词 */
      theme: themeColor(),
      loop: 'all',
      order: 'list',
      volume: CONFIG.volume,
      listFolded: true,
      listMaxHeight: CONFIG.listMaxHeight,
      storageName: CONFIG.storageName
    });

    function save() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
          i: player.list.index,
          t: player.audio.currentTime || 0,
          p: player.audio.paused ? 0 : 1
        }));
      } catch (e) { /* 忽略 */ }
    }

    function mark(playing) {
      box.setAttribute('data-playing', playing ? '1' : '0');
    }

    mark(!player.audio.paused);
    player.on('play', function () { mark(true); save(); });
    player.on('pause', function () { mark(false); save(); });
    player.on('ended', save);

    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    /* 播放中每 5 秒记一次进度，否则翻页回来只会从整首开头开始 */
    setInterval(function () {
      if (!player.audio.paused) save();
    }, 5000);

    /* 恢复上次的曲目与进度 */
    var saved = readSaved();
    if (saved && typeof saved.i === 'number' && player.list.audios[saved.i]) {
      if (saved.i !== player.list.index) player.list.switch(saved.i);

      var applied = false;
      var apply = function () {
        if (applied) return;
        applied = true;
        try {
          if (saved.t > 1) player.seek(saved.t);
        } catch (e) { /* 忽略 */ }
        if (saved.p) {
          try { player.play(); } catch (e) { /* 被浏览器拦截就保持暂停 */ }
        }
      };

      player.on('loadedmetadata', apply);
      /* 兜底：元数据已就绪时不会再触发 loadedmetadata */
      setTimeout(function () {
        if (player.audio.readyState >= 1) apply();
      }, 400);
    }

    /* 顺手挂到 window 上，方便在控制台里调试：miniMusicPlayer.play() 等 */
    window.miniMusicPlayer = player;

    return player;
  }

  function init() {
    if (CONFIG.exclude.some(function (re) { return re.test(location.pathname); })) return;
    if (document.querySelector('.mini-music')) return;   /* 防重复 */
    if (typeof window.APlayer !== 'function') {
      warn('APlayer 没能加载，跳过播放器。');
      return;
    }

    var box = document.createElement('div');
    box.className = 'aplayer mini-music';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', '音乐播放器');
    box.setAttribute('data-playing', '0');
    document.body.appendChild(box);

    loadPlaylist(0)
      .then(function (list) { createPlayer(box, list); })
      .catch(function (err) {
        warn('播放器初始化失败：', err);
        if (box.parentNode) box.parentNode.removeChild(box);
      });
  }

  ready(init);
})();
