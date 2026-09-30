// notas.js
// --------
// La pantalla de NOTAS Y ACORDES: escucha en vivo y dice qué suena.
//   - Si suena UNA nota limpia (claridad alta), muestra la nota: "La", A2, 110 Hz.
//   - Si suenan VARIAS notas a la vez, busca el acorde: "Lam" (La menor, Am).
//   - Guarda las últimas cosas reconocidas en un historial.
// Usa musica.js (detectar nota y acorde) y microfono.js (escuchar).

"use strict";

// ===== 1. Ajustes =====

// Claridad mínima para decir que es UNA nota (medido en pruebas: una nota da ~1,0 y un acorde, nada)
const NOTAS_CLARIDAD_NOTA = 0.9;
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

// ===== 3. Elementos de la página =====

const notasTipo = document.getElementById("notas-tipo");
const notasNombre = document.getElementById("notas-nombre");
const notasDetalle = document.getElementById("notas-detalle");
const notasDelAcorde = document.getElementById("notas-del-acorde");
const notasNivel = document.getElementById("notas-nivel");
const notasBoton = document.getElementById("notas-mic");
const notasListaHistorial = document.getElementById("notas-historial");
const notasVacio = document.getElementById("notas-vacio");

// ===== 4. Reconocer =====

// Decide qué suena en este instante. Devuelve un objeto con todo lo que hay que mostrar, o null.
function reconocerSonido(tono, obtenerCroma) {
  // Caso 1: una sola nota limpia
  if (tono && tono.claridad >= NOTAS_CLARIDAD_NOTA) {
    const nota = frecuenciaANota(tono.frecuencia);        // función de musica.js
    return {
      clave: nota.ingles,                                  // "A2": identifica esta detección
      tipo: "Nota",
      nombre: nota.nombre,                                 // "La"
      detalle: `${nota.ingles} · ${formatearHz(tono.frecuencia, 1)}`,
      notas: [],
    };
  }
  // Caso 2: varias notas → buscamos el acorde que más se parece
  const acorde = detectarAcorde(obtenerCroma());           // función de musica.js
  if (acorde && acorde.similitud >= SIMILITUD_MINIMA_ACORDE) {
    return {
      clave: acorde.corto,                                 // "Lam"
      tipo: "Acorde",
      nombre: acorde.corto,
      detalle: `${acorde.completo} · ${acorde.ingles}`,    // "La menor · Am"
      notas: acorde.notas,                                 // ["La", "Do", "Mi"]
    };
  }
  return null; // no se reconoció nada seguro
}

// microfono.js llama a esta función unas 20 veces por segundo
function procesarSonidoNotas({ volumen, tono, obtenerCroma }) {
  notasNivel.style.setProperty("--nivel", nivelVisual(volumen) + "%");
  if (volumen < UMBRAL_SILENCIO) {
    notasCandidata = null; // silencio: reiniciamos la cuenta, pero dejamos en pantalla lo último
    notasRepeticiones = 0;
    return;
  }

  const deteccion = reconocerSonido(tono, obtenerCroma);
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
  notasTipo.textContent = deteccion.tipo;
  notasNombre.textContent = deteccion.nombre;
  notasDetalle.textContent = deteccion.detalle;
  // Fichas redondas con las notas del acorde (se vacía primero)
  notasDelAcorde.replaceChildren();
  for (const nota of deteccion.notas) {
    const ficha = document.createElement("li");
    ficha.textContent = nota;
    notasDelAcorde.append(ficha);
  }
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
    const fila = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "historial-nombre";
    nombre.textContent = deteccion.nombre;
    const tipo = document.createElement("span");
    tipo.className = "historial-tipo";
    tipo.textContent = deteccion.tipo;
    fila.append(nombre, tipo);
    notasListaHistorial.append(fila);
  }
  notasVacio.hidden = notasHistorial.length > 0; // el mensaje "todavía no hay notas" solo si está vacía
}

// Cambia el botón y los textos según se esté escuchando o no
function prepararPantallaNotas(escuchando) {
  notasBoton.setAttribute("aria-pressed", String(escuchando));
  notasBoton.querySelector(".boton-texto").textContent = escuchando ? "Dejar de escuchar" : "Empezar a escuchar";
  notasNivel.style.setProperty("--nivel", "0%");
  notasCandidata = null;
  notasRepeticiones = 0;
  if (escuchando && !notasMostrada) {
    notasTipo.textContent = "Escuchando";
    notasDetalle.textContent = "Toca una nota o un acorde y déjalo sonar.";
  }
  if (!escuchando && !notasMostrada) {
    notasTipo.textContent = "Listo";
    notasDetalle.textContent = "Toca «Empezar a escuchar» y luego una nota o un acorde.";
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
