# peru-requisitos-app (GitHub Pages)

App web **estática** (sin backend) para navegar requisitos de programas/proyectos/trámites del Estado Peruano.

## Estructura
- `/docs/` : la app lista para GitHub Pages
- `/docs/data/manual.json` : dataset curado (subconjunto con requisitos)
- `/docs/data/catalog.json` : (opcional) dataset generado automáticamente (ver `/tools`)
- `/tools/` : scripts opcionales para regenerar dataset

## Publicar en GitHub Pages (modo /docs)
1) Crea un repositorio en GitHub y sube todo este proyecto (incluyendo carpeta `/docs`).  
2) En GitHub: **Settings → Pages**  
3) Source: **Deploy from a branch**  
4) Branch: **main**  
5) Folder: **/docs**  
6) Guarda. Abre el enlace que GitHub Pages te muestra.

## Importante
- Si abres `docs/index.html` directamente como archivo local (file://), algunos navegadores bloquean `fetch(...)`.
  En GitHub Pages funciona correctamente (porque se sirve por HTTP/HTTPS).
- Para ampliar “a todo gob.pe” y mantenerlo actualizado, genera `docs/data/catalog.json` (ver `/tools/README.md`).
