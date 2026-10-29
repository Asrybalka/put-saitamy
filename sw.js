// Путь Сайтамы — офлайн-режим.
// Всё приложение хранится в кэше телефона и открывается из него сразу, даже без сети.
// Когда интернет есть, кэш тихо обновляется в фоне.
const CACHE = "put-saitamy-v2";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function refresh(req, key) {
  return fetch(req, { cache: "no-cache" }).then((r) => {
    if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(key || req, copy)); }
    return r;
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Открытие приложения (с иконки, по ссылке, с любыми параметрами) — всегда из кэша
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = (await cache.match("./index.html")) || (await cache.match("./"));
      const update = refresh(req, "./index.html").catch(() => null);
      if (hit) { e.waitUntil(update); return hit; }
      const fresh = await update;
      return fresh || new Response("Нет интернета. Открой приложение один раз с интернетом.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })());
    return;
  }

  // Иконки, манифест: из кэша, обновление в фоне
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const update = refresh(req).catch(() => null);
    if (hit) { e.waitUntil(update); return hit; }
    return (await update) || Response.error();
  })());
});
