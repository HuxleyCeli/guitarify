// musica.js
// ---------
// El "cerebro musical" de la app: TEORÍA MUSICAL y ANÁLISIS DE SONIDO.
// Este archivo no toca la página (no busca botones ni cambia textos): solo
// recibe números y devuelve números o nombres de notas. Por eso lo usan las
// 3 funciones (afinador, notas y canciones) y también se puede probar solo,
// sin navegador (ver scripts/pruebas.js).
//
// Tres ideas clave, explicadas simple:
//  1. Un sonido es una VIBRACIÓN. La cantidad de vibraciones por segundo es
//     su FRECUENCIA (se mide en Hz). Más Hz = sonido más agudo.
//     La nota La central vibra a 440 Hz; la cuerda Mi grave, a 82,41 Hz.
//  2. Para saber qué NOTA suena, buscamos cada cuánto se REPITE la forma de
//     la onda (su "período"). Frecuencia = 1 ÷ período. Usamos el método YIN.
//  3. Para saber qué ACORDE suena (varias notas a la vez), separamos el sonido
//     en todas sus frecuencias (con la "transformada de Fourier", FFT) y
//     sumamos cuánto suena cada una de las 12 notas. Eso se llama "croma".
//     Después comparamos ese croma con el de cada acorde conocido.

"use strict";

// ===== 1. Datos musicales =====

// Las 12 notas de la música occidental, en orden. "♯" = sostenido (medio tono más alto).
const NOMBRES_NOTAS = ["Do", "Do♯", "Re", "Re♯", "Mi", "Fa", "Fa♯", "Sol", "Sol♯", "La", "La♯", "Si"];
// Las mismas notas en "cifrado americano" (el que usan las partituras de guitarra en internet)
const NOMBRES_INGLES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
// Frecuencia de referencia mundial: la nota La4 vibra a 440 Hz
const FRECUENCIA_LA4 = 440;
// Por debajo de este volumen consideramos que hay silencio (el volumen va de 0 a 1)
const UMBRAL_SILENCIO = 0.01;
// Similitud mínima (de 0 a 1) para aceptar que un sonido es un acorde.
// Medido en las pruebas: los acordes dan ~0,95, pero una nota sola da ~0,77
// (sus armónicos se parecen a un acorde mayor). 0,82 separa bien los dos casos.
const SIMILITUD_MINIMA_ACORDE = 0.82;

// Los tipos de acorde que reconocemos. "intervalos" = cuántos semitonos hay
// desde la nota principal (la "raíz") hasta cada nota del acorde.
// Ejemplo: Do mayor = Do (0) + Mi (4 semitonos más arriba) + Sol (7).
const TIPOS_ACORDE = [
  { tipo: "mayor", intervalos: [0, 4, 7], sufijo: "", sufijoIngles: "" },
  { tipo: "menor", intervalos: [0, 3, 7], sufijo: "m", sufijoIngles: "m" },
];

// ===== 2. Números y notas =====

// Escribe una frecuencia al estilo hispano, con coma decimal: 82.41 → "82,41 Hz"
function formatearHz(frecuencia, decimales = 2) {
  const texto = frecuencia.toLocaleString("es", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  return texto + " Hz";
}

// Calcula el VOLUMEN de un trozo de sonido (de 0 = silencio a 1 = máximo).
// Usa la "raíz cuadrática media" (RMS): elevamos cada muestra al cuadrado,
// sacamos el promedio y después la raíz. Así las partes negativas de la onda
// no restan, y el resultado representa bien la "fuerza" del sonido.
function calcularVolumen(muestras) {
  let suma = 0;
  for (let i = 0; i < muestras.length; i++) suma += muestras[i] * muestras[i];
  return Math.sqrt(suma / muestras.length);
}

// Convierte una frecuencia en un "número de nota" (sistema MIDI, un estándar de
// los instrumentos electrónicos): La4 = 69, y cada semitono suma 1.
// La fórmula usa logaritmo porque cada vez que la frecuencia se DUPLICA,
// la nota sube una octava (12 semitonos).
function numeroDeNota(frecuencia) {
  return 69 + 12 * Math.log2(frecuencia / FRECUENCIA_LA4);
}

// Dice qué nota es una frecuencia y qué tan desafinada está.
// Ejemplo: 452 Hz → La (A4), +46 cents (un poco alta).
function frecuenciaANota(frecuencia) {
  const exacto = numeroDeNota(frecuencia);        // por ejemplo 69.46
  const redondeado = Math.round(exacto);          // la nota más cercana: 69
  const clase = ((redondeado % 12) + 12) % 12;    // posición dentro de las 12 notas (0 = Do ... 9 = La)
  const octava = Math.floor(redondeado / 12) - 1; // en qué octava está (el La central es la octava 4)
  return {
    nombre: NOMBRES_NOTAS[clase],                 // "La"
    ingles: NOMBRES_INGLES[clase] + octava,       // "A4"
    clase,
    octava,
    cents: (exacto - redondeado) * 100,           // 100 cents = 1 semitono
    frecuencia,
  };
}

// Cuántos cents hay entre dos frecuencias (positivo = la primera es más aguda)
function centsEntre(frecuencia, referencia) {
  return 1200 * Math.log2(frecuencia / referencia);
}

// ===== 3. Detectar UNA nota: método YIN =====
//
// Idea: comparamos la onda consigo misma, pero corrida en el tiempo. Si la
// corremos exactamente UN período, las dos copias calzan casi perfecto (la
// diferencia entre ellas es casi cero). Probamos muchos corrimientos y nos
// quedamos con el primero donde la diferencia se hace muy chica.
// (Método publicado por De Cheveigné y Kawahara en 2002.)
//
// Recibe: las muestras (números entre -1 y 1) y cuántas muestras hay por segundo.
// Devuelve: { frecuencia, claridad } o null si no hay una nota clara.
// "claridad" va de 0 a 1: cerca de 1 = una sola nota limpia.
function detectarTono(muestras, frecuenciaMuestreo, { minimo = 65, maximo = 1400, umbral = 0.15 } = {}) {
  // El corrimiento ("tau") se mide en muestras. Un tono agudo tiene un período corto
  // (tau chico) y uno grave, un período largo (tau grande).
  const tauMinimo = Math.floor(frecuenciaMuestreo / maximo);
  const tauMaximo = Math.min(Math.floor(frecuenciaMuestreo / minimo), Math.floor(muestras.length / 2));
  const ventana = muestras.length - tauMaximo; // cuántas muestras comparamos en cada prueba

  // Paso 1: diferencia entre la onda y su copia corrida "tau" muestras
  const diferencia = new Float32Array(tauMaximo + 1);
  for (let tau = 1; tau <= tauMaximo; tau++) {
    let suma = 0;
    for (let j = 0; j < ventana; j++) {
      const resta = muestras[j] - muestras[j + tau];
      suma += resta * resta;
    }
    diferencia[tau] = suma;
  }

  // Paso 2: "normalizar" la diferencia (dividirla por el promedio de las anteriores).
  // Así el valor no depende del volumen, y un buen candidato queda por debajo de 1.
  const normalizada = new Float32Array(tauMaximo + 1);
  normalizada[0] = 1;
  let acumulado = 0;
  for (let tau = 1; tau <= tauMaximo; tau++) {
    acumulado += diferencia[tau];
    normalizada[tau] = acumulado === 0 ? 1 : (diferencia[tau] * tau) / acumulado;
  }

  // Paso 3: buscar el PRIMER corrimiento que baje del umbral, y bajar hasta el fondo de ese "valle"
  let tauElegido = -1;
  for (let tau = tauMinimo; tau <= tauMaximo; tau++) {
    if (normalizada[tau] < umbral) {
      while (tau + 1 <= tauMaximo && normalizada[tau + 1] < normalizada[tau]) tau++;
      tauElegido = tau;
      break;
    }
  }
  if (tauElegido === -1) return null; // ningún corrimiento calzó bien: no hay una nota clara

  // Paso 4: afinar el resultado entre dos muestras con una parábola (interpolación).
  // Sin esto, el tono solo podría caer en valores "escalonados" y perderíamos precisión.
  let tauFino = tauElegido;
  if (tauElegido > 1 && tauElegido < tauMaximo) {
    const a = normalizada[tauElegido - 1];
    const b = normalizada[tauElegido];
    const c = normalizada[tauElegido + 1];
    const curvatura = a - 2 * b + c;
    if (curvatura !== 0) tauFino = tauElegido + (a - c) / (2 * curvatura);
  }

  return { frecuencia: frecuenciaMuestreo / tauFino, claridad: 1 - normalizada[tauElegido] };
}

// ===== 4. Separar un sonido en frecuencias: FFT =====
//
// La "Transformada Rápida de Fourier" (FFT) toma un trozo de onda y dice cuánto
// suena cada frecuencia dentro de él (como el ecualizador de un equipo de música).
// Esta es la versión clásica "radix-2": el trozo debe tener un largo que sea
// potencia de 2 (1024, 2048, 4096...). Modifica los arreglos "re" e "im" en su lugar.
function fft(re, im) {
  const n = re.length;
  // Paso 1: reordenar las muestras invirtiendo los bits de su posición (truco del algoritmo)
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Paso 2: combinar pares, luego grupos de 4, de 8... ("mariposas")
  for (let largo = 2; largo <= n; largo <<= 1) {
    const mitad = largo >> 1;
    const angulo = (-2 * Math.PI) / largo;
    const pasoRe = Math.cos(angulo);
    const pasoIm = Math.sin(angulo);
    for (let inicio = 0; inicio < n; inicio += largo) {
      let giroRe = 1;
      let giroIm = 0;
      for (let k = 0; k < mitad; k++) {
        const a = inicio + k;
        const b = a + mitad;
        const bRe = re[b] * giroRe - im[b] * giroIm;
        const bIm = re[b] * giroIm + im[b] * giroRe;
        re[b] = re[a] - bRe;
        im[b] = im[a] - bIm;
        re[a] += bRe;
        im[a] += bIm;
        const siguiente = giroRe * pasoRe - giroIm * pasoIm;
        giroIm = giroRe * pasoIm + giroIm * pasoRe;
        giroRe = siguiente;
      }
    }
  }
}

// Devuelve cuánto suena cada frecuencia ("magnitudes") en un trozo de sonido.
// Antes de la FFT suavizamos los bordes del trozo con una "ventana de Hann"
// (una curva que empieza y termina en cero); si no, el corte brusco
// inventaría frecuencias que no existen.
function espectro(muestras) {
  const n = muestras.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = muestras[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const magnitudes = new Float32Array(n / 2); // solo la primera mitad sirve (la otra es un espejo)
  for (let k = 0; k < n / 2; k++) magnitudes[k] = Math.hypot(re[k], im[k]);
  return magnitudes;
}

// ===== 5. Reconocer ACORDES =====

// Arma el "croma": un arreglo de 12 números que dice cuánto suena cada nota
// (Do, Do♯, Re...), sin importar la octava. Recibe las magnitudes del espectro.
// Solo cuenta los "picos" (las frecuencias que sobresalen de sus vecinas),
// porque son las notas reales; el resto es ruido.
function cromaDesdeEspectro(magnitudes, frecuenciaMuestreo, { minimo = 60, maximo = 2000 } = {}) {
  const croma = new Array(12).fill(0);
  const anchoBanda = frecuenciaMuestreo / (magnitudes.length * 2); // cuántos Hz representa cada casilla
  const desde = Math.max(1, Math.ceil(minimo / anchoBanda));
  const hasta = Math.min(magnitudes.length - 2, Math.floor(maximo / anchoBanda));

  // Primera pasada: encontrar el pico más fuerte, para ignorar los que sean 50 veces más débiles
  let picoMaximo = 0;
  for (let k = desde; k <= hasta; k++) {
    if (magnitudes[k] > magnitudes[k - 1] && magnitudes[k] >= magnitudes[k + 1]) picoMaximo = Math.max(picoMaximo, magnitudes[k]);
  }
  if (picoMaximo === 0) return croma;

  // Segunda pasada: sumar cada pico en la nota que le corresponde
  for (let k = desde; k <= hasta; k++) {
    const actual = magnitudes[k];
    if (actual <= magnitudes[k - 1] || actual < magnitudes[k + 1] || actual < picoMaximo * 0.02) continue;
    // Afinamos la posición del pico con una parábola (igual que en YIN) para no errar de nota
    const izquierda = magnitudes[k - 1];
    const derecha = magnitudes[k + 1];
    const curvatura = izquierda - 2 * actual + derecha;
    const corrimiento = curvatura !== 0 ? (0.5 * (izquierda - derecha)) / curvatura : 0;
    const frecuencia = (k + corrimiento) * anchoBanda;
    const nota = Math.round(numeroDeNota(frecuencia));
    croma[((nota % 12) + 12) % 12] += actual;
  }

  // Normalizamos: la nota que más suena queda en 1 y las demás en proporción
  const mayor = Math.max(...croma);
  return croma.map((valor) => valor / mayor);
}

// Compara el croma con los 24 acordes (12 mayores y 12 menores) y devuelve el que más se parece.
// La "similitud coseno" mide qué tanto apuntan en la misma dirección dos listas de
// números: 1 = idénticas, 0 = nada que ver.
function detectarAcorde(croma) {
  const norma = Math.sqrt(croma.reduce((suma, valor) => suma + valor * valor, 0));
  if (norma === 0) return null;

  let mejor = null;
  for (let raiz = 0; raiz < 12; raiz++) {
    for (const tipo of TIPOS_ACORDE) {
      const notas = tipo.intervalos.map((intervalo) => (raiz + intervalo) % 12);
      const sumaDentro = notas.reduce((suma, nota) => suma + croma[nota], 0);
      const similitud = sumaDentro / (norma * Math.sqrt(notas.length));
      // Pequeño desempate: si la raíz suena fuerte, el acorde es más probable
      const puntaje = similitud + 0.03 * croma[raiz];
      if (!mejor || puntaje > mejor.puntaje) mejor = { raiz, tipo, notas, similitud, puntaje };
    }
  }

  return {
    corto: NOMBRES_NOTAS[mejor.raiz] + mejor.tipo.sufijo,           // "Lam"
    completo: `${NOMBRES_NOTAS[mejor.raiz]} ${mejor.tipo.tipo}`,     // "La menor"
    ingles: NOMBRES_INGLES[mejor.raiz] + mejor.tipo.sufijoIngles,    // "Am"
    notas: mejor.notas.map((nota) => NOMBRES_NOTAS[nota]),           // ["La", "Do", "Mi"]
    similitud: mejor.similitud,
  };
}

// ===== 6. Analizar una CANCIÓN (un audio completo) =====

// Analiza un trozo ("ventana") de un audio y devuelve el acorde que suena, o null
// si hay silencio o si no se parece lo suficiente a ningún acorde.
function analizarVentana(muestras, inicio, tamano, frecuenciaMuestreo) {
  const trozo = muestras.subarray(inicio, inicio + tamano);
  if (calcularVolumen(trozo) < UMBRAL_SILENCIO) return null;
  const acorde = detectarAcorde(cromaDesdeEspectro(espectro(trozo), frecuenciaMuestreo));
  return acorde && acorde.similitud >= SIMILITUD_MINIMA_ACORDE ? acorde : null;
}

// Convierte la lista de ventanas analizadas en la lista final de acordes, en orden.
// Recibe: [{ tiempo, acorde }, ...] y cuántos segundos dura cada ventana.
// Devuelve: [{ corto, completo, ingles, inicio, duracion }, ...]
function resumirAcordes(ventanas, duracionVentana, { minimoSegundos = 0.9 } = {}) {
  const clave = (acorde) => (acorde ? acorde.corto : null);

  // Paso 1: "voto de mayoría". Cada ventana adopta el acorde más repetido entre
  // ella y sus 2 vecinas de cada lado. Así un error suelto no aparece en la lista.
  const suavizadas = ventanas.map((ventana, i) => {
    const vecinas = ventanas.slice(Math.max(0, i - 2), i + 3);
    const votos = new Map();
    for (const vecina of vecinas) votos.set(clave(vecina.acorde), (votos.get(clave(vecina.acorde)) || 0) + 1);
    let ganador = clave(ventana.acorde);
    for (const [nombre, cantidad] of votos) if (cantidad > (votos.get(ganador) || 0)) ganador = nombre;
    const acorde = vecinas.find((vecina) => clave(vecina.acorde) === ganador)?.acorde || null;
    return { tiempo: ventana.tiempo, acorde };
  });

  // Paso 2: juntar las ventanas seguidas que tienen el mismo acorde en un solo "tramo"
  const tramos = [];
  for (const ventana of suavizadas) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.clave === clave(ventana.acorde)) {
      ultimo.fin = ventana.tiempo + duracionVentana;
    } else {
      tramos.push({ clave: clave(ventana.acorde), acorde: ventana.acorde, inicio: ventana.tiempo, fin: ventana.tiempo + duracionVentana });
    }
  }

  // Paso 3: quitar los silencios y los tramos demasiado cortos (probablemente errores),
  // y volver a unir los tramos iguales que quedaron juntos después de quitarlos
  const resultado = [];
  for (const tramo of tramos) {
    if (tramo.clave === null || tramo.fin - tramo.inicio < minimoSegundos) continue;
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.clave === tramo.clave) ultimo.fin = tramo.fin;
    else resultado.push({ ...tramo });
  }

  return resultado.map((tramo) => ({
    corto: tramo.acorde.corto,
    completo: tramo.acorde.completo,
    ingles: tramo.acorde.ingles,
    inicio: tramo.inicio,
    duracion: tramo.fin - tramo.inicio,
  }));
}

// Esto permite usar este mismo archivo desde las pruebas automáticas (en Node.js).
// En el navegador "module" no existe, así que esta línea no hace nada allí.
if (typeof module !== "undefined") {
  module.exports = {
    NOMBRES_NOTAS, UMBRAL_SILENCIO, SIMILITUD_MINIMA_ACORDE, formatearHz, calcularVolumen, frecuenciaANota, centsEntre,
    detectarTono, fft, espectro, cromaDesdeEspectro, detectarAcorde, analizarVentana, resumirAcordes,
  };
}
