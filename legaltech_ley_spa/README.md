# LegalTech — Ley (MVP) — Modo B (solo resúmenes + enlaces)

SPA **100% estática** lista para GitHub Pages.

Incluye:
- Biblioteca (árbol por secciones) con **texto_resumen** y **source_url**.
- Wizard de aplicabilidad (reglas configurables).
- Proyectos + checklist por etapas (LocalStorage).
- Exportación: expediente HTML imprimible (Guardar como PDF) + export/import JSON.

## Ejecutar local
### Opción 1 (recomendada): VS Code Live Server
- Abre la carpeta y ejecuta Live Server sobre `index.html`.

### Opción 2: Python
```bash
python -m http.server 8000
```
Luego abre `http://localhost:8000`.

## Publicar en GitHub Pages
Settings → Pages → Deploy from branch → main → /(root)

## Dataset (Modo B)
Edita:
- `data/law.sample.json` (estructura, texto_resumen, source_url)
- `data/rules.sample.json` (wizard, modalidades, etapas)

La app también permite pegar un override en **Config** (LocalStorage), sin tocar archivos.

## Nota
El dataset incluido es un **ejemplo** (no reemplaza la revisión normativa). Debes reemplazar los enlaces por fuentes oficiales.
