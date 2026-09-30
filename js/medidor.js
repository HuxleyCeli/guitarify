// medidor.js
// ----------
// El MEDIDOR DE AGUJA (VU meter) del afinador, como pieza separada y reutilizable.
// Hace dos cosas:
//   1) Dibuja la escala (rayitas, números y zonas de color) dentro del SVG de index.html.
//   2) Ofrece la función moverAguja(cents), que gira la aguja y prende la lámpara.
// En la Fase 2, el afinador real solo va a tener que llamar a moverAguja() con
// el valor que calcule a partir del micrófono. Este archivo no sabe nada del
// micrófono: solo sabe dibujar. Separar así las tareas hace el código más fácil
// de entender, de probar y de cambiar.

// "use strict" = modo estricto: el navegador nos avisa de errores comunes
// (por ejemplo, usar una variable que nunca creamos) en vez de ignorarlos.
"use strict";

// ===== 1. Datos fijos del dibujo (en unidades del viewBox del SVG: 300 x 190) =====

// Coordenadas del eje sobre el que gira la aguja (el tornillo central)
const VU_EJE_X = 150;
const VU_EJE_Y = 170;
// Hasta cuántos cents muestra la escala hacia cada lado (−50 a +50)
const VU_MAX_CENTS = 50;
// Si la nota está a 5 cents o menos del centro, la consideramos "afinada"
const VU_ZONA_AFINADA = 5;
// Distancias desde el eje (radios) donde van las partes de la escala
const VU_RADIO_ZONAS = 138;     // arcos de color (rojo y dorado), por fuera de todo
const VU_RADIO_MARCAS = 132;    // donde empiezan las rayitas
const VU_RADIO_CORTA = 124;     // donde terminan las rayitas cortas
const VU_RADIO_LARGA = 116;     // donde terminan las rayitas largas
const VU_RADIO_NUMEROS = 102;   // donde van los números
// Dirección especial que hay que usar para crear elementos SVG desde JavaScript
// (el SVG es "otro idioma" dentro del HTML, y esta dirección es su nombre oficial)
const SVG_NS = "http://www.w3.org/2000/svg";

// ===== 2. Buscamos en la página las partes del medidor =====

const grupoEscala = document.getElementById("vu-escala");    // donde dibujaremos la escala
const aguja = document.getElementById("vu-aguja");           // la aguja roja
const lampara = document.getElementById("lampara-afinado");  // la lucecita "Afinada"

// ===== 3. Funciones de ayuda =====

// Convierte cents en grados de giro. Elegimos que 1 cent = 1 grado:
// −50 cents = aguja 50° a la izquierda, 0 = vertical, +50 = 50° a la derecha.
function centsAGrados(cents) {
  return cents;
}

// Calcula dónde cae un punto que está a cierta distancia ("radio") del eje,
// en cierta dirección ("grados", medidos desde la vertical).
// Usa seno y coseno, igual que en trigonometría del colegio:
//   x = centro + radio × seno(ángulo)
//   y = centro − radio × coseno(ángulo)   (se RESTA porque en pantalla la "y" crece hacia abajo)
function puntoEnArco(radio, grados) {
  const radianes = (grados * Math.PI) / 180;            // JavaScript trabaja con radianes, no con grados
  const x = VU_EJE_X + radio * Math.sin(radianes);
  const y = VU_EJE_Y - radio * Math.cos(radianes);
  // toFixed(2) redondea a 2 decimales para que el SVG quede más limpio
  return { x: x.toFixed(2), y: y.toFixed(2) };
}

// Crea un elemento SVG (línea, texto, etc.) y le pone todos sus atributos de una vez.
// "atributos" es un objeto como { x1: 10, y1: 20, class: "vu-marca" }.
function crearElementoSVG(etiqueta, atributos) {
  const elemento = document.createElementNS(SVG_NS, etiqueta); // crea el elemento "en idioma SVG"
  // Object.entries convierte el objeto en una lista de pares [nombre, valor] para recorrerla
  for (const [nombre, valor] of Object.entries(atributos)) {
    elemento.setAttribute(nombre, valor);
  }
  return elemento;
}

// Arma las instrucciones de dibujo ("d") de un arco entre dos ángulos.
// En SVG, "M x y" = mover el lápiz ahí, y "A ..." = dibujar un arco hasta otro punto.
function instruccionesArco(radio, desdeGrados, hastaGrados) {
  const inicio = puntoEnArco(radio, desdeGrados);
  const fin = puntoEnArco(radio, hastaGrados);
  return `M ${inicio.x} ${inicio.y} A ${radio} ${radio} 0 0 1 ${fin.x} ${fin.y}`;
}

// Escribe los cents como texto: "−20", "0", "+20".
// Usamos el signo menos tipográfico "−" (más largo y prolijo que el guion "-").
function textoCents(cents) {
  if (cents > 0) return "+" + cents;
  if (cents < 0) return "−" + Math.abs(cents); // Math.abs quita el signo: −20 → 20
  return "0";
}

// ===== 4. Dibujar la escala =====

function dibujarEscalaVU() {
  // Arcos de color, un poco por fuera de las rayitas:
  // rojos en los extremos (muy desafinado) y dorado al centro (afinado)
  grupoEscala.append(
    crearElementoSVG("path", { d: instruccionesArco(VU_RADIO_ZONAS, -50, -30), class: "vu-zona vu-zona-peligro" }),
    crearElementoSVG("path", { d: instruccionesArco(VU_RADIO_ZONAS, 30, 50), class: "vu-zona vu-zona-peligro" }),
    crearElementoSVG("path", {
      d: instruccionesArco(VU_RADIO_ZONAS, -VU_ZONA_AFINADA, VU_ZONA_AFINADA),
      class: "vu-zona vu-zona-afinada",
    })
  );

  // Una rayita cada 5 cents, desde −50 hasta +50 (21 rayitas en total)
  for (let cents = -VU_MAX_CENTS; cents <= VU_MAX_CENTS; cents += 5) {
    const grados = centsAGrados(cents);
    // "%" es el resto de una división: si cents ÷ 10 no deja resto, es múltiplo de 10 → rayita larga
    const esLarga = cents % 10 === 0;
    // Todas las rayitas empiezan en el mismo radio; las largas llegan más adentro
    const exterior = puntoEnArco(VU_RADIO_MARCAS, grados);
    const interior = puntoEnArco(esLarga ? VU_RADIO_LARGA : VU_RADIO_CORTA, grados);

    // Elegimos las clases CSS según el tipo de rayita
    let clases = "vu-marca";
    if (esLarga) clases += " vu-marca-larga";
    if (cents === 0) clases += " vu-marca-centro";

    grupoEscala.append(
      crearElementoSVG("line", { x1: exterior.x, y1: exterior.y, x2: interior.x, y2: interior.y, class: clases })
    );

    // Un número cada 20 cents (−40, −20, 0, +20, +40), un poco más adentro que las rayitas
    if (cents % 20 === 0) {
      const posicion = puntoEnArco(VU_RADIO_NUMEROS, grados);
      const numero = crearElementoSVG("text", { x: posicion.x, y: posicion.y, class: "vu-numero" });
      numero.textContent = textoCents(cents);
      grupoEscala.append(numero);
    }
  }
}

// ===== 5. Mover la aguja =====

// Gira la aguja hasta los cents indicados y prende o apaga la lámpara.
// Esta es la función que usará el afinador real en la Fase 2.
function moverAguja(cents) {
  // Math.min y Math.max "encierran" el valor entre −50 y +50,
  // para que la aguja nunca se salga de la escala
  const limitado = Math.max(-VU_MAX_CENTS, Math.min(VU_MAX_CENTS, cents));
  // Le pasamos el ángulo al CSS a través de la variable "--angulo" (ver .vu-aguja en estilos.css)
  aguja.style.setProperty("--angulo", centsAGrados(limitado) + "deg");
  // classList.toggle(clase, condición): pone la clase si la condición es verdadera, la quita si es falsa
  lampara.classList.toggle("encendida", Math.abs(cents) <= VU_ZONA_AFINADA);
}

// ===== 6. Arranque =====

// Dibujamos la escala una sola vez, apenas carga la página
dibujarEscalaVU();
