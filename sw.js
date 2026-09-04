/* =====================================================================
   SERVICE WORKER — Batidão App
   Garante atualização automática sempre que o GitHub for atualizado.
   ===================================================================== */

const CACHE_NAME = 'batidao-v2';

// Arquivos que ficam em cache para funcionar offline
const ARQUIVOS_CACHE = [
  './',
  './index.html',
  './script.js',
  './style.css',
  './manifest.json'
];

// Instala e salva os arquivos no cache
self.addEventListener('install', function(event) {
  self.skipWaiting(); // Ativa imediatamente sem esperar fechar abas antigas
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ARQUIVOS_CACHE);
    })
  );
});

// Quando ativa, apaga caches antigos
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(nomes) {
      return Promise.all(
        nomes.filter(function(nome) {
          return nome !== CACHE_NAME;
        }).map(function(nome) {
          return caches.delete(nome);
        })
      );
    }).then(function() {
      return self.clients.claim(); // Toma controle de todas as abas abertas
    })
  );
});

// Estratégia: tenta buscar da rede primeiro (sempre pega versão mais nova)
// Se offline, usa o cache
self.addEventListener('fetch', function(event) {
  // Ignora requisições do Firebase (sempre precisam de rede)
  if (event.request.url.includes('firebase') ||
      event.request.url.includes('firestore') ||
      event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(function(resposta) {
        // Salva cópia no cache para uso offline
        const copiaResposta = resposta.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, copiaResposta);
        });
        return resposta;
      })
      .catch(function() {
        // Sem internet: usa cache
        return caches.match(event.request);
      })
  );
});
