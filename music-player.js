(function () {
  'use strict';

  var config = window.__BLOG_MUSIC_PLAYER__ || {};
  var playlistId = String(config.playlistId || '').trim();
  // Meting 接口在服务端解析网易云数据，响应带 Access-Control-Allow-Origin: *，
  // 因此浏览器可以跨域读取；直接请求 music.163.com 的接口会被 CORS 拦截。
  var metingApi = String(config.metingApi || 'https://api.injahow.cn/meting/').trim();
  var idleTimeout = Number(config.idleTimeout || 20000);

  if (!playlistId) return;

  var playlistUrl = 'https://music.163.com/#/playlist?id=' + encodeURIComponent(playlistId);

  var player = document.createElement('aside');
  player.id = 'site-music-player';
  player.setAttribute('aria-label', '网易云音乐播放器');
  player.innerHTML = [
    '<button class="music-player-tab" type="button" aria-label="展开音乐播放器" aria-expanded="false" title="展开音乐播放器">',
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
    '</svg></button>',
    '<div class="music-player-panel" role="dialog" aria-label="网易云音乐">',
    '<button class="music-player-close" type="button" aria-label="收起音乐播放器" title="收起">&times;</button>',
    '<h2 class="music-player-heading">网易云音乐</h2>',
    '<p class="music-player-hint">点击播放，闲置后自动缩回侧边</p>',
    '<div class="music-player-embed" id="music-player-audio"><p class="music-player-status">歌单加载中…</p></div>',
    '<a class="music-player-link" href="' + playlistUrl + '" target="_blank" rel="noopener noreferrer">在网易云打开歌单</a>',
    '</div>'
  ].join('');
  document.body.appendChild(player);

  var audioHost = player.querySelector('#music-player-audio');
  var tab = player.querySelector('.music-player-tab');
  var closeBtn = player.querySelector('.music-player-close');
  var idleTimer = null;

  function setOpen(open) {
    player.classList.toggle('is-open', open);
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-label', open ? '收起音乐播放器' : '展开音乐播放器');
    if (open) scheduleIdleCollapse(); else clearTimeout(idleTimer);
  }

  function scheduleIdleCollapse() {
    clearTimeout(idleTimer);
    if (!idleTimeout) return;
    idleTimer = setTimeout(function () { setOpen(false); }, idleTimeout);
  }

  tab.addEventListener('click', function () { setOpen(!player.classList.contains('is-open')); });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('pointerdown', function (event) {
    if (player.classList.contains('is-open') && !player.contains(event.target)) setOpen(false);
  });
  ['pointerdown', 'pointermove', 'keydown', 'wheel'].forEach(function (type) {
    player.addEventListener(type, function () {
      if (player.classList.contains('is-open')) scheduleIdleCollapse();
    }, { passive: true });
  });

  function fail(message) {
    audioHost.innerHTML = '<p class="music-player-status">' + message + '</p>';
  }

  function loadAssets(done) {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/vendor/aplayer/APlayer.min.css';
    document.head.appendChild(link);

    var script = document.createElement('script');
    script.src = '/vendor/aplayer/APlayer.min.js';
    script.onload = done;
    script.onerror = function () { fail('播放器资源加载失败，请刷新页面重试。'); };
    document.head.appendChild(script);
  }

  loadAssets(function () {
    var url = metingApi + (metingApi.indexOf('?') === -1 ? '?' : '&') +
      'server=netease&type=playlist&id=' + encodeURIComponent(playlistId);

    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (list) {
        var audio = (Array.isArray(list) ? list : []).filter(function (song) {
          return song && song.url;
        }).map(function (song) {
          return {
            name: song.name || '未知曲目',
            artist: song.artist || '网易云音乐',
            url: song.url,
            cover: song.pic || '',
            lrc: song.lrc || ''
          };
        });

        if (!audio.length) throw new Error('empty');

        audioHost.innerHTML = '';
        new window.APlayer({
          container: audioHost,
          audio: audio,
          theme: '#d84b61',
          lrcType: audio[0].lrc ? 3 : 0,
          listFolded: false,
          listMaxHeight: '180px',
          mutex: true,
          autoplay: false,
          preload: 'none',
          volume: 0.7,
          storageName: 'blog-music-player'
        });
      })
      .catch(function () {
        fail('歌单加载失败，请点击下方链接在网易云收听。');
      });
  });
})();
