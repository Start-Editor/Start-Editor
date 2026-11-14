/* ── [B06] 原生启动屏逻辑 ───────────────────────────────────────────────
   依赖：B2 / B3
   维护：第三方原版 splash 脚本，保持原样
   ───────────────────────────────────────────────────────────── */
(function () {
        'use strict';

        var theme = '';
        var accent = '#75C1C4';

        try {
          var themeSetting = localStorage.getItem('tw:theme');
        } catch (e) {
          // ignore
        }
        if (themeSetting === 'light') {
          theme = 'light';
        } else if (themeSetting === 'dark') {
          theme = 'dark';
        } else if (themeSetting) {
          try {
            var parsed = JSON.parse(themeSetting);
            theme = parsed.gui || 'light';
            accent = parsed.accent || accent;
          } catch (e) {
            // ignore
          }
        }

        if (!theme) {
          theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        var splash = document.querySelector('.spash-waiting-for-js');
        splash.setAttribute('data-theme', theme);
        splash.style.color = accent;
        splash.hidden = false;

        var splashErrorTitle = document.querySelector('.splash-error-title');
        var splashError = document.querySelector('.splash-errors');
        var splashReset = document.querySelector('.splash-reset');

        var totalErrors = 0;
        window.onerror = function (event, source, line, col, err) {
          if (++totalErrors > 5) return; // dont bother logging more
          splashErrorTitle.hidden = splashError.hidden = splashReset.hidden = false;
          var el = document.createElement('div');
          el.textContent = 'Error (splash) in ' + source + ' (' + line + ':' + col + '): ' + err;
          splashError.appendChild(el);
        };

        splashReset.onclick = function () {
          splashReset.disabled = true;
          function hardRefresh() {
            var search = location.search.replace(/[?&]nocache=[\d.]+(?=$|&)/, '');
            // This is a functional cookie used so that we respond with Clear-Site-Data just once. No tracking.
            // Can't use nocache parameter to trigger this because people might accidentally bookmark that, and
            // then we would be clearing their cache on every visit.
            document.cookie = 'tw_clear_cache_once=1; max-age=60; path=/; samesite=strict; secure';
            location.replace(location.pathname + search + (search ? '&' : '?') + 'nocache=' + Math.floor(Math.random() * 10000000));
          }
          if ('serviceWorker' in navigator) {
            setTimeout(hardRefresh, 5000);
            navigator.serviceWorker.getRegistration("/")
              .then(function(registration) {
                if (registration) {
                  return registration.unregister();
                }
              })
              .then(hardRefresh)
              .catch(hardRefresh);
          } else {
            hardRefresh();
          }
        };

        window.SplashEnd = () => {
          splash.hidden = true;
          window.onerror = null;
        };
      })();