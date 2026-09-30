// app.js
// ------
// Maneja la NAVEGACIÓN entre las 4 pantallas y la cajita de AVISOS
// (mostrarAviso, que también usan las otras pantallas para avisar errores).
//
// Idea clave: la pantalla visible se guarda en la dirección (URL), después del
// símbolo "#". Por ejemplo: index.html#afinador. ¿Por qué? Porque así:
//   - el botón "atrás" del teléfono vuelve al Inicio en vez de cerrar la app,
//   - si recargas la página, sigues en la misma pantalla.
// Cada vez que cambia lo que va después del "#", el navegador avisa con el
// evento "hashchange" y nosotros mostramos la pantalla que corresponde.

"use strict";

// ===== 1. Elementos y datos que vamos a usar =====

// "querySelectorAll" busca TODOS los elementos con la clase "pantalla" (los 4 <section>)
const pantallas = document.querySelectorAll(".pantalla");
// La cajita de avisos de abajo
const aviso = document.getElementById("aviso");
// Nombre de la app, para armar el título de la pestaña
const NOMBRE_APP = "Guitarify";
// Cuántos milisegundos se queda visible un aviso (2800 ms = 2,8 segundos)
const DURACION_AVISO = 2800;

// ¿Hay una pantalla de Inicio "detrás" en el historial? Nos sirve para saber
// cómo regresar (ver la función regresar() más abajo).
// "let" (a diferencia de "const") crea una variable que SÍ se puede cambiar después.
let hayInicioDetras = false;
// Aquí guardamos el temporizador del aviso, para poder cancelarlo si aparece otro
let temporizadorAviso = null;

// ===== 2. Leer la pantalla desde la dirección =====

// Devuelve el nombre de la pantalla que indica la URL ("afinador", "notas", ...).
// Si no hay nada después del "#", o el nombre no existe, devuelve "inicio".
function pantallaDesdeURL() {
  // location.hash es lo que va después del "#", incluido el "#": "#afinador".
  // slice(1) le quita el primer carácter → "afinador"
  const nombre = location.hash.slice(1);
  // Comprobamos que exista una pantalla con ese nombre (por si alguien escribe cualquier cosa)
  const existe = document.getElementById("pantalla-" + nombre) !== null;
  return existe ? nombre : "inicio";
}

// ===== 3. Mostrar una pantalla =====

// Muestra la pantalla "nombre" y oculta las demás.
// "moverFoco" (true/false) indica si hay que llevar el foco al título:
// así, quien usa un lector de pantalla escucha a qué pantalla llegó.
function mostrarPantalla(nombre, moverFoco) {
  // Recorremos las 4 pantallas: la buscada queda visible, las otras con "hidden" (ocultas)
  pantallas.forEach((pantalla) => {
    pantalla.hidden = pantalla.id !== "pantalla-" + nombre; // "!==" = "es distinto de"
  });

  // Buscamos el título (h1) de la pantalla que quedó visible
  const titulo = document.querySelector(`#pantalla-${nombre} h1`);

  // Cambiamos el título de la pestaña: "Afinador · Guitarify" (o solo "Guitarify" en el Inicio)
  document.title = nombre === "inicio" ? NOMBRE_APP : `${titulo.textContent} · ${NOMBRE_APP}`;

  // Subimos al principio de la página (si veníamos de más abajo)
  window.scrollTo(0, 0);

  // Llevamos el foco al título, si nos lo pidieron
  if (moverFoco) titulo.focus();
}

// ===== 4. Ir a una pantalla y regresar =====

// Ir a una pantalla: cambiamos lo que va después del "#".
// Eso crea una entrada nueva en el historial (como visitar una página nueva)
// y dispara el evento "hashchange", que es el que realmente cambia la pantalla.
function irA(nombre) {
  hayInicioDetras = true;     // venimos desde el Inicio, así que queda "detrás"
  location.hash = nombre;
}

// Regresar al Inicio.
function regresar() {
  if (hayInicioDetras) {
    // Si el Inicio está detrás en el historial, simplemente "vamos atrás",
    // igual que el botón atrás del teléfono. Así el historial no se llena de copias.
    history.back();
  } else {
    // Si abrieron la app directo en otra pantalla (por ejemplo, recargaron en #notas),
    // no hay Inicio detrás: "reemplazamos" la dirección actual por la del Inicio.
    location.replace("#inicio");
  }
}

// Cada vez que cambia lo que va después del "#" (por un botón, por el botón
// atrás del teléfono o por el de adelante), mostramos la pantalla que corresponde
window.addEventListener("hashchange", () => {
  // Al salir de una pantalla apagamos el micrófono (función de microfono.js):
  // así nunca queda escuchando "a escondidas", y se ahorra batería
  apagarMicrofono();
  const nombre = pantallaDesdeURL();
  if (nombre === "inicio") hayInicioDetras = false; // ya estamos en el Inicio: no queda nada detrás
  mostrarPantalla(nombre, true);
});

// ===== 5. Avisos =====

// Muestra un texto en la cajita de abajo durante unos segundos
function mostrarAviso(texto) {
  aviso.textContent = texto;
  aviso.classList.add("visible");        // el CSS la hace aparecer
  clearTimeout(temporizadorAviso);       // si había otro aviso esperando para irse, lo cancelamos
  // setTimeout(función, milisegundos) = "ejecuta esto dentro de X milisegundos"
  temporizadorAviso = setTimeout(() => {
    aviso.classList.remove("visible");   // el CSS la esconde
  }, DURACION_AVISO);
}

// ===== 6. Conectar los botones =====

// Botones del menú: tienen el atributo data-ir="nombre-de-pantalla".
// "[data-ir]" entre corchetes = "cualquier elemento que tenga ese atributo".
document.querySelectorAll("[data-ir]").forEach((boton) => {
  // "addEventListener('click', ...)" = "cuando toquen este botón, haz esto".
  // boton.dataset.ir lee el valor del atributo data-ir (por ejemplo "afinador").
  boton.addEventListener("click", () => irA(boton.dataset.ir));
});

// Botones de regresar (la uñeta de arriba a la izquierda de cada pantalla)
document.querySelectorAll("[data-regresar]").forEach((boton) => {
  boton.addEventListener("click", regresar);
});

// ===== 7. Arranque =====

// Al abrir la app, mostramos la pantalla que diga la dirección (normalmente, el Inicio).
// "false" = sin mover el foco (al abrir la app no hace falta).
mostrarPantalla(pantallaDesdeURL(), false);

// ===== 8. Funcionar sin internet =====

// Registramos el "service worker" (sw.js), que guarda la app para usarla sin internet.
// Solo con https (la app publicada): en la compu (localhost) no lo activamos, para que
// cada cambio que hagas en el código se vea apenas recargas la página.
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // Si no se pudo registrar, la app funciona igual; solo necesitará internet para abrir
  });
}
