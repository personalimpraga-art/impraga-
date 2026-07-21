# Guía de la app TORI (para Andrés)

## Qué cambia con la app `.exe`

Hoy TORI corre en Chrome y guarda los datos **dentro del navegador**. Si limpias el
historial o los datos de Chrome, se pierde todo. Eso es el miedo que quieres quitar.

La app `.exe` corre TORI **igualito** (mismo aspecto, mismas funciones), pero guarda
los datos en una **carpeta propia del PC**, separada de Chrome. Limpiar el navegador
**ya no borra nada**. Y no tiene el límite de tamaño del navegador.

## PASO IMPORTANTE: pasar tus datos actuales a la app (una sola vez)

La app arranca **vacía** (sus datos están aparte de Chrome). Tus datos de hoy están
en el Chrome. Para pasarlos:

1. Abre **TORI en Chrome** como siempre (el que ya tiene toda tu información).
2. Haz un **backup completo** desde el botón de backup de TORI. Se descarga un
   archivo `TORI_PRAGA_backup.json` (incluye las fotos).
3. Abre la **app TORI.exe** (arranca vacía).
4. Dentro de la app, usa **Restaurar backup** y elige ese `TORI_PRAGA_backup.json`.
5. Listo: toda tu información queda dentro de la app. Verifica que estén tus
   facturas, macro, fotos y bases de China.

> Consejo: guarda ese `TORI_PRAGA_backup.json` en un lugar seguro (USB) como
> respaldo de arranque.

## Dónde se guardan los datos y los respaldos

- **Bóveda principal** (permanente, del PC):
  `C:\Users\<tu usuario>\AppData\Roaming\TORI\`
  No hay que tocarla; es la que sobrevive a limpiar Chrome.

- **Respaldo automático extra** (copia visible, por si acaso):
  `C:\Users\<tu usuario>\Documentos\Backups TORI\`
  La app deja aquí una copia cada 30 minutos y al cerrar, y conserva las últimas 5.
  Puedes copiar esta carpeta a un USB cuando quieras.

## Cómo hacer respaldos tú mismo (recomendado)

Aunque la app respalda sola, el respaldo más cómodo de restaurar sigue siendo el
**backup .json propio de TORI** (el botón dentro de la app). Hazlo de vez en cuando
y guárdalo en un USB o en tu nube. Es un solo archivo con TODO, fotos incluidas.

## Preguntas rápidas

**¿Se ve distinto a mi TORI?** No. Es el mismo TORI, motor Chromium, idéntico.

**¿Necesito internet?** No. La app funciona 100% offline (las librerías de Excel
van incluidas dentro).

**¿Puedo seguir usando el TORI de Chrome?** Sí, pero ojo: son bóvedas separadas. Lo
recomendable es pasarte a la app y usar solo esa, para no tener datos en dos lados.
