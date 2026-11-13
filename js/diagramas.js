// diagramas.js
// ------------
// DIAGRAMAS DE ACORDES: el dibujo que muestra cómo se toca un acorde en la guitarra.
//   - 6 líneas verticales  = las cuerdas (izquierda la 6ª, la más gruesa; derecha la 1ª).
//   - líneas horizontales  = los trastes. La barra gruesa de arriba es la cejuela.
//   - círculos rojos       = dónde va cada dedo (1 índice, 2 medio, 3 anular, 4 meñique).
//   - ○ arriba             = esa cuerda suena "al aire" (sin apretar).
//   - × arriba             = esa cuerda NO se toca.
//   - barra roja           = "cejilla": un dedo aprieta varias cuerdas a la vez.
// Lo usan la pantalla de Notas y acordes (diagrama grande) y la de Canciones (diagramas chicos).

"use strict";

// ===== 1. Las formas de los 24 acordes =====
//
// Para cada acorde:
//   trastes: en qué traste se aprieta cada cuerda, de la 6ª a la 1ª.
//            -1 = no se toca, 0 = al aire, 1, 2, 3... = número de traste.
//   dedos:   qué dedo aprieta cada cuerda (0 = ninguno).
//   cejilla: (opcional) en qué traste el dedo 1 aprieta varias cuerdas a la vez.
// Los acordes comunes van en su forma "abierta" (con cuerdas al aire). El resto usa
// cejilla. Las pruebas automáticas comprueban que cada forma suene exactamente
// con las notas de su acorde.
const FORMAS_ACORDES = {
  // --- Mayores ---
  "Do":   { trastes: [-1, 3, 2, 0, 1, 0], dedos: [0, 3, 2, 0, 1, 0] },
  "Do♯":  { trastes: [-1, 4, 6, 6, 6, 4], dedos: [0, 1, 2, 3, 4, 1], cejilla: 4 },
  "Re":   { trastes: [-1, -1, 0, 2, 3, 2], dedos: [0, 0, 0, 1, 3, 2] },
  "Mi♭":  { trastes: [-1, 6, 8, 8, 8, 6], dedos: [0, 1, 2, 3, 4, 1], cejilla: 6 },
  "Mi":   { trastes: [0, 2, 2, 1, 0, 0], dedos: [0, 2, 3, 1, 0, 0] },
  "Fa":   { trastes: [1, 3, 3, 2, 1, 1], dedos: [1, 3, 4, 2, 1, 1], cejilla: 1 },
  "Fa♯":  { trastes: [2, 4, 4, 3, 2, 2], dedos: [1, 3, 4, 2, 1, 1], cejilla: 2 },
  "Sol":  { trastes: [3, 2, 0, 0, 0, 3], dedos: [2, 1, 0, 0, 0, 3] },
  "La♭":  { trastes: [4, 6, 6, 5, 4, 4], dedos: [1, 3, 4, 2, 1, 1], cejilla: 4 },
  "La":   { trastes: [-1, 0, 2, 2, 2, 0], dedos: [0, 0, 1, 2, 3, 0] },
  "Si♭":  { trastes: [-1, 1, 3, 3, 3, 1], dedos: [0, 1, 2, 3, 4, 1], cejilla: 1 },
  "Si":   { trastes: [-1, 2, 4, 4, 4, 2], dedos: [0, 1, 2, 3, 4, 1], cejilla: 2 },
  // --- Menores ---
  "Dom":   { trastes: [-1, 3, 5, 5, 4, 3], dedos: [0, 1, 3, 4, 2, 1], cejilla: 3 },
  "Do♯m":  { trastes: [-1, 4, 6, 6, 5, 4], dedos: [0, 1, 3, 4, 2, 1], cejilla: 4 },
  "Rem":   { trastes: [-1, -1, 0, 2, 3, 1], dedos: [0, 0, 0, 2, 3, 1] },
  "Re♯m":  { trastes: [-1, 6, 8, 8, 7, 6], dedos: [0, 1, 3, 4, 2, 1], cejilla: 6 },
  "Mim":   { trastes: [0, 2, 2, 0, 0, 0], dedos: [0, 2, 3, 0, 0, 0] },
  "Fam":   { trastes: [1, 3, 3, 1, 1, 1], dedos: [1, 3, 4, 1, 1, 1], cejilla: 1 },
  "Fa♯m":  { trastes: [2, 4, 4, 2, 2, 2], dedos: [1, 3, 4, 1, 1, 1], cejilla: 2 },
  "Solm":  { trastes: [3, 5, 5, 3, 3, 3], dedos: [1, 3, 4, 1, 1, 1], cejilla: 3 },
  "Sol♯m": { trastes: [4, 6, 6, 4, 4, 4], dedos: [1, 3, 4, 1, 1, 1], cejilla: 4 },
  "Lam":   { trastes: [-1, 0, 2, 2, 1, 0], dedos: [0, 0, 2, 3, 1, 0] },
  "Si♭m":  { trastes: [-1, 1, 3, 3, 2, 1], dedos: [0, 1, 3, 4, 2, 1], cejilla: 1 },
  "Sim":   { trastes: [-1, 2, 4, 4, 3, 2], dedos: [0, 1, 3, 4, 2, 1], cejilla: 2 },
};

// Cuántos trastes muestra cada diagrama (hacia abajo)
const DIAGRAMA_FILAS = 4;
// Dirección oficial del "idioma" SVG (hace falta para crear dibujos desde JavaScript)
const DIAGRAMA_NS = "http://www.w3.org/2000/svg";

// ===== 2. Ayudas =====

// Crea un elemento SVG con sus atributos (y un texto adentro, si se indica)
function crearSVGDiagrama(etiqueta, atributos, texto) {
  const elemento = document.createElementNS(DIAGRAMA_NS, etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) elemento.setAttribute(nombre, valor);
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// Describe el acorde con palabras, para quien usa un lector de pantalla (no ve el dibujo).
// Ejemplo: "Cómo se toca Lam: cuerda 6 no se toca; cuerda 5 al aire; cuerda 4, traste 2, dedo 2; ..."
function describirForma(nombre, forma) {
  const partes = forma.trastes.map((traste, i) => {
    const cuerda = 6 - i; // la posición 0 de la lista es la 6ª cuerda
    if (traste === -1) return `cuerda ${cuerda} no se toca`;
    if (traste === 0) return `cuerda ${cuerda} al aire`;
    return `cuerda ${cuerda}, traste ${traste}, dedo ${forma.dedos[i]}`;
  });
  return `Cómo se toca ${nombre}: ${partes.join("; ")}.`;
}

// ===== 3. Dibujar =====

// Dibuja el diagrama del acorde "nombre" (por ejemplo "Lam") y lo devuelve como un SVG.
//   ancho: tamaño del dibujo en píxeles
//   mini:  true = versión chica (sin números de dedo ni ○), para las tarjetas de Canciones
function dibujarDiagramaAcorde(nombre, { ancho = 150, mini = false } = {}) {
  const forma = FORMAS_ACORDES[nombre];

  // Desde qué traste empieza el dibujo: si el acorde se toca más arriba en el mástil
  // (por ejemplo, cejilla en el traste 6), el dibujo empieza ahí y lo indica con un número
  const inicio = forma.cejilla > 1 ? forma.cejilla : 1;

  // Medidas: márgenes, separación entre cuerdas (horizontal) y entre trastes (vertical)
  const margenIzquierdo = mini ? 10 : 22;   // más espacio a la izquierda para el número de traste
  const margenDerecho = mini ? 6 : 12;
  const arriba = mini ? 12 : 24;             // espacio arriba para ○ y ×
  const separacionCuerdas = (ancho - margenIzquierdo - margenDerecho) / 5;
  const separacionTrastes = separacionCuerdas * 1.25;
  const alto = arriba + DIAGRAMA_FILAS * separacionTrastes + 4;
  const radio = separacionCuerdas * (mini ? 0.36 : 0.38); // tamaño de los círculos de los dedos

  // Posición horizontal de cada cuerda (0 = 6ª) y vertical del centro de cada traste
  const xCuerda = (indice) => margenIzquierdo + indice * separacionCuerdas;
  const yTraste = (traste) => arriba + (traste - inicio + 0.5) * separacionTrastes;

  // El "lienzo" del dibujo. role="img" + aria-label = un lector de pantalla lo lee como una imagen con esa descripción
  const svg = crearSVGDiagrama("svg", {
    class: mini ? "diagrama diagrama-mini" : "diagrama",
    width: ancho,
    height: alto,
    viewBox: `0 0 ${ancho} ${alto}`,
    role: "img",
    "aria-label": describirForma(nombre, forma),
  });

  // Trastes: líneas horizontales
  for (let fila = 0; fila <= DIAGRAMA_FILAS; fila++) {
    const y = arriba + fila * separacionTrastes;
    svg.append(crearSVGDiagrama("line", { class: "diagrama-traste", x1: xCuerda(0), x2: xCuerda(5), y1: y, y2: y }));
  }

  // Cejuela (la barra gruesa del principio del mástil): solo si el dibujo empieza en el traste 1.
  // Si empieza más arriba, en su lugar escribimos el número del traste a la izquierda.
  if (inicio === 1) {
    const grosor = mini ? 3 : 4;
    svg.append(crearSVGDiagrama("rect", { class: "diagrama-cejuela", x: xCuerda(0) - 1, y: arriba - grosor, width: xCuerda(5) - xCuerda(0) + 2, height: grosor, rx: 1 }));
  } else {
    // Va a la izquierda de la 6ª cuerda, más allá del borde de una posible cejilla, para que no lo tape
    svg.append(crearSVGDiagrama("text", { class: "diagrama-numero-traste", x: xCuerda(0) - radio - (mini ? 2 : 4), y: yTraste(inicio) }, inicio));
  }

  // Cuerdas: líneas verticales, las graves (izquierda) un poco más gruesas, como las reales
  for (let indice = 0; indice < 6; indice++) {
    svg.append(crearSVGDiagrama("line", {
      class: "diagrama-cuerda",
      x1: xCuerda(indice), x2: xCuerda(indice),
      y1: arriba, y2: arriba + DIAGRAMA_FILAS * separacionTrastes,
      "stroke-width": (mini ? 1.4 : 2.2) - indice * (mini ? 0.12 : 0.25),
    }));
    // Arriba de cada cuerda: × si no se toca y ○ si va al aire (en la versión chica, solo ×)
    const traste = forma.trastes[indice];
    if (traste === -1) svg.append(crearSVGDiagrama("text", { class: "diagrama-marca", x: xCuerda(indice), y: arriba - (mini ? 4 : 9) }, "×"));
    if (traste === 0 && !mini) svg.append(crearSVGDiagrama("text", { class: "diagrama-marca", x: xCuerda(indice), y: arriba - 9 }, "○"));
  }

  // Cejilla: una barra redondeada desde la primera cuerda que aprieta el dedo 1 hasta la 1ª cuerda
  if (forma.cejilla) {
    const desde = forma.trastes.findIndex((traste, i) => traste === forma.cejilla && forma.dedos[i] === 1);
    const y = yTraste(forma.cejilla);
    svg.append(crearSVGDiagrama("rect", {
      class: "diagrama-cejilla",
      x: xCuerda(desde) - radio, y: y - radio,
      width: xCuerda(5) - xCuerda(desde) + 2 * radio, height: 2 * radio,
      rx: radio, // esquinas totalmente redondas
    }));
    if (!mini) svg.append(crearSVGDiagrama("text", { class: "diagrama-dedo-numero", x: (xCuerda(desde) + xCuerda(5)) / 2, y }, "1"));
  }

  // Dedos: un círculo por cada cuerda apretada (menos las que ya cubre la cejilla)
  forma.trastes.forEach((traste, indice) => {
    if (traste <= 0) return;                                                        // al aire o no se toca
    if (forma.cejilla && traste === forma.cejilla && forma.dedos[indice] === 1) return; // ya está en la cejilla
    svg.append(crearSVGDiagrama("circle", { class: "diagrama-dedo", cx: xCuerda(indice), cy: yTraste(traste), r: radio }));
    if (!mini) svg.append(crearSVGDiagrama("text", { class: "diagrama-dedo-numero", x: xCuerda(indice), y: yTraste(traste) }, forma.dedos[indice]));
  });

  return svg;
}

// ===== 4. Dibujar dónde se toca UNA NOTA =====

// Dibuja un trozo del mástil (igual que el de los acordes) con un solo círculo rojo
// en el lugar donde se toca la nota. Si es una cuerda al aire, la marca arriba con
// un círculo rojo vacío.
//   posicion: { cuerda, indice, traste } (sale de posicionMasFacil, en musica.js)
//   nombre:   el nombre de la nota que va dentro del círculo ("Do")
//   mini:     true = versión chica (60 px) para las tarjetas de Canciones: solo el
//             punto rojo, sin el nombre adentro (a ese tamaño no se leería)
function dibujarDiagramaNota(posicion, nombre, { mini = false, ancho = mini ? 60 : 150 } = {}) {
  // Desde qué traste empieza el dibujo: si la nota está en los trastes 1 a 3, desde
  // el principio del mástil; si está más arriba, la nota queda en la 2ª fila del dibujo
  const inicio = posicion.traste <= 3 ? 1 : posicion.traste - 1;

  // Medidas. El margen es IGUAL a los dos lados: así el mástil queda centrado
  // (deja espacio a la izquierda para el número de traste cuando hace falta)
  const margen = mini ? 10 : 22;
  const arriba = mini ? 12 : 24;                          // espacio arriba para la marca de cuerda al aire
  const separacionCuerdas = (ancho - 2 * margen) / 5;
  const separacionTrastes = separacionCuerdas * 1.25;
  const alto = arriba + DIAGRAMA_FILAS * separacionTrastes + 4;
  const radio = separacionCuerdas * (mini ? 0.36 : 0.42);  // en grande, un poco más que los dedos: lleva el nombre adentro

  // Posición horizontal de cada cuerda (0 = 6ª) y vertical del centro de cada traste
  const xCuerda = (indice) => margen + indice * separacionCuerdas;
  const yTraste = (traste) => arriba + (traste - inicio + 0.5) * separacionTrastes;

  // Descripción en palabras para lectores de pantalla
  const lugar = posicion.traste === 0 ? "al aire" : `traste ${posicion.traste}`;
  const svg = crearSVGDiagrama("svg", {
    class: mini ? "diagrama diagrama-nota diagrama-mini" : "diagrama diagrama-nota",
    width: ancho,
    height: alto,
    viewBox: `0 0 ${ancho} ${alto}`,
    role: "img",
    "aria-label": `Dónde se toca ${nombre}: cuerda ${posicion.cuerda}, ${lugar}.`,
  });

  // Trastes: líneas horizontales
  for (let fila = 0; fila <= DIAGRAMA_FILAS; fila++) {
    const y = arriba + fila * separacionTrastes;
    svg.append(crearSVGDiagrama("line", { class: "diagrama-traste", x1: xCuerda(0), x2: xCuerda(5), y1: y, y2: y }));
  }

  // Cejuela si el dibujo empieza en el traste 1; si no, el número del traste a la izquierda
  if (inicio === 1) {
    const grosor = mini ? 3 : 4; // la cejuela es más finita en la versión chica
    svg.append(crearSVGDiagrama("rect", { class: "diagrama-cejuela", x: xCuerda(0) - 1, y: arriba - grosor, width: xCuerda(5) - xCuerda(0) + 2, height: grosor, rx: 1 }));
  } else {
    svg.append(crearSVGDiagrama("text", { class: "diagrama-numero-traste", x: xCuerda(0) - (mini ? 3 : 8), y: yTraste(inicio) }, inicio));
  }

  // Cuerdas: líneas verticales, las graves más gruesas
  for (let indice = 0; indice < 6; indice++) {
    svg.append(crearSVGDiagrama("line", {
      class: "diagrama-cuerda",
      x1: xCuerda(indice), x2: xCuerda(indice),
      y1: arriba, y2: arriba + DIAGRAMA_FILAS * separacionTrastes,
      "stroke-width": (mini ? 1.4 : 2.2) - indice * (mini ? 0.12 : 0.25),
    }));
  }

  if (posicion.traste === 0) {
    // Cuerda al aire: círculo rojo vacío arriba de esa cuerda
    svg.append(crearSVGDiagrama("circle", { class: "diagrama-aire", cx: xCuerda(posicion.indice), cy: arriba - (mini ? 6 : 11), r: mini ? 3.5 : 6 }));
  } else {
    // Cuerda apretada: círculo rojo (en grande, con el nombre de la nota adentro)
    svg.append(crearSVGDiagrama("circle", { class: "diagrama-dedo", cx: xCuerda(posicion.indice), cy: yTraste(posicion.traste), r: radio }));
    if (!mini) svg.append(crearSVGDiagrama("text", { class: "diagrama-nota-nombre", x: xCuerda(posicion.indice), y: yTraste(posicion.traste) }, nombre));
  }

  return svg;
}

// Para las pruebas automáticas (en Node.js). En el navegador "module" no existe y esto no hace nada.
if (typeof module !== "undefined") module.exports = { FORMAS_ACORDES };
