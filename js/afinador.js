// afinador.js
// -----------
// La pantalla del AFINADOR.
//   - Crea las 6 uñetas de las cuerdas a partir de una lista de datos.
//   - Con el micrófono APAGADO muestra una afinación de EJEMPLO (con el sello "Ejemplo").
//   - Con el micrófono ENCENDIDO escucha la guitarra, reconoce qué cuerda suena
//     (modo automático) y mueve la aguja según qué tan afinada está.
// Usa herramientas de otros archivos: musica.js (frecuencias y notas),
// microfono.js (escuchar) y medidor.js (mover la aguja).

"use strict";

// ===== 1. Datos: afinación estándar de la guitarra =====

// Una lista (array) con un objeto por cuerda, de la 6ª (la más gruesa) a la 1ª (la más fina).
// Tener los datos en UN solo lugar se llama "una sola fuente de verdad": los
// botones, los textos y el cálculo de afinación salen todos de aquí.
// La frecuencia (Hz = vibraciones por segundo) es la que debe sonar cada cuerda al aire.
const CUERDAS = [
  { numero: 6, nota: "Mi", ingles: "E2", frecuencia: 82.41 },
  { numero: 5, nota: "La", ingles: "A2", frecuencia: 110.0 },
  { numero: 4, nota: "Re", ingles: "D3", frecuencia: 146.83 },
  { numero: 3, nota: "Sol", ingles: "G3", frecuencia: 196.0 },
  { numero: 2, nota: "Si", ingles: "B3", frecuencia: 246.94 },
  { numero: 1, nota: "Mi", ingles: "E4", frecuencia: 329.63 },
];

// Valor de EJEMPLO que muestra el medidor mientras el micrófono está apagado
const CENTS_DE_EJEMPLO = -12;
// Posición de descanso de la aguja cuando no suena nada (todo a la izquierda, como un medidor real)
const CENTS_EN_REPOSO = -50;
// Claridad mínima (de 0 a 1) para confiar en una lectura. Menos = ruido o varias notas a la vez
const CLARIDAD_MINIMA = 0.85;
// Cuántas lecturas recientes usamos para suavizar (5 lecturas ≈ un cuarto de segundo)
const LECTURAS_PARA_SUAVIZAR = 5;
// Si pasan estos milisegundos sin una nota clara, la aguja vuelve a su posición de descanso
const ESPERA_SILENCIO_MS = 700;

// ===== 2. Estado de la pantalla =====

let cuerdaElegida = 0;          // índice en CUERDAS (0 = la 6ª cuerda)
let modoAutomatico = true;      // true = la app elige la cuerda; false = la eligió la persona
let lecturasRecientes = [];     // últimas frecuencias detectadas, para suavizar
let ultimaNotaClara = 0;        // momento de la última lectura confiable (en milisegundos)

// ===== 3. Elementos de la página =====

const contenedorCuerdas = document.getElementById("cuerdas");
const textoNota = document.getElementById("afinador-nota");
const textoDetalle = document.getElementById("afinador-detalle");
const textoEstado = document.getElementById("afinador-estado");
const selloAfinador = document.getElementById("afinador-sello");
const nivelAfinador = document.getElementById("afinador-nivel");
const textoModo = document.getElementById("afinador-modo");
const botonAutomatico = document.getElementById("afinador-auto");
const botonMicAfinador = document.getElementById("afinador-mic");
const ayudaAfinador = document.getElementById("afinador-ayuda");

// ===== 4. Textos =====

// Escribe los cents con su signo: −12 → "−12 cents", 7 → "+7 cents"
function formatearCents(cents) {
  const redondeado = Math.round(cents);                          // sin decimales
  const signo = redondeado > 0 ? "+" : redondeado < 0 ? "−" : ""; // "? :" es un "si... entonces... si no..." corto
  return signo + Math.abs(redondeado) + " cents";
}

// Traduce los cents a un estado y a un consejo para la persona que afina.
// Si la cuerda suena BAJA hay que APRETAR la clavija (la cuerda se estira y sube de tono);
// si suena ALTA hay que SOLTARLA.
function describirAfinacion(cents) {
  if (Math.abs(cents) <= VU_ZONA_AFINADA) return { estado: "afinado", consejo: "¡Afinada!" };
  const lejos = Math.abs(cents) > 50; // más de medio semitono de diferencia
  if (cents < 0) return { estado: "bajo", consejo: (lejos ? "Muy baja" : "Baja") + ": aprieta un poco la clavija" };
  return { estado: "alto", consejo: (lejos ? "Muy alta" : "Alta") + ": suelta un poco la clavija" };
}

// Muestra la nota y los datos de la cuerda elegida.
// Si hay una frecuencia escuchada, la muestra; si no, muestra la frecuencia objetivo.
function mostrarCuerda(cuerda, frecuenciaEscuchada) {
  textoNota.textContent = cuerda.nota;
  const frecuencia = frecuenciaEscuchada
    ? "oyendo " + formatearHz(frecuenciaEscuchada, 1)
    : formatearHz(cuerda.frecuencia);
  textoDetalle.textContent = `${cuerda.numero}ª cuerda · ${cuerda.ingles} · ${frecuencia}`;
}

// Mueve la aguja y escribe el estado según los cents
function mostrarAfinacion(cents) {
  moverAguja(cents);                                 // función de medidor.js
  const descripcion = describirAfinacion(cents);
  textoEstado.dataset.estado = descripcion.estado;   // el CSS usa data-estado para el color
  textoEstado.textContent = `${formatearCents(cents)} · ${descripcion.consejo}`;
}

// Deja la aguja en reposo cuando no suena nada
function mostrarEspera() {
  moverAguja(CENTS_EN_REPOSO);
  textoEstado.dataset.estado = "esperando";
  textoEstado.textContent = "Toca una cuerda al aire, cerca del teléfono";
}

// Actualiza el texto que explica el modo (automático o manual)
function mostrarModo() {
  if (!micEstaEncendido()) {
    textoModo.textContent = "Con el micrófono encendido, la app reconoce sola qué cuerda tocas.";
  } else if (modoAutomatico) {
    textoModo.textContent = "Modo automático: reconoce sola qué cuerda tocas.";
  } else {
    const cuerda = CUERDAS[cuerdaElegida];
    textoModo.textContent = `Modo manual: afinando la ${cuerda.numero}ª cuerda (${cuerda.nota}).`;
  }
  botonAutomatico.hidden = modoAutomatico || !micEstaEncendido();
}

// ===== 5. Elegir cuerda =====

// Marca como elegida la cuerda número "indice" (0 = la 6ª, 5 = la 1ª)
function elegirCuerda(indice) {
  cuerdaElegida = indice;
  // Solo la elegida queda con aria-pressed="true" (el CSS la pinta roja)
  contenedorCuerdas.querySelectorAll(".cuerda").forEach((boton, posicion) => {
    boton.setAttribute("aria-pressed", posicion === indice ? "true" : "false");
  });
  mostrarCuerda(CUERDAS[indice]);
}

// Cuando la PERSONA toca una uñeta
function alTocarCuerda(indice) {
  // Con el micrófono encendido, tocar una cuerda pasa a modo manual (afinar solo esa cuerda)
  if (micEstaEncendido()) modoAutomatico = false;
  elegirCuerda(indice);
  mostrarModo();
}

// Busca la cuerda cuya frecuencia está más cerca (en cents) de la que escuchamos
function cuerdaMasCercana(frecuencia) {
  let mejor = 0;
  CUERDAS.forEach((cuerda, indice) => {
    if (Math.abs(centsEntre(frecuencia, cuerda.frecuencia)) < Math.abs(centsEntre(frecuencia, CUERDAS[mejor].frecuencia))) mejor = indice;
  });
  return mejor;
}

// Devuelve la mediana (el valor del medio al ordenar). A diferencia del promedio,
// una lectura rara (un "salto") no la afecta.
function mediana(valores) {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
}

// ===== 6. Escuchar =====

// microfono.js llama a esta función unas 20 veces por segundo con lo que escuchó
function procesarSonidoAfinador({ volumen, tono }) {
  // La barra de "Señal" se llena según el volumen (variable CSS --nivel)
  nivelAfinador.style.setProperty("--nivel", nivelVisual(volumen) + "%");
  const ahora = performance.now(); // milisegundos desde que se abrió la página

  if (tono && tono.claridad >= CLARIDAD_MINIMA) {
    // Guardamos la lectura y usamos la mediana de las últimas para que la aguja no tiemble
    lecturasRecientes.push(tono.frecuencia);
    if (lecturasRecientes.length > LECTURAS_PARA_SUAVIZAR) lecturasRecientes.shift(); // quita la más vieja
    const frecuencia = mediana(lecturasRecientes);
    ultimaNotaClara = ahora;

    // En modo automático, la app elige la cuerda más cercana
    if (modoAutomatico) {
      const indice = cuerdaMasCercana(frecuencia);
      if (indice !== cuerdaElegida) elegirCuerda(indice);
    }
    const cuerda = CUERDAS[cuerdaElegida];
    mostrarCuerda(cuerda, frecuencia);
    mostrarAfinacion(centsEntre(frecuencia, cuerda.frecuencia));
  } else if (ahora - ultimaNotaClara > ESPERA_SILENCIO_MS) {
    // Hace rato que no suena nada claro: aguja en reposo
    lecturasRecientes = [];
    mostrarCuerda(CUERDAS[cuerdaElegida]);
    mostrarEspera();
  }
}

// Cambia la pantalla entre "modo ejemplo" (micrófono apagado) y "modo escucha"
function prepararPantallaAfinador(escuchando) {
  selloAfinador.hidden = escuchando;
  botonMicAfinador.setAttribute("aria-pressed", String(escuchando));
  botonMicAfinador.querySelector(".boton-texto").textContent = escuchando ? "Apagar micrófono" : "Encender micrófono";
  ayudaAfinador.textContent = escuchando
    ? "Toca una cuerda a la vez y déjala sonar. La barra de «Señal» muestra que el micrófono te escucha."
    : "La aguja y la lectura son de ejemplo. Enciende el micrófono para afinar de verdad.";
  nivelAfinador.style.setProperty("--nivel", "0%");
  lecturasRecientes = [];
  if (escuchando) {
    modoAutomatico = true;
    mostrarEspera();
  } else {
    elegirCuerda(cuerdaElegida);
    mostrarAfinacion(CENTS_DE_EJEMPLO);   // vuelve el EJEMPLO
  }
  mostrarModo();
}

// Encender o apagar el micrófono al tocar el botón
async function alternarMicrofonoAfinador() {
  if (micEstaEncendido()) {
    apagarMicrofono(); // microfono.js avisará a prepararPantallaAfinador(false)
    return;
  }
  try {
    await encenderMicrofono(procesarSonidoAfinador, () => prepararPantallaAfinador(false));
    prepararPantallaAfinador(true);
  } catch (error) {
    mostrarAviso(mensajeErrorMicrofono(error)); // mostrarAviso está en app.js
  }
}

// ===== 7. Crear las 6 uñetas de las cuerdas =====

function crearBotonesDeCuerdas() {
  CUERDAS.forEach((cuerda, indice) => {
    // Creamos un <button> nuevo "en el aire" (todavía no está en la página)
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "pua cuerda";                  // mismas clases que usa el CSS
    boton.setAttribute("aria-label", `Cuerda ${cuerda.numero}: ${cuerda.nota} (${cuerda.ingles})`);

    // Dos textos adentro: el nombre de la nota y el número de cuerda.
    // Usamos textContent (y no innerHTML) porque solo inserta texto: es un buen
    // hábito de seguridad, así nunca se puede colar código dentro de la página.
    const nombre = document.createElement("span");
    nombre.className = "cuerda-nota";
    nombre.textContent = cuerda.nota;
    const numero = document.createElement("span");
    numero.className = "cuerda-numero";
    numero.textContent = cuerda.numero + "ª";
    boton.append(nombre, numero);                    // metemos los dos textos dentro del botón

    boton.addEventListener("click", () => alTocarCuerda(indice));
    contenedorCuerdas.append(boton);                 // ahora sí, agregamos el botón a la página
  });
}

// ===== 8. Arranque =====

crearBotonesDeCuerdas();
botonMicAfinador.addEventListener("click", alternarMicrofonoAfinador);
botonAutomatico.addEventListener("click", () => {
  modoAutomatico = true;
  mostrarModo();
});
prepararPantallaAfinador(false); // empieza en modo EJEMPLO, con la 6ª cuerda elegida
