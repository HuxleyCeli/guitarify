// notas.js
// --------
// La pantalla de NOTAS Y ACORDES: escucha en vivo y dice qué suena.
//   - Si suena UNA nota limpia (claridad alta), muestra la nota: "La", A2, 110 Hz.
//   - Si suenan VARIAS notas a la vez, busca el acorde: "Lam" (La menor, Am).
//   - Muestra un diagrama: cómo se toca el acorde, o DÓNDE se toca la nota en el mástil.
//   - Guarda las últimas cosas reconocidas en un historial.
// Usa musica.js (detectar nota y acorde) y microfono.js (escuchar).

"use strict";

// ===== 1. Ajustes =====

// Claridad mínima para decir que es UNA nota (medido en pruebas: una nota da ~1,0 y un acorde, nada)
const NOTAS_CLARIDAD_NOTA = 0.9;
// Con menos claridad no la mostramos, pero desde 0,85 igual sabemos que SUENA una nota
// (por ejemplo, una cuerda que se está apagando): eso no cuenta como ruido
const NOTAS_CLARIDAD_SUENA = 0.85;
// Cuántas lecturas IGUALES seguidas hacen falta para mostrar algo (4 × 50 ms = 0,2 segundos).
// Así no aparecen en pantalla los "saltos" de un instante.
const NOTAS_LECTURAS_ESTABLES = 4;
// Cuántas cosas guarda el historial
const NOTAS_TAMANO_HISTORIAL = 8;

// ===== 2. Estado =====

let notasCandidata = null;   // lo último que se detectó (todavía sin confirmar)
let notasRepeticiones = 0;   // cuántas veces seguidas se detectó
let notasMostrada = null;    // lo que está en pantalla ahora
let notasHistorial = [];     // lista de lo reconocido, la más reciente primero
const notasDetectorRuido = crearDetectorDeRuido(); // avisa si hay mucho ruido (está en musica.js)

// ===== 3. Elementos de la página =====

const notasTipo = document.getElementById("notas-tipo");
const notasNombre = document.getElementById("notas-nombre");
const notasDetalle = document.getElementById("notas-detalle");
const notasDelAcorde = document.getElementById("notas-del-acorde");
const notasNivel = document.getElementById("notas-nivel");
const notasBoton = document.getElementById("notas-mic");
const notasListaHistorial = document.getElementById("notas-historial");
const notasVacio = document.getElementById("notas-vacio");
const notasDiagrama = document.getElementById("notas-diagrama");             // la caja "Cómo se toca"
const notasDiagramaDibujo = document.getElementById("notas-diagrama-dibujo"); // donde va el dibujo
const notasDiagramaTitulo = document.getElementById("notas-diagrama-titulo"); // "Cómo se toca" o "Dónde se toca"
const notasDiagramaAyuda = document.getElementById("notas-diagrama-ayuda");   // el texto de abajo del dibujo
const notasRuido = document.getElementById("notas-ruido");                   // el aviso "Hay mucho ruido"

// ===== 4. Reconocer =====

// Decide qué suena en este instante. Devuelve un objeto con lo que se reconoció, o null.
// Los nombres se guardan en español (son los DATOS); recién al mostrarlos se escriben
// en el idioma elegido (ver "textosDeDeteccion" abajo). Así, si cambias de idioma,
// lo que ya se reconoció (y el historial) se reescribe en el idioma nuevo.
function reconocerSonido(tono, obtenerCroma) {
  // Caso 1: una sola nota limpia
  if (tono && tono.claridad >= NOTAS_CLARIDAD_NOTA) {
    const nota = frecuenciaANota(tono.frecuencia);        // función de musica.js
    return {
      clave: nota.ingles,                                  // "A2": identifica esta detección
      numero: nota.numero,                                 // 45: el número de nota, para buscarla en el mástil
      tipo: "nota",
      nombre: nota.nombre,                                 // "La"
      ingles: nota.ingles,                                 // "A2"
      frecuencia: tono.frecuencia,                         // 110 (Hz)
      notas: [],
    };
  }
  // Caso 2: varias notas → buscamos el acorde que más se parece
  const acorde = detectarAcorde(obtenerCroma());           // función de musica.js
  if (acorde && acorde.similitud >= SIMILITUD_MINIMA_ACORDE) {
    return {
      clave: acorde.corto,                                 // "Lam"
      tipo: "acorde",
      nombre: acorde.corto,                                // "Lam"
      ingles: acorde.ingles,                               // "Am"
      notas: acorde.notas,                                 // ["La", "Do", "Mi"]
    };
  }
  return null; // no se reconoció nada seguro
}

// Los textos de una detección en el idioma elegido (las funciones están en idioma.js).
// Ejemplo en español: { tipo: "Acorde", nombre: "Lam", detalle: "La menor · Am" }
//         en inglés:  { tipo: "Chord",  nombre: "Am",  detalle: "A minor" }
function textosDeDeteccion(deteccion) {
  let detalle;
  if (deteccion.tipo === "nota") {
    detalle = `${deteccion.ingles} · ${hz(deteccion.frecuencia, 1)}`;   // "A2 · 110,0 Hz"
  } else {
    const completo = acordeCompleto(deteccion.nombre);                  // "La menor" o "A minor"
    // En español agregamos el cifrado inglés ("· Am"); en inglés ya es el mismo nombre
    detalle = idioma === "en" ? completo : `${completo} · ${deteccion.ingles}`;
  }
  return {
    tipo: t(deteccion.tipo),                       // "Nota"/"Note" o "Acorde"/"Chord"
    nombre: nombreMusical(deteccion.nombre),       // "La"/"A" o "Lam"/"Am"
    detalle,
    notas: deteccion.notas.map(nombreMusical),     // ["La", "Do", "Mi"] o ["A", "C", "E"]
  };
}

// microfono.js llama a esta función unas 20 veces por segundo
function procesarSonidoNotas({ volumen, tono, obtenerCroma }) {
  notasNivel.style.setProperty("--nivel", nivelVisual(volumen) + "%");
  const ahora = performance.now(); // milisegundos desde que se abrió la página
  if (volumen < UMBRAL_SILENCIO) {
    notasCandidata = null; // silencio: reiniciamos la cuenta, pero dejamos en pantalla lo último
    notasRepeticiones = 0;
    notasRuido.hidden = !notasDetectorRuido.agregar("silencio", ahora);
    return;
  }

  const deteccion = reconocerSonido(tono, obtenerCroma);
  // Para el detector de ruido: ¿se reconoció algo, o al menos suena una nota?
  const suenaAlgo = deteccion || (tono && tono.claridad >= NOTAS_CLARIDAD_SUENA);
  // El aviso se muestra solo si el detector dice que hay mucho ruido ("hidden" = oculto)
  notasRuido.hidden = !notasDetectorRuido.agregar(suenaAlgo ? "claro" : "confuso", ahora);
  // ¿Es lo mismo que la vez anterior? Entonces sumamos una repetición; si no, empezamos de nuevo
  if (deteccion && notasCandidata && deteccion.clave === notasCandidata.clave) {
    notasRepeticiones++;
  } else {
    notasCandidata = deteccion;
    notasRepeticiones = 1;
  }

  // Recién cuando se repite lo suficiente, lo mostramos (y solo si cambió)
  if (notasCandidata && notasRepeticiones === NOTAS_LECTURAS_ESTABLES) {
    if (!notasMostrada || notasMostrada.clave !== notasCandidata.clave) {
      mostrarDeteccion(notasCandidata);
      agregarAlHistorial(notasCandidata);
    }
  }
}

// ===== 5. Mostrar =====

function mostrarDeteccion(deteccion) {
  notasMostrada = deteccion;
  const textos = textosDeDeteccion(deteccion); // los textos en el idioma elegido
  notasTipo.textContent = textos.tipo;
  notasNombre.textContent = textos.nombre;
  notasDetalle.textContent = textos.detalle;
  // Fichas redondas con las notas del acorde (se vacía primero)
  notasDelAcorde.replaceChildren();
  for (const nota of textos.notas) {
    const ficha = document.createElement("li");
    ficha.textContent = nota;
    notasDelAcorde.append(ficha);
  }
  // Diagrama: si es un acorde, cómo se toca; si es una nota sola, dónde se toca
  notasDiagramaDibujo.replaceChildren(); // borra el dibujo anterior
  if (deteccion.tipo === "acorde") {
    notasDiagramaTitulo.textContent = t("comoSeToca");
    notasDiagramaAyuda.textContent = t("dedos");
    // Al dibujo le pasamos el nombre ESPAÑOL ("Lam"): así se llama en la lista de formas
    // de diagramas.js (el dibujo es el mismo en los dos idiomas)
    notasDiagramaDibujo.append(dibujarDiagramaAcorde(deteccion.clave)); // función de diagramas.js
    notasDiagrama.hidden = false;
  } else {
    mostrarDondeSeToca(deteccion);
  }
}

// Muestra en qué cuerda y traste se toca la nota. Una misma nota suena igual en varios
// lugares del mástil; dibujamos el más fácil y escribimos los otros debajo.
// Usa la afinación que se eligió en el Afinador (afinacionActual, de afinador.js): así,
// en Drop D, el Re grave aparece en la 6ª cuerda al aire.
function mostrarDondeSeToca(deteccion) {
  const posiciones = posicionesDeNota(deteccion.numero, afinacionActual); // musica.js
  const facil = posicionMasFacil(posiciones);                            // musica.js
  // Si la nota no se puede tocar en una guitarra (por ejemplo, un silbido muy agudo), no hay dibujo
  if (!facil) {
    notasDiagrama.hidden = true;
    return;
  }
  notasDiagramaTitulo.textContent = t("dondeSeToca");
  notasDiagramaDibujo.append(dibujarDiagramaNota(facil, nombreMusical(deteccion.nombre))); // diagramas.js
  // Texto: el lugar dibujado y, si hay, los otros lugares donde suena igual.
  // El texto de cada lugar está en idioma.js ("lugar"): "5ª cuerda, traste 15" o "5th string, fret 15".
  const describir = (p) => t("lugar", t("ordinal", p.cuerda), p.traste);
  const otros = posiciones
    .filter((p) => p !== facil)
    .sort((a, b) => a.traste - b.traste) // del traste más bajo al más alto
    .map(describir);
  notasDiagramaAyuda.textContent = describir(facil) + (otros.length ? t("tambienSuena", otros.join(" · ")) : "");
  notasDiagrama.hidden = false;
}

// Agrega al principio del historial (si no es igual a lo último) y lo redibuja
function agregarAlHistorial(deteccion) {
  if (notasHistorial[0] && notasHistorial[0].clave === deteccion.clave) return;
  notasHistorial.unshift(deteccion);                              // unshift = agregar al principio
  notasHistorial = notasHistorial.slice(0, NOTAS_TAMANO_HISTORIAL); // nos quedamos con los primeros 8
  dibujarHistorial();
}

function dibujarHistorial() {
  notasListaHistorial.replaceChildren(); // borra lo que había
  for (const deteccion of notasHistorial) {
    const textos = textosDeDeteccion(deteccion); // en el idioma elegido
    const fila = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "historial-nombre";
    nombre.textContent = textos.nombre;
    const tipo = document.createElement("span");
    tipo.className = "historial-tipo";
    tipo.textContent = textos.tipo;
    fila.append(nombre, tipo);
    notasListaHistorial.append(fila);
  }
  notasVacio.hidden = notasHistorial.length > 0; // el mensaje "todavía no hay notas" solo si está vacía
}

// Cambia el botón y los textos según se esté escuchando o no
function prepararPantallaNotas(escuchando) {
  notasBoton.setAttribute("aria-pressed", String(escuchando));
  notasNivel.style.setProperty("--nivel", "0%");
  notasCandidata = null;
  notasRepeticiones = 0;
  notasDetectorRuido.reiniciar(); // empieza a contar de cero
  notasRuido.hidden = true;       // y sin aviso de ruido
  escribirTextosNotas(escuchando);
}

// Escribe los textos del botón y, si todavía no se reconoció nada, el "Listo" / "Escuchando"
// (separado de prepararPantallaNotas para poder reescribirlos al cambiar de idioma)
function escribirTextosNotas(escuchando) {
  notasBoton.querySelector(".boton-texto").textContent = t(escuchando ? "dejarEscuchar" : "empezarEscuchar");
  if (!notasMostrada) {
    notasTipo.textContent = t(escuchando ? "escuchando" : "listo");
    notasDetalle.textContent = t(escuchando ? "notasEscuchando" : "notasListo");
  }
}

// Encender o apagar la escucha al tocar el botón
async function alternarMicrofonoNotas() {
  if (micEstaEncendido()) {
    apagarMicrofono();
    return;
  }
  try {
    await encenderMicrofono(procesarSonidoNotas, () => prepararPantallaNotas(false));
    prepararPantallaNotas(true);
  } catch (error) {
    mostrarAviso(mensajeErrorMicrofono(error));
  }
}

// ===== 6. Arranque =====

notasBoton.addEventListener("click", alternarMicrofonoNotas);
escribirTextosNotas(false); // los textos del comienzo, en el idioma elegido

// Al cambiar de idioma (idioma.js avisa): reescribimos el botón, lo que se está
// mostrando (con su diagrama) y el historial, todo en el idioma nuevo
alCambiarIdioma(() => {
  escribirTextosNotas(micEstaEncendido());
  if (notasMostrada) mostrarDeteccion(notasMostrada);
  dibujarHistorial();
});
