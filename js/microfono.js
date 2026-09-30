// microfono.js
// ------------
// Maneja el MICRÓFONO del teléfono, compartido por las 3 funciones de la app.
//   - encenderMicrofono(alRecibirSonido, alApagar): pide permiso, empieza a
//     escuchar y, unas 20 veces por segundo, entrega lo que oye.
//   - apagarMicrofono(): deja de escuchar (se llama también al cambiar de pantalla).
// Solo una pantalla puede usar el micrófono a la vez.
//
// Usa la "Web Audio API", la herramienta que traen los navegadores para
// trabajar con sonido. Funciona como una cadena de cables:
//   micrófono → "fuente" → "analizadores" (miden la onda y sus frecuencias)

"use strict";

// Cada cuántos milisegundos analizamos el sonido (50 ms = 20 veces por segundo)
const MIC_INTERVALO_MS = 50;

// Estado del micrófono (null = apagado)
let micContexto = null;       // el "estudio de sonido" del navegador (AudioContext)
let micFlujo = null;          // el flujo de audio que llega del micrófono
let micAnalizadorOnda = null; // mide la forma de la onda (para detectar la nota)
let micAnalizadorEspectro = null; // mide las frecuencias (para detectar acordes)
let micBufferOnda = null;     // arreglo donde se copia la onda en cada análisis
let micBufferEspectro = null; // arreglo donde se copian las frecuencias
let micAlRecibir = null;      // función de la pantalla que recibe cada análisis
let micAlApagar = null;       // función de la pantalla que se avisa cuando se apaga
let micAnimacion = null;      // número del "ciclo" de análisis, para poder detenerlo
let micUltimoAnalisis = 0;    // momento del último análisis (en milisegundos)

// ¿Está encendido el micrófono ahora?
function micEstaEncendido() {
  return micFlujo !== null;
}

// Enciende el micrófono. Es "async" porque hay que ESPERAR a que la persona dé permiso.
// Devuelve el flujo de audio (la pantalla de Canciones lo usa para grabar).
async function encenderMicrofono(alRecibirSonido, alApagar) {
  // El micrófono solo funciona en páginas seguras (https o localhost): regla de los navegadores
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    const error = new Error("Página no segura");
    error.name = "PaginaNoSegura";
    throw error;
  }

  apagarMicrofono(); // si otra pantalla lo tenía encendido, lo apagamos primero

  // Creamos el "estudio de sonido" ANTES de esperar el permiso: en iPhone tiene
  // que crearse justo al tocar el botón, o el navegador lo deja en pausa
  const contexto = new AudioContext();
  let flujo;
  try {
    // Pedimos el micrófono SIN los filtros de llamadas (cancelar eco, quitar ruido,
    // subir volumen automático): esos filtros deforman las notas de la guitarra
    flujo = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (error) {
    contexto.close();
    throw error; // la pantalla que lo llamó muestra el aviso correspondiente
  }
  await contexto.resume(); // por si el navegador lo dejó en pausa

  // Conectamos la cadena: micrófono → fuente → dos analizadores
  const fuente = contexto.createMediaStreamSource(flujo);
  micAnalizadorOnda = contexto.createAnalyser();
  micAnalizadorOnda.fftSize = 4096;               // 4096 muestras ≈ 0,09 segundos de sonido
  micAnalizadorEspectro = contexto.createAnalyser();
  micAnalizadorEspectro.fftSize = 16384;          // más muestras = distingue mejor las notas graves
  micAnalizadorEspectro.smoothingTimeConstant = 0.6; // suaviza entre análisis para que no "salte"
  fuente.connect(micAnalizadorOnda);
  fuente.connect(micAnalizadorEspectro);

  micBufferOnda = new Float32Array(micAnalizadorOnda.fftSize);
  micBufferEspectro = new Float32Array(micAnalizadorEspectro.frequencyBinCount);
  micContexto = contexto;
  micFlujo = flujo;
  micAlRecibir = alRecibirSonido;
  micAlApagar = alApagar;
  micUltimoAnalisis = 0;
  // requestAnimationFrame = "ejecuta esto en el próximo cuadro de pantalla" (unas 60 veces por segundo)
  micAnimacion = requestAnimationFrame(micCiclo);
  return flujo;
}

// El ciclo de análisis: se repite mientras el micrófono esté encendido
function micCiclo(tiempo) {
  micAnimacion = requestAnimationFrame(micCiclo);          // agenda la próxima vuelta
  if (tiempo - micUltimoAnalisis < MIC_INTERVALO_MS) return; // todavía no toca analizar
  micUltimoAnalisis = tiempo;

  micAnalizadorOnda.getFloatTimeDomainData(micBufferOnda); // copia la onda actual
  const volumen = calcularVolumen(micBufferOnda);          // función de musica.js
  // Solo buscamos la nota si hay sonido (en silencio no tiene sentido)
  const tono = volumen >= UMBRAL_SILENCIO ? detectarTono(micBufferOnda, micContexto.sampleRate) : null;

  micAlRecibir({
    volumen,
    tono,
    // El croma (para acordes) cuesta más calcularlo, así que solo se calcula si la pantalla lo pide
    obtenerCroma: () => {
      micAnalizadorEspectro.getFloatFrequencyData(micBufferEspectro); // viene en decibeles
      const magnitudes = micBufferEspectro.map((decibeles) => Math.pow(10, decibeles / 20)); // decibeles → fuerza normal
      return cromaDesdeEspectro(magnitudes, micContexto.sampleRate);
    },
  });
}

// Apaga el micrófono y avisa a la pantalla que lo estaba usando
function apagarMicrofono() {
  if (!micEstaEncendido()) return;
  const avisar = micAlApagar;
  micAlApagar = null;
  if (avisar) avisar(); // primero avisamos (por ejemplo, para cerrar una grabación en curso)
  cancelAnimationFrame(micAnimacion);
  micFlujo.getTracks().forEach((pista) => pista.stop()); // corta el micrófono (se apaga el ícono del navegador)
  micContexto.close();
  micContexto = micFlujo = micAnalizadorOnda = micAnalizadorEspectro = micAlRecibir = null;
}

// Convierte el volumen en un porcentaje para las barras de "Señal" (0 a 100).
// Usamos decibeles porque el oído percibe el volumen así: -60 dB = silencio, 0 dB = máximo.
function nivelVisual(volumen) {
  const decibeles = 20 * Math.log10(Math.max(volumen, 0.00001));
  return Math.max(0, Math.min(100, ((decibeles + 60) / 60) * 100));
}

// Traduce un error del micrófono a un mensaje claro para la persona
function mensajeErrorMicrofono(error) {
  if (error.name === "NotAllowedError") return "Necesito permiso para usar el micrófono. Actívalo en la configuración del navegador.";
  if (error.name === "NotFoundError") return "No encontré ningún micrófono en este aparato.";
  if (error.name === "PaginaNoSegura") return "El micrófono solo funciona si la app se abre con https (o en localhost).";
  return "No se pudo encender el micrófono. Intenta de nuevo.";
}
