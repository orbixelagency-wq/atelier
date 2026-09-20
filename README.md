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

Botón **Moda** de la barra superior:

- **39 plantillas técnicas** propias (camisetas, sudaderas, chaquetas, pantalones y accesorios), delantero y espalda, con su área de estampado marcada.
- **Insertar diseño**: quita el fondo de la imagen, la encaja en el área de estampado y la recorta a la tela, así que al ampliarla nunca sobresale de la prenda.
- **Quitar fondo** automático o por color, con tolerancia y suavizado.
- **Pintar zona**: colorea una parte de la prenda sin salirte de las costuras.
- **16 pinceles de costura y textil**, modo repetición sin costuras y relleno con estampado.
- **Colorways** con tablero comparativo, **medidas** en cm/pulgadas, **mockup** sobre fotos y **ficha técnica en PDF**.

El análisis completo frente a Procreate está en [docs/ANALISIS-PROCREATE.md](docs/ANALISIS-PROCREATE.md).

## Gestos y atajos

Dos dedos: deshacer · tres: rehacer · cuatro: pantalla completa · pellizcar: zoom y rotación · mantener pulsado: cuentagotas.
Teclado: `B` pintar, `E` borrar, `Mayús+S` difuminar, `S` selección, `V` transformar, `L` capas, `C` color, `[` `]` tamaño, `Ctrl+Z` deshacer. La lista completa está en Acciones → Ayuda.

## Instalar como aplicación

Atelier es una PWA: se instala y funciona sin conexión, con su icono y su propia ventana.

- **PC (Chrome o Edge):** abre la web y pulsa **Instalar** en la cabecera, o el icono de instalar de la barra de direcciones.
- **iPad / iPhone (Safari):** Compartir → **Añadir a pantalla de inicio**.
- **Android (Chrome):** menú ⋮ → **Instalar aplicación**.

Las obras se guardan en el dispositivo donde instales la app; para pasarlas a otro, expórtalas (.atelier o PSD) e impórtalas allí.

## Publicar en Netlify

El repositorio ya trae  (build , carpeta , redirección SPA y cabeceras de caché).

1. Entra en Netlify → **Add new site → Import an existing project → GitHub** y elige este repositorio.
2. Netlify lee la configuración del archivo: no hay que tocar nada. Pulsa **Deploy**.
3. En **Site configuration → Domain management** puedes cambiar el subdominio (por ejemplo ).

Atajo: https://app.netlify.com/start/deploy?repository=https://github.com/orbixelagency-wq/atelier

Cada  a  lanza un despliegue nuevo automáticamente.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5180
npm run build
```

React + Vite + TypeScript, con un motor de pintura propio sobre Canvas 2D (`src/engine`). Para publicar una versión nueva en GitHub Pages: `npm run deploy`.
