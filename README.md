# Atelier

Estudio de pintura digital y edición de imagen en el navegador, con el modelo de trabajo de Procreate. Funciona en PC (ratón o tableta gráfica) y en iPad o tablet con lápiz. Las obras se guardan en el propio dispositivo; nada se sube a ningún servidor.

**Usar online:** https://orbixelagency-wq.github.io/atelier/

## Qué incluye

- Galería con lienzos predefinidos (pantalla, A4/A3 a 300 ppp, 4K, redes sociales, estampado de camiseta, patrón…) e importación de fotos, PSD y archivos `.atelier`.
- 84 pinceles en 18 familias con presión, inclinación, StreamLine, afinado, grano y mezcla húmeda, y un Brush Studio para editarlos o crear los tuyos.
- Pintar, difuminar, borrar, ColorDrop, QuickShape y cuentagotas.
- Capas con 17 modos de fusión, bloqueo alfa, máscaras de recorte y de capa, grupos y capa de referencia.
- 17 ajustes (tono/saturación/brillo, curvas, mapa de degradado, desenfoques, resplandor, fallo técnico, semitono, aberración cromática…), licuar y clonar.
- Selección automática, a mano alzada, rectangular y elíptica; transformación libre, uniforme, distorsión y deformación.
- Color en disco, clásico, armonía y valores; paletas, también generadas desde una imagen.
- Guías de dibujo (cuadrícula, isométrica, perspectiva, simetría), texto editable, asistente de animación y timelapse.
- Pilas en la galería, pincel doble, ajustes aplicados con pincel y asistente de página.
- Exportación a PSD con capas, PDF, TIFF, PNG, JPG, WebP, GIF animado y vídeo.

## Módulo Moda

Botón **Moda** de la barra superior: plantillas técnicas de 9 prendas (delantero y espalda), 16 pinceles de costura y textil, modo repetición para diseñar estampados sin costuras, relleno con estampado (cuadrícula, media gota, ladrillo, espejo), colorways con tablero comparativo, cotas en cm/pulgadas, ajuste de diseños a fotos de prendas (mockup) y ficha técnica en PDF.

El análisis completo frente a Procreate está en [docs/ANALISIS-PROCREATE.md](docs/ANALISIS-PROCREATE.md).

## Gestos y atajos

Dos dedos: deshacer · tres: rehacer · cuatro: pantalla completa · pellizcar: zoom y rotación · mantener pulsado: cuentagotas.
Teclado: `B` pintar, `E` borrar, `Mayús+S` difuminar, `S` selección, `V` transformar, `L` capas, `C` color, `[` `]` tamaño, `Ctrl+Z` deshacer. La lista completa está en Acciones → Ayuda.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5180
npm run build
```

React + Vite + TypeScript, con un motor de pintura propio sobre Canvas 2D (`src/engine`). Para publicar una versión nueva en GitHub Pages: `npm run deploy`.
