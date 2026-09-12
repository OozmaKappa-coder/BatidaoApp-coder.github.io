/* sw.js */

const CACHE_NAME = 'batidao-v5-fix-safearea';

const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png'
];

self.addEventListener(
  'install',
  function(event) {

    self.skipWaiting();

    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(
          function(cache) {
            return cache.addAll(
              ARQUIVOS_CACHE
            );
          }
        )
    );
  }
);

self.addEventListener(
  'activate',
  function(event) {

    event.waitUntil(

      caches.keys()
        .then(
          function(nomes) {

            return Promise.all(

              nomes
                .filter(
                  function(nome) {
                    return nome !==
                      CACHE_NAME;
                  }
                )
                .map(
                  function(nome) {
                    return caches.delete(
                      nome
                    );
                  }
                )

            );
          }
        )
        .then(
          function() {
            return self.clients.claim();
          }
        )
    );
  }
);

self.addEventListener(
  'fetch',
  function(event) {

    if (
      event.request.url.includes(
        'firebase'
      ) ||
      event.request.url.includes(
        'firestore'
      ) ||
      event.request.url.includes(
        'googleapis'
      )
    ) {
      return;
    }

    event.respondWith(

      fetch(event.request)
        .then(
          function(resposta) {

            const copiaResposta =
              resposta.clone();

            caches
              .open(CACHE_NAME)
              .then(
                function(cache) {

                  cache.put(
                    event.request,
                    copiaResposta
                  );
                }
              );

            return resposta;
          }
        )
        .catch(
          function() {

            return caches.match(
              event.request
            );
          }
        )
    );
  }
);