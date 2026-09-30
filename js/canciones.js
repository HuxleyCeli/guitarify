// canciones.js
// ------------
// La pantalla de CANCIONES: saca los acordes de un audio y los muestra en orden.
//   1. Consigue el audio: grabándolo con el micrófono o eligiendo un archivo.
//   2. Lo "decodifica" (convierte el mp3/m4a/wav en números) a 11025 muestras por segundo.
//   3. Lo recorre en trozos cortos ("ventanas") y en cada uno busca el acorde (musica.js).
//   4. Junta los trozos iguales y quita los errores sueltos (resumirAcordes, en musica.js).
//   5. Muestra la lista: 1. Do (0:00) · 2. Sol (0:04) · ...

"use strict";

// ===== 1. Ajustes =====

// Analizamos a 11025 muestras por segundo (4 veces menos que un CD): alcanza para las
// notas de una guitarra y hace el análisis 4 veces más rápido
const CANCIONES_FRECUENCIA = 11025;
// Tamaño de cada ventana: 4096 muestras ≈ 0,37 segundos (potencia de 2, como pide la FFT)
const CANCIONES_VENTANA = 4096;
// Cada cuánto empieza una ventana nueva: 2048 muestras ≈ 0,19 s (las ventanas se "enciman" a la mitad)
const CANCIONES_SALTO = 2048;
// Máximo de audio que analizamos (en segundos), para que el teléfono no se demore demasiado
const CANCIONES_MAXIMO_SEGUNDOS = 180;
// Máximo que dura una grabación (en segundos)
const CANCIONES_MAXIMO_GRABACION = 120;

// ===== 2. Estado =====

let grabadora = null;          // el grabador del navegador (MediaRecorder)
let trozosGrabados = [];       // pedacitos de audio que va entregando la grabadora
let inicioGrabacion = 0;       // momento en que empezó la grabación
let relojGrabacion = null;     // temporizador que actualiza el contador de segundos
let analizando = false;        // true mientras se analiza (para no empezar dos análisis a la vez)

// ===== 3. Elementos de la página =====

const botonGrabar = document.getElementById("canciones-grabar");
const textoGrabar = document.getElementById("canciones-grabar-texto");
const botonElegir = document.getElementById("canciones-elegir");
const selectorArchivo = document.getElementById("canciones-archivo");
const cajaNivelCanciones = document.getElementById("canciones-nivel-caja");
const nivelCanciones = document.getElementById("canciones-nivel");
const textoEstadoCanciones = document.getElementById("canciones-estado");
const barraProgreso = document.getElementById("canciones-progreso");
const resumenCanciones = document.getElementById("canciones-resumen");
const vacioCanciones = document.getElementById("canciones-vacio");
const listaAcordes = document.getElementById("canciones-lista");

// ===== 4. Ayudas =====

// Convierte segundos en "minutos:segundos": 75 → "1:15"
function formatearTiempo(segundos) {
  const total = Math.round(segundos);    // redondeamos al segundo más cercano (5,9 s → 6 s)
  const minutos = Math.floor(total / 60);
  const resto = total % 60;              // "%" = el resto de la división: lo que sobra después de los minutos
  return `${minutos}:${String(resto).padStart(2, "0")}`; // padStart agrega un 0 delante si hace falta: "5" → "05"
}

// Espera un instante para que el navegador pueda redibujar la pantalla (la barra de avance).
// Sin esto, la pantalla se "congelaría" hasta terminar el análisis.
function pausaBreve() {
  return new Promise((listo) => setTimeout(listo, 0));
}

// Mezcla todos los canales (izquierdo, derecho...) en uno solo (mono) promediándolos
function mezclarAMono(bufer) {
  const mono = new Float32Array(bufer.length);
  for (let canal = 0; canal < bufer.numberOfChannels; canal++) {
    const datos = bufer.getChannelData(canal);
    for (let i = 0; i < datos.length; i++) mono[i] += datos[i] / bufer.numberOfChannels;
  }
  return mono;
}

// Cambia la cantidad de muestras por segundo promediando grupos de muestras
// (plan B, por si el navegador no sabe hacerlo solo)
function remuestrear(muestras, frecuenciaOriginal) {
  const factor = frecuenciaOriginal / CANCIONES_FRECUENCIA;
  const resultado = new Float32Array(Math.floor(muestras.length / factor));
  for (let i = 0; i < resultado.length; i++) {
    const desde = Math.floor(i * factor);
    const hasta = Math.max(desde + 1, Math.floor((i + 1) * factor));
    let suma = 0;
    for (let j = desde; j < hasta; j++) suma += muestras[j];
    resultado[i] = suma / (hasta - desde);
  }
  return resultado;
}

// Convierte el archivo de audio (mp3, m4a, wav...) en una lista de números a 11025 por segundo
async function decodificarAudio(datos) {
  try {
    // Plan A: un "estudio de sonido fuera de línea" a 11025 Hz convierte y remuestrea en un solo paso
    const estudio = new OfflineAudioContext(1, 1, CANCIONES_FRECUENCIA);
    const bufer = await estudio.decodeAudioData(datos.slice(0)); // slice(0) = una copia (decodeAudioData "gasta" el original)
    return mezclarAMono(bufer);
  } catch {
    // Plan B: decodificar normal y remuestrear nosotros
    const estudio = new AudioContext();
    try {
      const bufer = await estudio.decodeAudioData(datos.slice(0));
      return remuestrear(mezclarAMono(bufer), bufer.sampleRate);
    } finally {
      estudio.close();
    }
  }
}

// Sube el volumen de la señal para que su punto más fuerte quede en 1
// (así los audios grabados bajitos también se pueden analizar)
function normalizarVolumen(muestras) {
  let maximo = 0;
  for (let i = 0; i < muestras.length; i++) maximo = Math.max(maximo, Math.abs(muestras[i]));
  if (maximo > 0) for (let i = 0; i < muestras.length; i++) muestras[i] /= maximo;
  return muestras;
}

// ===== 5. Mostrar =====

function mostrarEstadoCanciones(texto) {
  textoEstadoCanciones.textContent = texto;
}

// Mueve la barra de avance (porcentaje de 0 a 100) usando la variable CSS --avance
function mostrarAvance(porcentaje) {
  barraProgreso.style.setProperty("--avance", porcentaje + "%");
}

// Activa o desactiva los botones mientras se analiza
function bloquearBotones(bloquear) {
  botonGrabar.disabled = bloquear;
  botonElegir.disabled = bloquear;
}

// Dibuja la lista de acordes encontrados
function mostrarAcordes(acordes) {
  listaAcordes.replaceChildren(); // borra la lista anterior
  for (const acorde of acordes) {
    const fila = document.createElement("li");
    const nombre = document.createElement("span");
    nombre.className = "acorde-nombre";
    nombre.textContent = acorde.corto;           // "Lam"
    const cifrado = document.createElement("span");
    cifrado.className = "acorde-cifrado";
    cifrado.textContent = acorde.ingles;         // "Am"
    const tiempo = document.createElement("span");
    tiempo.className = "acorde-tiempo";
    tiempo.textContent = formatearTiempo(acorde.inicio); // "0:04": cuándo empieza
    fila.append(nombre, cifrado, tiempo);
    fila.title = acorde.completo;                // al mantener el dedo o el mouse: "La menor"
    listaAcordes.append(fila);
  }
  // Resumen con los acordes distintos, en el orden en que aparecen por primera vez.
  // "new Set" guarda cada valor una sola vez (quita los repetidos).
  const distintos = [...new Set(acordes.map((acorde) => acorde.corto))];
  resumenCanciones.textContent = `Usa ${distintos.length} ${distintos.length === 1 ? "acorde" : "acordes"}: ${distintos.join(" · ")}`;
  resumenCanciones.hidden = acordes.length === 0;
  vacioCanciones.hidden = acordes.length > 0;
  vacioCanciones.textContent = "No encontré acordes claros en este audio. Prueba con una guitarra sola, más cerca del micrófono.";
}

// ===== 6. Analizar =====

// Analiza un archivo o grabación ("origen" es solo el nombre que se muestra)
async function analizarAudio(archivo, origen) {
  if (analizando) return;
  analizando = true;
  bloquearBotones(true);
  barraProgreso.hidden = false;
  mostrarAvance(0);
  mostrarEstadoCanciones(`Leyendo «${origen}»…`);

  try {
    const datos = await archivo.arrayBuffer();              // el archivo como bytes
    let muestras = normalizarVolumen(await decodificarAudio(datos));
    const duracion = muestras.length / CANCIONES_FRECUENCIA;
    // Si es muy largo, solo analizamos el principio
    muestras = muestras.subarray(0, CANCIONES_MAXIMO_SEGUNDOS * CANCIONES_FRECUENCIA);

    // Recorremos el audio ventana por ventana
    const ventanas = [];
    const total = Math.max(1, Math.floor((muestras.length - CANCIONES_VENTANA) / CANCIONES_SALTO) + 1);
    for (let inicio = 0; inicio + CANCIONES_VENTANA <= muestras.length; inicio += CANCIONES_SALTO) {
      ventanas.push({
        // Usamos el CENTRO de la ventana como su momento: así el minuto que se muestra es más exacto
        tiempo: (inicio + CANCIONES_VENTANA / 2) / CANCIONES_FRECUENCIA,
        acorde: analizarVentana(muestras, inicio, CANCIONES_VENTANA, CANCIONES_FRECUENCIA), // musica.js
      });
      // Cada 40 ventanas actualizamos la barra y dejamos respirar a la pantalla
      if (ventanas.length % 40 === 0) {
        mostrarAvance((ventanas.length / total) * 100);
        mostrarEstadoCanciones(`Analizando «${origen}»… ${Math.round((ventanas.length / total) * 100)}%`);
        await pausaBreve();
      }
    }

    const acordes = resumirAcordes(ventanas, CANCIONES_SALTO / CANCIONES_FRECUENCIA); // musica.js
    mostrarAvance(100);
    mostrarAcordes(acordes);
    const recorte = duracion > CANCIONES_MAXIMO_SEGUNDOS ? ` (se analizaron los primeros ${formatearTiempo(CANCIONES_MAXIMO_SEGUNDOS)})` : "";
    mostrarEstadoCanciones(`«${origen}» · ${formatearTiempo(duracion)} · ${acordes.length} ${acordes.length === 1 ? "cambio de acorde" : "cambios de acorde"}${recorte}`);
  } catch {
    mostrarEstadoCanciones("No pude leer ese audio. Prueba con otro archivo (mp3, m4a o wav).");
  } finally {
    // "finally" se ejecuta siempre, haya salido bien o mal
    analizando = false;
    bloquearBotones(false);
    barraProgreso.hidden = true;
  }
}

// ===== 7. Elegir un archivo =====

botonElegir.addEventListener("click", () => selectorArchivo.click()); // abre el selector de archivos
selectorArchivo.addEventListener("change", () => {
  const archivo = selectorArchivo.files[0];   // el archivo elegido (o undefined si se canceló)
  if (archivo) analizarAudio(archivo, archivo.name);
  selectorArchivo.value = "";                 // permite volver a elegir el mismo archivo después
});

// ===== 8. Grabar con el micrófono =====

// Cambia el botón y la barra de señal según se esté grabando o no
function prepararPantallaGrabacion(grabando) {
  botonGrabar.setAttribute("aria-pressed", String(grabando));
  textoGrabar.textContent = grabando ? "Detener 0:00" : "Grabar";
  cajaNivelCanciones.hidden = !grabando;
  nivelCanciones.style.setProperty("--nivel", "0%");
  botonElegir.disabled = grabando;
  clearInterval(relojGrabacion);
  if (grabando) {
    // Cada medio segundo actualizamos el contador de tiempo
    relojGrabacion = setInterval(() => {
      const segundos = (performance.now() - inicioGrabacion) / 1000;
      textoGrabar.textContent = `Detener ${formatearTiempo(segundos)}`;
      if (segundos >= CANCIONES_MAXIMO_GRABACION) apagarMicrofono(); // límite de tiempo
    }, 500);
  }
}

// Se llama cuando el micrófono se apaga (al tocar "Detener", al cambiar de pantalla, o al llegar al límite)
function alTerminarGrabacion() {
  prepararPantallaGrabacion(false);
  if (grabadora && grabadora.state !== "inactive") grabadora.stop(); // esto dispara "onstop" (abajo)
}

async function empezarGrabacion() {
  // MediaRecorder es la herramienta del navegador para grabar. Algunos navegadores viejos no la tienen
  if (typeof MediaRecorder === "undefined") {
    mostrarAviso("Este navegador no permite grabar audio. Usa «Elegir audio».");
    return;
  }
  try {
    const flujo = await encenderMicrofono(({ volumen }) => {
      nivelCanciones.style.setProperty("--nivel", nivelVisual(volumen) + "%");
    }, alTerminarGrabacion);

    trozosGrabados = [];
    grabadora = new MediaRecorder(flujo);
    grabadora.ondataavailable = (evento) => trozosGrabados.push(evento.data); // guarda cada pedacito grabado
    grabadora.onstop = () => {
      // Juntamos los pedacitos en un solo archivo de audio ("Blob") y lo analizamos
      const audio = new Blob(trozosGrabados, { type: grabadora.mimeType });
      if (audio.size > 0) analizarAudio(audio, "Grabación");
    };
    grabadora.start();
    inicioGrabacion = performance.now();
    prepararPantallaGrabacion(true);
    mostrarEstadoCanciones("Grabando… toca la canción cerca del teléfono y luego «Detener».");
  } catch (error) {
    mostrarAviso(mensajeErrorMicrofono(error));
  }
}

botonGrabar.addEventListener("click", () => {
  if (micEstaEncendido()) apagarMicrofono(); // estaba grabando: detener (y se analiza sola)
  else empezarGrabacion();
});
