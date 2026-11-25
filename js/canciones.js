// canciones.js
// ------------
// La pantalla de CANCIONES: saca los acordes de un audio y los muestra en orden.
//   1. Consigue el audio: grabándolo con el micrófono o eligiendo un archivo.
//   2. Lo "decodifica" (convierte el mp3/m4a/wav en números) a 11025 muestras por segundo.
//   3. Lo recorre en trozos cortos ("ventanas") y en cada uno busca el acorde, mirando
//      también las ventanas vecinas (musica.js).
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
let ultimosElementos = null;   // la última lista de notas y acordes (para reescribirla si cambia el idioma)
let escribirEstado = () => t("cancionesInicio"); // "receta" del mensaje de estado actual (ver mostrarEstadoCanciones)

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
// Con { decimas: true } agrega las décimas de segundo ("0:02.4"): sirve para las notas,
// que pueden durar menos de un segundo y cambiar muy rápido.
function formatearTiempo(segundos, { decimas = false } = {}) {
  if (decimas) {
    const enDecimas = Math.round(segundos * 10);         // 2,43 s → 24 décimas
    const minutos = Math.floor(enDecimas / 600);          // 600 décimas = 1 minuto
    const resto = (enDecimas % 600) / 10;                 // lo que sobra, en segundos: 2.4
    return `${minutos}:${resto.toFixed(1).padStart(4, "0")}`; // "0:02.4"
  }
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
function remuestrear(muestras, frecuenciaOriginal, frecuenciaNueva = CANCIONES_FRECUENCIA) {
  const factor = frecuenciaOriginal / frecuenciaNueva;
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

// Convierte el archivo de audio (mp3, m4a, wav...) en una lista de números.
// "frecuencia" = cuántas muestras por segundo queremos: 11025 para los acordes (si no
// se dice otra cosa) y 22050 para las notas (ver musica.js, sección 7)
async function decodificarAudio(datos, frecuencia = CANCIONES_FRECUENCIA) {
  try {
    // Plan A: un "estudio de sonido fuera de línea" a esa frecuencia convierte y remuestrea en un solo paso
    const estudio = new OfflineAudioContext(1, 1, frecuencia);
    const bufer = await estudio.decodeAudioData(datos.slice(0)); // slice(0) = una copia (decodeAudioData "gasta" el original)
    return mezclarAMono(bufer);
  } catch {
    // Plan B: decodificar normal y remuestrear nosotros
    const estudio = new AudioContext();
    try {
      const bufer = await estudio.decodeAudioData(datos.slice(0));
      return remuestrear(mezclarAMono(bufer), bufer.sampleRate, frecuencia);
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

// Muestra el mensaje de estado. Recibe una FUNCIÓN que escribe el mensaje (una "receta"),
// no el texto ya escrito: la guardamos, y si cambias de idioma la volvemos a usar
// para escribir el mismo mensaje en el idioma nuevo.
// Ejemplo: mostrarEstadoCanciones(() => t("leyendo", "cancion.mp3"))
function mostrarEstadoCanciones(escribir) {
  escribirEstado = escribir;
  textoEstadoCanciones.textContent = escribir();
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

// Dibuja la lista: acordes y notas MEZCLADOS, en el orden en que suenan.
// Cada elemento tiene "tipo": "acorde" o "nota" (sale de mezclarNotasYAcordes, en musica.js).
// Si un elemento no dice su tipo, es un acorde (así funcionaba antes).
// Los nombres llegan en español ("Lam", "La"); nombreMusical (idioma.js) los escribe
// en el idioma elegido ("Am", "A").
function mostrarAcordes(elementos) {
  ultimosElementos = elementos;   // la guardamos para poder reescribirla si cambia el idioma
  listaAcordes.replaceChildren(); // borra la lista anterior
  for (const elemento of elementos) {
    const esNota = elemento.tipo === "nota";
    const fila = document.createElement("li");
    if (esNota) fila.className = "es-nota";      // el CSS pinta las notas en dorado
    const nombre = document.createElement("span");
    nombre.className = "acorde-nombre";
    nombre.textContent = nombreMusical(elemento.corto); // "Lam"/"Am" (acorde) o "La"/"A" (nota)
    const cifrado = document.createElement("span");
    cifrado.className = "acorde-cifrado";
    // Debajo del nombre: la nota con su octava ("A3"). En un acorde, en español va el
    // cifrado inglés ("Am"); en inglés eso repetiría el nombre, así que va "A minor"
    cifrado.textContent = esNota || idioma === "es" ? elemento.ingles : acordeCompleto(elemento.corto);
    const tiempo = document.createElement("span");
    tiempo.className = "acorde-tiempo";
    // Cuándo empieza: "0:04". Las notas, con décimas ("0:02.4"), porque cambian rápido
    tiempo.textContent = formatearTiempo(elemento.inicio, { decimas: esNota });
    // Diagrama chico (diagramas.js): cómo se toca el acorde, o dónde se toca la nota
    // (la nota, según la afinación elegida en el Afinador). El acorde se busca por su
    // nombre en español, que es como está guardado en la lista de formas.
    const diagrama = esNota
      ? dibujarDiagramaNota(posicionMasFacil(posicionesDeNota(elemento.numero, afinacionActual)), nombreMusical(elemento.corto), { mini: true })
      : dibujarDiagramaAcorde(elemento.corto, { ancho: 60, mini: true });
    fila.append(nombre, cifrado, diagrama, tiempo);
    // Al mantener el dedo o el mouse: "La menor" / "A minor", o "Nota La (A3)" / "Note A (A3)"
    fila.title = esNota ? t("notaCompleta", nombreMusical(elemento.corto), elemento.ingles) : acordeCompleto(elemento.corto);
    listaAcordes.append(fila);
  }
  // Resumen con los acordes y las notas distintas, en el orden en que aparecen por primera vez.
  // "new Set" guarda cada valor una sola vez (quita los repetidos).
  const distintos = (tipo) => [...new Set(elementos.filter((e) => (e.tipo || "acorde") === tipo).map((e) => nombreMusical(e.corto)))];
  const acordes = distintos("acorde");
  const notas = distintos("nota");
  const partes = [];
  if (acordes.length) partes.push(`${t("cuantosAcordes", acordes.length)}: ${acordes.join(" · ")}`);
  if (notas.length) partes.push(`${t("cuantasNotas", notas.length)}: ${notas.join(" · ")}`);
  resumenCanciones.textContent = t("resumen", partes);
  resumenCanciones.hidden = elementos.length === 0;
  vacioCanciones.hidden = elementos.length > 0;
  // Si no se encontró nada, cambia el mensaje. Cambiamos también su "data-t" (la clave
  // del texto): así, si después se cambia de idioma, idioma.js traduce el mensaje NUEVO
  vacioCanciones.dataset.t = "sinResultados";
  vacioCanciones.textContent = t("sinResultados");
}

// ===== 6. Analizar =====

// Analiza un archivo o grabación ("origen" es solo el nombre que se muestra: el nombre
// del archivo, o null si es una grabación)
async function analizarAudio(archivo, origen) {
  if (analizando) return;
  analizando = true;
  bloquearBotones(true);
  barraProgreso.hidden = false;
  mostrarAvance(0);
  // El nombre que se muestra: el del archivo, o "Grabación"/"Recording" según el idioma
  // (es una función para que se escriba en el idioma que esté elegido en ese momento)
  const nombre = () => origen ?? t("grabacion");
  mostrarEstadoCanciones(() => t("leyendo", nombre()));

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
        // Volumen y croma de esta ventana (musica.js). El acorde se decide después, con sus vecinas
        ...analizarVentana(muestras, inicio, CANCIONES_VENTANA, CANCIONES_FRECUENCIA),
      });
      // Cada 40 ventanas actualizamos la barra y dejamos respirar a la pantalla
      if (ventanas.length % 40 === 0) {
        mostrarAvance((ventanas.length / total) * 50);   // la primera mitad de la barra es de los acordes
        const porcentaje = Math.round((ventanas.length / total) * 50);
        mostrarEstadoCanciones(() => t("buscandoAcordes", nombre(), porcentaje));
        await pausaBreve();
      }
    }

    // Decidimos el acorde de cada ventana mirando también a sus vecinas, y después
    // juntamos los trozos iguales y quitamos los errores sueltos (las dos funciones en musica.js)
    const conAcordes = reconocerAcordesDeCancion(ventanas);
    const acordes = resumirAcordes(conAcordes, CANCIONES_SALTO / CANCIONES_FRECUENCIA);

    // SEGUNDA PASADA: las notas sueltas (riffs y solos). Se buscan en el mismo audio,
    // pero a 22050 muestras por segundo (CANCION_NOTA_FRECUENCIA, en musica.js), porque a
    // 11025 YIN se equivocaba de octava en las notas agudas
    const frecuenciaNotas = CANCION_NOTA_FRECUENCIA;
    const paraNotas = normalizarVolumen(await decodificarAudio(datos, frecuenciaNotas)).subarray(0, CANCIONES_MAXIMO_SEGUNDOS * frecuenciaNotas);
    // La cuerda más grave de la afinación elegida en el Afinador: no puede haber notas más graves
    const notaMasGrave = Math.min(...afinacionActual.notas);
    const lecturas = [];
    for (let inicio = 0; inicio + CANCION_NOTA_VENTANA <= paraNotas.length; inicio += CANCION_NOTA_SALTO) {
      lecturas.push({
        tiempo: (inicio + CANCION_NOTA_VENTANA / 2) / frecuenciaNotas,               // el centro del trozo
        numero: leerNotaDeVentana(paraNotas, inicio, frecuenciaNotas, notaMasGrave), // la nota o null (musica.js)
      });
      // Cada 400 trozos actualizamos la barra (la segunda mitad es de las notas)
      if (lecturas.length % 400 === 0) {
        const avance = 50 + 50 * (inicio / paraNotas.length);
        mostrarAvance(avance);
        mostrarEstadoCanciones(() => t("buscandoNotas", nombre(), Math.round(avance)));
        await pausaBreve();
      }
    }
    // Juntamos acordes y notas en una sola lista, en el orden en que suenan (musica.js)
    const elementos = mezclarNotasYAcordes(acordes, resumirNotas(lecturas));

    mostrarAvance(100);
    mostrarAcordes(elementos);
    // Cuántos acordes y cuántas notas hay (para el mensaje "3 acordes y 8 notas")
    const cuantos = (tipo) => elementos.filter((e) => e.tipo === tipo).length;
    const acordesTotal = cuantos("acorde");
    const notasTotal = cuantos("nota");
    // La "receta" del mensaje final: se puede volver a escribir en el otro idioma
    mostrarEstadoCanciones(() => {
      const recorte = duracion > CANCIONES_MAXIMO_SEGUNDOS ? t("recorte", formatearTiempo(CANCIONES_MAXIMO_SEGUNDOS)) : "";
      return t("resultado", nombre(), formatearTiempo(duracion), t("cuantosAcordes", acordesTotal), t("cuantasNotas", notasTotal), recorte);
    });
  } catch {
    mostrarEstadoCanciones(() => t("noLeido"));
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
  textoGrabar.textContent = grabando ? t("detener", "0:00") : t("grabar");
  cajaNivelCanciones.hidden = !grabando;
  nivelCanciones.style.setProperty("--nivel", "0%");
  botonElegir.disabled = grabando;
  clearInterval(relojGrabacion);
  if (grabando) {
    // Cada medio segundo actualizamos el contador de tiempo
    relojGrabacion = setInterval(() => {
      const segundos = (performance.now() - inicioGrabacion) / 1000;
      textoGrabar.textContent = t("detener", formatearTiempo(segundos));
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
    mostrarAviso(t("noGraba"));
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
      if (audio.size > 0) analizarAudio(audio, null); // null = "es una grabación" (se nombra según el idioma)
    };
    grabadora.start();
    inicioGrabacion = performance.now();
    prepararPantallaGrabacion(true);
    mostrarEstadoCanciones(() => t("grabando"));
  } catch (error) {
    mostrarAviso(mensajeErrorMicrofono(error));
  }
}

botonGrabar.addEventListener("click", () => {
  if (micEstaEncendido()) apagarMicrofono(); // estaba grabando: detener (y se analiza sola)
  else empezarGrabacion();
});

// ===== 9. Arranque e idioma =====

// Los textos del comienzo, en el idioma elegido
textoGrabar.textContent = t("grabar");
mostrarEstadoCanciones(escribirEstado);

// Al cambiar de idioma (idioma.js avisa): reescribimos el botón Grabar (si no está
// grabando), el mensaje de estado (con su "receta") y la lista, si ya hay una
alCambiarIdioma(() => {
  if (!micEstaEncendido()) textoGrabar.textContent = t("grabar");
  mostrarEstadoCanciones(escribirEstado);
  if (ultimosElementos) mostrarAcordes(ultimosElementos);
});
