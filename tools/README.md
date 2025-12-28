# Herramientas de actualización (opcional)

## ¿Para qué sirven?
La app (en `/docs`) incluye un dataset **curado** (`docs/data/manual.json`).  
Para cubrir **todo** lo que publica cada entidad en gob.pe, puedes generar un dataset adicional: `docs/data/catalog.json`.

Esto es útil porque:
- Los requisitos cambian (normativa, TUPA, bases, etc.).
- La lista completa de trámites/servicios por entidad es grande y dinámica.
- Mantenerlo “a mano” no escala.

## Requisitos en tu PC
1) Tener Python 3.10+ instalado.  
2) Instalar Playwright (navegador en modo automático):

```bash
pip install playwright
playwright install chromium
```

## Generar `catalog.json`
Desde la carpeta del proyecto (raíz del repo):

```bash
python tools/build_gobpe_catalog.py --entity vivienda
```

Para generar varias entidades (tardará más):

```bash
python tools/build_gobpe_catalog.py --all --limit-per-entity 40
```

Salida:
- `docs/data/catalog.json`

## Notas
- El script extrae **títulos, descripciones, enlaces y (cuando estén estructurados) requisitos** desde la página del trámite/servicio en gob.pe.
- Si gob.pe cambia su HTML o activa validaciones, puede requerir ajustes.
- Para GitHub Pages: lo normal es **generar `catalog.json` localmente** y luego subirlo al repo.
