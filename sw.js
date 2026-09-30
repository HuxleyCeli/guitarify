// sw.js — "service worker"
// ------------------------
// Un service worker es un pequeño programa que el navegador guarda y ejecuta
// "por detrás" de la app, aunque la página esté cerrada. Lo usamos para una
// sola cosa: que Guitarify FUNCIONE SIN INTERNET.
//
// Cómo funciona:
//  1. La primera vez que alguien abre la app (con internet), guarda una copia de
//     todos sus archivos en una "caché" (un almacén del navegador).
//  2. Las veces siguientes, entrega esos archivos desde la caché al instante,
//     y en segundo plano pide la versión nueva a internet para la próxima vez.
//     (Esta estrategia se llama "stale-while-revalidate": usar lo guardado
//     mientras se revalida.)
//  3. Si no hay internet, igual funciona con lo guardado.
//
// Solo se activa cuando la app se abre con https (en GitHub Pages). En la compu,
// con localhost, no se activa, para que cada cambio que hagas se vea al recargar.
// Ver el final de js/app.js.

"use strict";

// Nombre de la caché. Si algún día cambias la LISTA de archivos de abajo, sube el
// número (v2, v3...) para que el navegador borre la caché vieja y cree una nueva.
const VERSION = "guitarify-v1";

// Todos los archivos que necesita la app para funcionar sin internet
const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilos.css",
  "./js/musica.js",
  "./js/microfono.js",
  "./js/medidor.js",
  "./js/afinador.js",
  "./js/notas.js",
  "./js/canciones.js",
  "./js/app.js",
  "./assets/fuentes/anton.woff2",
  "./assets/imagenes/textura-ruido.svg",
  "./assets/iconos/favicon.svg",
  "./assets/iconos/icono-180.png",
  "./assets/iconos/icono-192.png",
  "./assets/iconos/icono-512.png",
  "./assets/iconos/icono-maskable-512.png",
];

// "install": pasa una vez, cuando el navegador descarga este service worker.
// Guardamos todos los archivos en la caché.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS_APP))
      .then(() => self.skipWaiting()) // se activa de inmediato, sin esperar a que se cierre la app
  );
});

// "activate": pasa cuando este service worker toma el control.
// Borramos las cachés de versiones anteriores para no ocupar espacio de más.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((nombre) => nombre !== VERSION).map((nombre) => caches.delete(nombre))))
      .then(() => self.clients.claim()) // empieza a atender a las páginas ya abiertas
  );
});

// "fetch": pasa CADA VEZ que la app pide un archivo
self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  // Solo atendemos lecturas (GET) de nuestros propios archivos; lo demás pasa directo
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const guardada = await cache.match(pedido, { ignoreSearch: true }); // ¿tenemos una copia?

    // Pedimos la versión nueva a internet y, si llega bien, actualizamos la copia
    const desdeInternet = fetch(pedido)
      .then((respuesta) => {
        if (respuesta.ok) cache.put(pedido, respuesta.clone());
        return respuesta;
      })
      .catch(() => null); // sin internet: null

    if (guardada) {
      evento.waitUntil(desdeInternet); // actualiza en segundo plano...
      return guardada;                 // ...pero responde YA con la copia guardada
    }
    const respuesta = await desdeInternet;
    if (respuesta) return respuesta;
    // Sin copia y sin internet: si se pedía una página, entregamos la app igual
    if (pedido.mode === "navigate") return cache.match("./index.html");
    return Response.error();
  })());
});
