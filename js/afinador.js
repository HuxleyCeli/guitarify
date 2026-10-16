// afinador.js
// -----------
// La pantalla del AFINADOR.
//   - Tiene un menú de AFINACIONES (Estándar, Drop D...) y recuerda la última elegida.
//   - Crea las 6 uñetas de las cuerdas a partir de la afinación elegida.
//   - Con el micrófono APAGADO muestra una afinación de EJEMPLO (con el sello "Ejemplo").
//   - Con el micrófono ENCENDIDO escucha la guitarra, reconoce qué cuerda suena
//     (modo automático) y mueve la aguja según qué tan afinada está.
// Usa herramientas de otros archivos: musica.js (frecuencias y notas),
// microfono.js (escuchar) y medidor.js (mover la aguja).

"use strict";

// ===== 1. Datos: la afinación elegida =====

// Las afinaciones (AFINACIONES) y la función que arma sus cuerdas (cuerdasDeAfinacion)
// están en musica.js: son teoría musical pura, y así las pruebas también las pueden usar.

// La afinación que se está usando y sus cuerdas ("let" porque cambian al elegir otra)
let afinacionActual = AFINACIONES[0];
let CUERDAS = cuerdasDeAfinacion(afinacionActual);
// Nombre con el que el navegador recuerda la última afinación elegida (localStorage)
const CLAVE_AFINACION_GUARDADA = "guitarify-afinacion";

// Valor de EJEMPLO que muestra el medidor mientras el micrófono está apagado
const CENTS_DE_EJEMPLO = -12;
// Posición de descanso de la aguja cuando no suena nada (todo a la izquierda, como un medidor real)
const CENTS_EN_REPOSO = -50;
// Claridad (de 0 a 1) para saber que una cuerda está sonando. Menos = ruido o
// varias notas a la vez. Para MOVER la aguja se exige más: CLARIDAD_PARA_AFINAR
// (0,97, está en musica.js con la explicación de cómo se midió).
const CLARIDAD_MINIMA = 0.85;
// Cada cuántos milisegundos analiza el afinador. Antes eran 50 (20 veces por segundo);
// como ahora YIN usa la FFT y es unas 7 veces más rápido, podemos escuchar
// ~30 veces por segundo sin cansar al teléfono, y la aguja reacciona antes.
const AFINADOR_INTERVALO_MS = 30;
// Si pasan estos milisegundos sin una nota clara, la aguja vuelve a su posición de descanso
const ESPERA_SILENCIO_MS = 700;

// ===== 2. Estado de la pantalla =====

let cuerdaElegida = 0;          // índice en CUERDAS (0 = la 6ª cuerda)
let modoAutomatico = true;      // true = la app elige la cuerda; false = la eligió la persona
const seguidor = crearSeguidorDeTono(); // suaviza las lecturas sin atrasarlas (está en musica.js)
const detectorRuido = crearDetectorDeRuido(); // se da cuenta si hay mucho ruido (está en musica.js)
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
const menuAfinacion = document.getElementById("afinador-afinacion"); // el menú para elegir la afinación

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

// Deja la aguja en reposo y explica que hay sonido, pero no se distingue una cuerda.
// Pasa con ruido (voces, ventilador, tele) y también si suenan varias cuerdas a la vez.
function mostrarRuido() {
  moverAguja(CENTS_EN_REPOSO);
  textoEstado.dataset.estado = "ruido";
  textoEstado.textContent = "Hay mucho ruido: toca una sola cuerda, cerca del teléfono";
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

// ===== 6. Escuchar =====

// microfono.js llama a esta función unas 30 veces por segundo con lo que escuchó
function procesarSonidoAfinador({ volumen, tono }) {
  // La barra de "Señal" se llena según el volumen (variable CSS --nivel)
  nivelAfinador.style.setProperty("--nivel", nivelVisual(volumen) + "%");
  const ahora = performance.now(); // milisegundos desde que se abrió la página

  // Le contamos al detector de ruido qué pasó en este análisis:
  // suena una nota → "claro"; hay sonido pero ninguna nota → "confuso"; si no → "silencio"
  let tipo = "silencio";
  if (tono && tono.claridad >= CLARIDAD_MINIMA) tipo = "claro";
  else if (volumen >= UMBRAL_SILENCIO) tipo = "confuso";
  const hayRuido = detectorRuido.agregar(tipo, ahora);

  if (tono && tono.claridad >= CLARIDAD_PARA_AFINAR) {
    // Lectura muy clara: la usamos. El seguidor quita el temblor y los errores
    // sueltos, pero sigue rápido los cambios
    const frecuencia = seguidor.agregar(tono.frecuencia);
    ultimaNotaClara = ahora;

    // En modo automático, la app elige la cuerda más cercana
    if (modoAutomatico) {
      const indice = cuerdaMasCercana(frecuencia);
      if (indice !== cuerdaElegida) elegirCuerda(indice);
    }
    const cuerda = CUERDAS[cuerdaElegida];
    mostrarCuerda(cuerda, frecuencia);
    mostrarAfinacion(centsEntre(frecuencia, cuerda.frecuencia));
  } else if (tono && tono.claridad >= CLARIDAD_MINIMA) {
    // Suena una nota, pero no tan clara (ruido, o la cuerda ya se está apagando):
    // la aguja se queda donde estaba en vez de saltar a un valor equivocado
    ultimaNotaClara = ahora;
  } else if (ahora - ultimaNotaClara > ESPERA_SILENCIO_MS) {
    // Hace rato que no suena nada claro: aguja en reposo y seguidor vacío.
    // Si además hay mucho ruido, lo decimos (así la persona sabe por qué no marca nada)
    seguidor.reiniciar();
    mostrarCuerda(CUERDAS[cuerdaElegida]);
    if (hayRuido) mostrarRuido();
    else mostrarEspera();
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
  seguidor.reiniciar();
  detectorRuido.reiniciar();
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
    await encenderMicrofono(procesarSonidoAfinador, () => prepararPantallaAfinador(false), { intervaloMs: AFINADOR_INTERVALO_MS });
    prepararPantallaAfinador(true);
  } catch (error) {
    mostrarAviso(mensajeErrorMicrofono(error)); // mostrarAviso está en app.js
  }
}

// ===== 7. Crear las 6 uñetas de las cuerdas =====

function crearBotonesDeCuerdas() {
  contenedorCuerdas.replaceChildren(); // borra las uñetas anteriores (si cambió la afinación)
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

// ===== 8. Elegir la afinación =====

// Llena el menú con una opción por afinación (salen de la lista AFINACIONES)
function crearMenuDeAfinaciones() {
  for (const afinacion of AFINACIONES) {
    const opcion = document.createElement("option");
    opcion.value = afinacion.id;             // lo que usa el código: "drop-d"
    opcion.textContent = afinacion.nombre;   // lo que ve la persona: "Drop D"
    menuAfinacion.append(opcion);
  }
}

// Cambia a la afinación "id": arma sus cuerdas, redibuja las uñetas y la recuerda
function cambiarAfinacion(id) {
  // "find" busca en la lista la primera afinación con ese id (si no existe, usamos la estándar)
  afinacionActual = AFINACIONES.find((afinacion) => afinacion.id === id) || AFINACIONES[0];
  CUERDAS = cuerdasDeAfinacion(afinacionActual);
  menuAfinacion.value = afinacionActual.id;
  crearBotonesDeCuerdas();
  seguidor.reiniciar();      // las lecturas anteriores eran de otras cuerdas
  elegirCuerda(cuerdaElegida); // marca otra vez la cuerda elegida, ahora con su nota nueva
  mostrarModo();             // en modo manual, el texto dice la nota nueva
  // Guardamos la elección en el navegador para la próxima vez. "try" porque en
  // algunos casos (modo privado, archivo abierto con doble clic) el navegador no deja guardar
  try {
    localStorage.setItem(CLAVE_AFINACION_GUARDADA, afinacionActual.id);
  } catch {
    // si no se puede guardar, no pasa nada: la próxima vez empieza en Estándar
  }
}

// Lee la afinación que se eligió la última vez (o null si no hay ninguna guardada)
function afinacionGuardada() {
  try {
    return localStorage.getItem(CLAVE_AFINACION_GUARDADA);
  } catch {
    return null;
  }
}

// ===== 9. Arranque =====

crearMenuDeAfinaciones();
cambiarAfinacion(afinacionGuardada()); // crea las uñetas de la última afinación usada (o Estándar)
menuAfinacion.addEventListener("change", () => cambiarAfinacion(menuAfinacion.value));
botonMicAfinador.addEventListener("click", alternarMicrofonoAfinador);
botonAutomatico.addEventListener("click", () => {
  modoAutomatico = true;
  mostrarModo();
});
prepararPantallaAfinador(false); // empieza en modo EJEMPLO, con la 6ª cuerda elegida
