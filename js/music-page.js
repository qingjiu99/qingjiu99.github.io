/* ==========================================================================
   音乐馆页面（/music/）的完整播放器
   --------------------------------------------------------------------------
   和左下角的迷你播放器共用同一份配置：miniMusic.config / miniMusic.load()
   区别是这里用非吸底的大播放器，显示歌词和完整歌单。
   ========================================================================== */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var box = document.getElementById('music-hall');
    if (!box) return;

    if (typeof window.APlayer !== 'function' || !window.miniMusic) {
      box.innerHTML = '<p class="music-hall-tip">播放器资源没加载成功，刷新页面试试。</p>';
      return;
    }

    var cfg = window.miniMusic.config;

    window.miniMusic.load()
      .then(function (list) {
        box.innerHTML = '';
        box.classList.remove('is-loading');

        window.musicHallPlayer = new window.APlayer({
          container: box,
          audio: list,
          theme: window.miniMusic.themeColor(),
          lrcType: 3,                 /* 大播放器显示歌词 */
          listFolded: false,
          listMaxHeight: '420px',
          mutex: true,
          autoplay: false,
          preload: 'none',
          volume: 0.7,
          storageName: cfg.storageName + '-hall'
        });
      })
      .catch(function (err) {
        if (window.console && console.warn) console.warn('[music-hall] 歌单加载失败：', err);
        box.innerHTML = '<p class="music-hall-tip">歌单加载失败，请稍后刷新重试。</p>';
      });
  });
})();
