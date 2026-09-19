# Análisis funcional de Procreate → plataforma Atelier

Inventario de lo que contiene Procreate (versión 5.x/6 para iPad) agrupado por áreas, y cómo lo cubre Atelier (web, navegador, PC + tablet con lápiz).

Leyenda: ✅ incluido en Atelier · 🟡 incluido en versión simplificada · ⏳ pendiente

---

## 1. Galería
| Procreate | Atelier |
|---|---|
| Rejilla de obras con miniaturas | ✅ guardado local (IndexedDB), funciona sin conexión |
| Nuevo lienzo: tamaños predefinidos (pantalla, cuadrado, 4K, A4, carta…) y personalizado (ancho, alto, DPI, perfil de color) | ✅ presets + personalizado con px/DPI |
| Importar imagen / foto | ✅ PNG, JPG, WebP, GIF, PSD (con capas) |
| Seleccionar, duplicar, borrar, compartir, renombrar | ✅ |
| Pilas (carpetas) | ⏳ |
| Vista previa a pantalla completa | ✅ |

## 2. Interfaz del lienzo
| Procreate | Atelier |
|---|---|
| Barra superior: Galería, Acciones (llave), Ajustes (varita), Selección, Transformar | ✅ |
| Barra superior derecha: Pintar, Difuminar, Borrar, Capas, Color | ✅ |
| Barra lateral: tamaño, botón modificador (cuentagotas), opacidad, deshacer/rehacer | ✅ |
| Interfaz para zurdos (barra a la derecha) | ✅ |
| Modo pantalla completa (ocultar interfaz) | ✅ tecla Tab / toque con 4 dedos |

## 3. Pinceles
| Procreate | Atelier |
|---|---|
| Biblioteca de +200 pinceles en ~18 categorías (Bocetos, Entintado, Dibujo, Pintura, Artístico, Caligrafía, Aerógrafo, Texturas, Abstracto, Carboncillo, Elementos, Aerosoles, Retoques, Retro, Luminancia, Industrial, Orgánico, Agua) | ✅ biblioteca propia con las mismas familias (pinceles generados de forma procedural, no copiados) |
| Usar cualquier pincel para pintar, difuminar o borrar | ✅ |
| Vista previa del trazo en la biblioteca | ✅ |
| Crear, duplicar, borrar, importar pinceles | ✅ (importar forma de punta desde imagen) |
| Pinceles recientes | ✅ |

## 4. Brush Studio (editor de pinceles)
| Parámetro | Atelier |
|---|---|
| Trazado: espaciado, StreamLine (estabilización), jitter, atenuación de caída | ✅ |
| Estabilización y filtro de movimiento | ✅ |
| Afinado (taper) inicio/fin por presión y por toque | ✅ |
| Forma: fuente de la punta, dispersión, rotación, número de muestras, redondez | ✅ |
| Grano: textura, escala, movimiento/estampado | ✅ |
| Renderizado: modos (glaseado ligero/uniforme/intenso, mezcla), flujo, bordes húmedos, modo de fusión | 🟡 glaseado + mezcla + modo de fusión |
| Mezcla húmeda: dilución, carga, arrastre, grado | ✅ |
| Dinámica de color: jitter de tono/saturación/brillo por sello y por trazo | ✅ |
| Dinámica: velocidad → tamaño/opacidad, jitter | ✅ |
| Apple Pencil: presión → tamaño/opacidad/flujo, inclinación | ✅ vía Pointer Events (Wacom, Huion, Apple Pencil en Safari, S-Pen) |
| Propiedades: tamaño máx/mín, opacidad máx/mín, orientación | ✅ |
| Pincel dual (combinar dos) | ⏳ |
| Pad de pruebas en vivo | ✅ |

## 5. Herramientas de pintura
| Procreate | Atelier |
|---|---|
| Pintar / Difuminar (smudge) / Borrar | ✅ |
| ColorDrop (arrastrar color para rellenar) con umbral | ✅ |
| QuickShape (mantener al final del trazo → línea, elipse, rectángulo, polígono perfectos) | ✅ |
| Cuentagotas (tocar y mantener / botón modificador) | ✅ |
| Simetría y dibujo asistido | ✅ |
| Curva de presión global | ✅ |

## 6. Capas
| Procreate | Atelier |
|---|---|
| Añadir, borrar, duplicar, bloquear, ocultar, reordenar arrastrando | ✅ |
| 27 modos de fusión | ✅ 16 modos (los que soporta el navegador: normal, multiplicar, oscurecer, subexponer color, aclarar, trama, sobreexponer, superponer, luz suave, luz fuerte, diferencia, exclusión, tono, saturación, color, luminosidad) |
| Opacidad por capa | ✅ |
| Bloqueo alfa | ✅ |
| Máscara de recorte | ✅ |
| Máscara de capa | ✅ |
| Capa de referencia (para ColorDrop sobre líneas) | ✅ |
| Combinar abajo, fusionar grupo, aplanar | ✅ |
| Grupos | 🟡 |
| Rellenar capa, borrar capa, invertir, seleccionar contenido | ✅ |
| Copiar / pegar / cortar | ✅ |
| Color de fondo | ✅ |

## 7. Ajustes (varita)
| Procreate | Atelier |
|---|---|
| Tono, saturación y brillo | ✅ |
| Equilibrio de color (sombras/medios/luces) | ✅ |
| Curvas (maestra + RGB) | ✅ |
| Mapa de degradado | ✅ |
| Desenfoque gaussiano, de movimiento, de perspectiva | ✅ |
| Nitidez, ruido | ✅ |
| Licuar (empujar, girar, pellizcar, expandir, cristales, reconstruir) | ✅ |
| Clonar | ✅ |
| Resplandor (bloom), fallo técnico (glitch), semitono, aberración cromática | ✅ |
| Modo capa o modo Pencil (aplicar con pincel) | 🟡 modo capa |

## 8. Selección
| Procreate | Atelier |
|---|---|
| Automática (varita por umbral), a mano alzada, rectangular, elíptica | ✅ |
| Añadir, restar, invertir, copiar y pegar, desvanecer (pluma), borrar, guardar/cargar, rellenar con color | ✅ |

## 9. Transformar
| Procreate | Atelier |
|---|---|
| Forma libre, uniforme, distorsión, deformación (warp) | ✅ |
| Voltear H/V, rotar 45°, ajustar a pantalla, reiniciar | ✅ |
| Interpolación (vecino más cercano / bilineal) | ✅ |
| Ajuste magnético / snapping | ✅ |

## 10. Color
| Procreate | Atelier |
|---|---|
| Disco, Clásico, Armonía (complementario, dividido, análogo, triádico, tetrádico), Valor (HSB/RGB/Hex) | ✅ |
| Paletas (crear, desde imagen, predeterminada) | ✅ |
| Historial de colores, color primario/secundario | ✅ |

## 11. Acciones (llave inglesa)
| Procreate | Atelier |
|---|---|
| Añadir: insertar archivo/foto, texto, cortar/copiar/pegar | ✅ |
| Lienzo: recortar y cambiar tamaño, voltear, información del lienzo, guía de dibujo, referencia | ✅ |
| Compartir: .procreate, PSD, PDF, JPEG, PNG, TIFF, GIF/PNG/MP4 animado, capas como PNG | ✅ .atelier, PSD, PNG, JPG, WebP, GIF animado, capas PNG · ⏳ PDF/TIFF |
| Vídeo: timelapse, grabar, exportar | ✅ repetición y exportación WebM |
| Preferencias: interfaz clara/oscura, zurdos, contorno del pincel, curva de presión, gestos | ✅ |
| Guía de dibujo: cuadrícula 2D, isométrica, perspectiva (1/2/3 puntos), simetría (vertical, horizontal, cuadrante, radial) | ✅ |
| Asistente de animación: fotogramas, piel de cebolla, FPS, bucle/ping-pong/una vez, retener fotograma | ✅ |
| Asistente de página (cómics/libros) | ⏳ |
| Pintura 3D | ⏳ |

## 12. Texto
| Procreate | Atelier |
|---|---|
| Añadir texto, fuente, tamaño, alineación, interlineado, estilo, editar después | ✅ |

## 13. Gestos
| Procreate | Atelier |
|---|---|
| Pellizcar para zoom/rotar, pellizco rápido para ajustar | ✅ |
| 2 dedos toque = deshacer, 3 dedos = rehacer, 4 dedos = pantalla completa | ✅ |
| Tocar y mantener = cuentagotas | ✅ |
| Atajos de teclado (en iPad con teclado) | ✅ ampliados para PC |

---

## Diferencias clave de Atelier
- Funciona en cualquier navegador (Windows, Mac, iPad, Android), no solo iPad.
- Soporta ratón, tableta gráfica y pantalla táctil.
- Todo se guarda en el dispositivo; nada se sube a ningún servidor.
- Abre y exporta PSD con capas para trabajar con Photoshop.
