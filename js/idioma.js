// idioma.js
// ---------
// El IDIOMA de la app: español (es) o inglés (en).
//   - Guarda TODOS los textos de la app en los dos idiomas (sección 1).
//   - t("clave") devuelve el texto en el idioma elegido (sección 3).
//   - Los textos fijos de index.html tienen un atributo data-t="clave": al cambiar de
//     idioma, aplicarTextosFijos() los reemplaza a todos (sección 5).
//   - Los textos que escribe el JavaScript (por ejemplo «−12 cents · Baja») los vuelve a
//     escribir cada pantalla: escuchan el aviso "cambio-de-idioma" (alCambiarIdioma).
//   - En inglés, las notas usan el sistema inglés: Do = C, Re = D, Mi = E, Fa = F,
//     Sol = G, La = A, Si = B (y los acordes: Lam = Am, Fa♯m = F♯m, Si♭ = B♭).
// Se carga ANTES que los otros archivos de pantallas, porque todos usan t().
//
// ¿Por qué todos los textos juntos aquí, y no repartidos en cada archivo?
// Porque así, para corregir una palabra (o agregar un tercer idioma algún día),
// hay un solo lugar donde mirar, y se ve cada texto al lado de su traducción.

"use strict";

// ===== 1. Los textos, en los dos idiomas =====
//
// Cada texto tiene una "clave" (su nombre, igual en los dos idiomas).
// Algunos textos cambian según un dato (por ejemplo, qué cuerda): esos son FUNCIONES
// que reciben el dato y arman el texto. Ejemplo: cuerdaDetalle(6, "E2", "82,41 Hz").

const TEXTOS = {
  es: {
    // --- Selector de idioma ---
    idiomaGrupo: "Idioma",

    // --- Inicio ---
    lema: "Afina · Escucha · Toca",
    menuPrincipal: "Menú principal",
    afinadorTitulo: "Afinador",
    afinadorMenu: "Afina cada cuerda con el medidor de aguja",
    notasTitulo: "Notas y acordes",
    notasMenu: "Descubre qué nota o acorde estás tocando",
    cancionesTitulo: "Canciones",
    cancionesMenu: "Saca las notas y acordes de una canción, en orden",

    // --- Cosas que se repiten ---
    regresar: "Regresar al inicio",
    senal: "Señal",
    ordinal: (n) => n + "ª",                         // 6 → "6ª"
    alAire: "al aire",

    // --- Afinador ---
    medidorTitulo: "Medidor de afinación",
    afinada: "Afinada",
    eligeCuerda: "Elige una cuerda",
    afinacion: "Afinación",
    volverAutomatico: "Volver al modo automático",
    encenderMic: "Encender micrófono",
    apagarMic: "Apagar micrófono",
    oyendo: "oyendo",
    cuerdaDetalle: (ordinal, ingles, hz) => `${ordinal} cuerda · ${ingles} · ${hz}`,
    cuerdaAria: (numero, nota, ingles) => `Cuerda ${numero}: ${nota} (${ingles})`,
    consejoAfinada: "¡Afinada!",
    consejoBaja: (lejos) => (lejos ? "Muy baja" : "Baja") + ": aprieta un poco la clavija",
    consejoAlta: (lejos) => (lejos ? "Muy alta" : "Alta") + ": suelta un poco la clavija",
    afinadorApagado: "Enciende el micrófono para empezar a afinar",
    afinadorEspera: "Toca una cuerda al aire, cerca del micrófono",
    afinadorRuido: "Hay mucho ruido: toca una sola cuerda, cerca del micrófono",
    modoApagado: "Con el micrófono encendido, la app reconoce sola qué cuerda tocas.",
    modoAutomatico: "Modo automático: reconoce sola qué cuerda tocas.",
    modoManual: (ordinal, nota) => `Modo manual: afinando la ${ordinal} cuerda (${nota}).`,

    // --- Notas y acordes ---
    nota: "Nota",
    acorde: "Acorde",
    listo: "Listo",
    escuchando: "Escuchando",
    notasListo: "Toca «Empezar a escuchar» y luego una nota o un acorde.",
    notasEscuchando: "Toca una nota o un acorde y déjalo sonar.",
    empezarEscuchar: "Empezar a escuchar",
    dejarEscuchar: "Dejar de escuchar",
    notasRuido: "Hay mucho ruido: no distingo una nota ni un acorde. Prueba más cerca del micrófono o en un lugar más tranquilo.",
    notasDelAcorde: "Notas del acorde",
    comoSeToca: "Cómo se toca",
    dondeSeToca: "Dónde se toca",
    dedos: "Números = dedos: 1 índice · 2 medio · 3 anular · 4 meñique",
    lugar: (ordinal, traste) => `${ordinal}\u00a0cuerda, ${traste === 0 ? "al\u00a0aire" : "traste\u00a0" + traste}`, // \u00a0 = espacio que no se corta
    tambienSuena: (lugares) => `. También suena igual en: ${lugares}`,
    ultimasNotas: "Últimas notas",
    notasVacio: "Todavía no hay notas. Lo que toques aparecerá aquí.",
    mayor: "mayor",
    menor: "menor",

    // --- Canciones ---
    grabar: "Grabar",
    detener: (tiempo) => `Detener ${tiempo}`,
    elegirAudio: "Elegir audio",
    cancionesInicio: "Graba unos segundos de guitarra o elige un audio guardado.",
    grabacion: "Grabación",
    grabando: "Grabando… toca la canción cerca del micrófono y luego «Detener».",
    leyendo: (origen) => `Leyendo «${origen}»…`,
    buscandoAcordes: (origen, porcentaje) => `Buscando acordes en «${origen}»… ${porcentaje}%`,
    buscandoNotas: (origen, porcentaje) => `Buscando notas en «${origen}»… ${porcentaje}%`,
    cuantosAcordes: (n) => `${n} ${n === 1 ? "acorde" : "acordes"}`,
    cuantasNotas: (n) => `${n} ${n === 1 ? "nota" : "notas"}`,
    resultado: (origen, duracion, acordes, notas, recorte) => `«${origen}» · ${duracion} · ${acordes} y ${notas}${recorte}`,
    recorte: (tiempo) => ` (se analizaron los primeros ${tiempo})`,
    resumen: (partes) => "Usa " + partes.join(" — y "),
    noLeido: "No pude leer ese audio. Prueba con otro archivo (mp3, m4a o wav).",
    sinResultados: "No encontré notas ni acordes claros en este audio. Prueba con una guitarra sola, más cerca del micrófono.",
    noGraba: "Este navegador no permite grabar audio. Usa «Elegir audio».",
    listaTitulo: "Notas y acordes en orden",
    cancionesVacio: "Todavía no hay notas ni acordes. Aparecerán aquí después de analizar un audio.",
    notaCompleta: (nota, ingles) => `Nota ${nota} (${ingles})`,

    // --- Micrófono (errores) ---
    micPermiso: "Necesito permiso para usar el micrófono. Actívalo en la configuración del navegador.",
    micNoHay: "No encontré ningún micrófono en este aparato.",
    micNoSegura: "El micrófono solo funciona si la app se abre con https (o en localhost).",
    micError: "No se pudo encender el micrófono. Intenta de nuevo.",

    // --- Diagramas (los lee en voz alta un lector de pantalla) ---
    diagramaAcorde: (nombre, partes) => `Cómo se toca ${nombre}: ${partes}.`,
    cuerdaNoSeToca: (cuerda) => `cuerda ${cuerda} no se toca`,
    cuerdaAlAire: (cuerda) => `cuerda ${cuerda} al aire`,
    cuerdaTrasteDedo: (cuerda, traste, dedo) => `cuerda ${cuerda}, traste ${traste}, dedo ${dedo}`,
    diagramaNota: (nombre, cuerda, traste) => `Dónde se toca ${nombre}: cuerda ${cuerda}, ${traste === 0 ? "al aire" : "traste " + traste}.`,
  },

  en: {
    // --- Selector de idioma ---
    idiomaGrupo: "Language",

    // --- Inicio ---
    lema: "Tune · Listen · Play",
    menuPrincipal: "Main menu",
    afinadorTitulo: "Tuner",
    afinadorMenu: "Tune each string with the needle meter",
    notasTitulo: "Notes & chords",
    notasMenu: "Find out which note or chord you're playing",
    cancionesTitulo: "Songs",
    cancionesMenu: "Get the notes and chords of a song, in order",

    // --- Cosas que se repiten ---
    regresar: "Back to home",
    senal: "Signal",
    // En inglés: 1st, 2nd, 3rd y desde el 4 "th" (4th, 5th, 6th)
    ordinal: (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"),
    alAire: "open",

    // --- Afinador ---
    medidorTitulo: "Tuning meter",
    afinada: "In tune",
    eligeCuerda: "Choose a string",
    afinacion: "Tuning",
    volverAutomatico: "Back to automatic mode",
    encenderMic: "Turn on microphone",
    apagarMic: "Turn off microphone",
    oyendo: "hearing",
    cuerdaDetalle: (ordinal, ingles, hz) => `${ordinal} string · ${ingles} · ${hz}`,
    cuerdaAria: (numero, nota, ingles) => `String ${numero}: ${nota} (${ingles})`,
    consejoAfinada: "In tune!",
    // En inglés se dice "flat" (bemol = baja) y "sharp" (sostenido = alta)
    consejoBaja: (lejos) => (lejos ? "Very flat" : "Flat") + ": tighten the peg a little",
    consejoAlta: (lejos) => (lejos ? "Very sharp" : "Sharp") + ": loosen the peg a little",
    afinadorApagado: "Turn on the microphone to start tuning",
    afinadorEspera: "Play an open string, close to the microphone",
    afinadorRuido: "Too much noise: play a single string, close to the microphone",
    modoApagado: "With the microphone on, the app recognizes which string you play.",
    modoAutomatico: "Automatic mode: it recognizes which string you play.",
    modoManual: (ordinal, nota) => `Manual mode: tuning the ${ordinal} string (${nota}).`,

    // --- Notas y acordes ---
    nota: "Note",
    acorde: "Chord",
    listo: "Ready",
    escuchando: "Listening",
    notasListo: "Tap “Start listening” and then play a note or a chord.",
    notasEscuchando: "Play a note or a chord and let it ring.",
    empezarEscuchar: "Start listening",
    dejarEscuchar: "Stop listening",
    notasRuido: "Too much noise: I can't make out a note or a chord. Try closer to the microphone or somewhere quieter.",
    notasDelAcorde: "Notes in the chord",
    comoSeToca: "How to play it",
    dondeSeToca: "Where to play it",
    dedos: "Numbers = fingers: 1 index · 2 middle · 3 ring · 4 pinky",
    lugar: (ordinal, traste) => `${ordinal}\u00a0string, ${traste === 0 ? "open" : "fret\u00a0" + traste}`, // \u00a0 = espacio que no se corta
    tambienSuena: (lugares) => `. It also sounds the same on: ${lugares}`,
    ultimasNotas: "Recent notes",
    notasVacio: "No notes yet. What you play will show up here.",
    mayor: "major",
    menor: "minor",

    // --- Canciones ---
    grabar: "Record",
    detener: (tiempo) => `Stop ${tiempo}`,
    elegirAudio: "Choose audio",
    cancionesInicio: "Record a few seconds of guitar or choose a saved audio file.",
    grabacion: "Recording",
    grabando: "Recording… play the song close to the microphone and then tap “Stop”.",
    leyendo: (origen) => `Reading “${origen}”…`,
    buscandoAcordes: (origen, porcentaje) => `Looking for chords in “${origen}”… ${porcentaje}%`,
    buscandoNotas: (origen, porcentaje) => `Looking for notes in “${origen}”… ${porcentaje}%`,
    cuantosAcordes: (n) => `${n} ${n === 1 ? "chord" : "chords"}`,
    cuantasNotas: (n) => `${n} ${n === 1 ? "note" : "notes"}`,
    resultado: (origen, duracion, acordes, notas, recorte) => `“${origen}” · ${duracion} · ${acordes} and ${notas}${recorte}`,
    recorte: (tiempo) => ` (only the first ${tiempo} were analyzed)`,
    resumen: (partes) => "Uses " + partes.join(" — and "),
    noLeido: "I couldn't read that audio. Try another file (mp3, m4a or wav).",
    sinResultados: "I couldn't find clear notes or chords in this audio. Try a solo guitar, closer to the microphone.",
    noGraba: "This browser can't record audio. Use “Choose audio”.",
    listaTitulo: "Notes and chords in order",
    cancionesVacio: "No notes or chords yet. They'll show up here after analyzing an audio file.",
    notaCompleta: (nota, ingles) => `Note ${nota} (${ingles})`,

    // --- Micrófono (errores) ---
    micPermiso: "I need permission to use the microphone. Turn it on in the browser settings.",
    micNoHay: "I couldn't find a microphone on this device.",
    micNoSegura: "The microphone only works if the app is opened with https (or on localhost).",
    micError: "The microphone couldn't be turned on. Try again.",

    // --- Diagramas (los lee en voz alta un lector de pantalla) ---
    diagramaAcorde: (nombre, partes) => `How to play ${nombre}: ${partes}.`,
    cuerdaNoSeToca: (cuerda) => `string ${cuerda} not played`,
    cuerdaAlAire: (cuerda) => `string ${cuerda} open`,
    cuerdaTrasteDedo: (cuerda, traste, dedo) => `string ${cuerda}, fret ${traste}, finger ${dedo}`,
    diagramaNota: (nombre, cuerda, traste) => `Where to play ${nombre}: string ${cuerda}, ${traste === 0 ? "open" : "fret " + traste}.`,
  },
};

// ===== 2. El idioma elegido =====

// Nombre con el que el navegador recuerda el idioma elegido (localStorage)
const CLAVE_IDIOMA_GUARDADO = "guitarify-idioma";

// Lee el idioma que se eligió la última vez. Si no hay ninguno (o no se puede leer),
// empieza en español: es el idioma principal de la app.
function idiomaGuardado() {
  try {
    const guardado = localStorage.getItem(CLAVE_IDIOMA_GUARDADO);
    return guardado === "en" ? "en" : "es";
  } catch {
    return "es"; // modo privado o archivo abierto con doble clic: no se puede leer, no pasa nada
  }
}

let idioma = idiomaGuardado(); // "es" o "en" ("let" porque cambia al elegir otro)

// ===== 3. Pedir un texto =====

// Devuelve el texto "clave" en el idioma elegido. Si el texto es una función, le pasa
// los datos. Ejemplo: t("detener", "0:05") → "Detener 0:05" (o "Stop 0:05" en inglés).
// "..." (tres puntos) = "todos los datos que vengan, en una lista".
function t(clave, ...datos) {
  const texto = TEXTOS[idioma][clave] ?? TEXTOS.es[clave]; // "??" = si falta en inglés, usa el español
  return typeof texto === "function" ? texto(...datos) : texto;
}

// ===== 4. Nombres de notas y acordes en el idioma elegido =====

// Las 7 notas en español y su letra en el sistema inglés.
// "Sol" va antes que "Si" para que al buscar "Sol♯" no confunda el comienzo.
const NOTAS_AL_INGLES = [["Sol", "G"], ["Do", "C"], ["Re", "D"], ["Mi", "E"], ["Fa", "F"], ["La", "A"], ["Si", "B"]];

// Pasa un nombre español al sistema inglés, conservando lo que viene después
// (♯, ♭, "m" de menor). Ejemplos: "La" → "A", "Fa♯m" → "F♯m", "Si♭" → "B♭".
function alIngles(nombre) {
  for (const [espanol, ingles] of NOTAS_AL_INGLES) {
    if (nombre.startsWith(espanol)) return ingles + nombre.slice(espanol.length);
  }
  return nombre; // si no es un nombre de nota, lo deja igual
}

// El nombre de una nota o acorde como hay que MOSTRARLO: en español tal cual,
// en inglés traducido. (Los datos siempre se guardan en español: así, cambiar de
// idioma no cambia nada de lo que se reconoció, solo cómo se escribe.)
function nombreMusical(nombre) {
  return idioma === "en" ? alIngles(nombre) : nombre;
}

// El nombre completo de un acorde: "La menor" o "A minor".
// En español, los acordes menores terminan en "m" ("Lam"); los mayores, nunca.
function acordeCompleto(corto) {
  const esMenor = corto.endsWith("m");
  const raiz = esMenor ? corto.slice(0, -1) : corto;      // "Lam" → "La"
  return `${nombreMusical(raiz)} ${t(esMenor ? "menor" : "mayor")}`;
}

// Una frecuencia con la coma o el punto decimal de cada idioma: "82,41 Hz" o "82.41 Hz"
function hz(frecuencia, decimales) {
  return formatearHz(frecuencia, decimales, idioma); // formatearHz está en musica.js
}

// ===== 5. Cambiar de idioma =====

// Reemplaza todos los textos FIJOS de index.html. Cada elemento dice qué texto lleva:
//   data-t="clave"       → su texto visible
//   data-t-aria="clave"  → su aria-label (el nombre que lee un lector de pantalla)
function aplicarTextosFijos() {
  document.documentElement.lang = idioma; // <html lang="..."> (ayuda a lectores de pantalla y traductores)
  document.querySelectorAll("[data-t]").forEach((elemento) => {
    elemento.textContent = t(elemento.dataset.t);
  });
  document.querySelectorAll("[data-t-aria]").forEach((elemento) => {
    elemento.setAttribute("aria-label", t(elemento.dataset.tAria));
  });
  // Los botones del selector: el del idioma elegido queda "apretado" (el CSS lo pinta rojo)
  document.querySelectorAll("[data-idioma]").forEach((boton) => {
    boton.setAttribute("aria-pressed", String(boton.dataset.idioma === idioma));
  });
}

// Cambia al idioma "nuevo", lo recuerda y avisa a las pantallas para que reescriban sus textos
function cambiarIdioma(nuevo) {
  idioma = nuevo === "en" ? "en" : "es";
  try {
    localStorage.setItem(CLAVE_IDIOMA_GUARDADO, idioma);
  } catch {
    // si no se puede guardar, igual cambia; solo que la próxima vez empezará en español
  }
  aplicarTextosFijos();
  // Un "evento" es un aviso. Las pantallas lo escuchan con alCambiarIdioma (abajo)
  document.dispatchEvent(new Event("cambio-de-idioma"));
}

// Para que cada pantalla diga "cuando cambie el idioma, haz esto"
function alCambiarIdioma(accion) {
  document.addEventListener("cambio-de-idioma", accion);
}

// ===== 6. Arranque =====

// Los botones ES / EN del Inicio
document.querySelectorAll("[data-idioma]").forEach((boton) => {
  boton.addEventListener("click", () => cambiarIdioma(boton.dataset.idioma));
});
aplicarTextosFijos(); // si la última vez se eligió inglés, la app abre directo en inglés
