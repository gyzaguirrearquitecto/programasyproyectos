#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""build_gobpe_catalog.py

Genera docs/data/catalog.json a partir de gob.pe usando Playwright (renderizado).
Este script es opcional y se ejecuta localmente (NO en GitHub Pages).

Ejemplos:
  python tools/build_gobpe_catalog.py --entity vivienda
  python tools/build_gobpe_catalog.py --all --limit-per-entity 40
"""

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeoutError


def load_entities(manual_path: Path):
    data = json.loads(manual_path.read_text(encoding="utf-8"))
    entities = []
    for m in data.get("ministerios", []):
        slug = m.get("slug_gobpe")
        url = m.get("url_tramites_servicios")
        name = m.get("nombre")
        if slug and url and name:
            entities.append({"slug": slug, "url": url, "name": name})
    return entities


def normalize_space(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()


def extract_requirements(page) -> list[str]:
    """Busca un bloque 'Requisitos' y extrae list items."""
    # Heurística: buscar encabezados que contengan "Requisitos"
    headings = page.locator("h1, h2, h3, h4, h5")
    count = headings.count()
    for i in range(min(count, 60)):
        txt = normalize_space(headings.nth(i).inner_text(timeout=2000))
        if not txt:
            continue
        if "requisitos" in txt.lower():
            # Tomar el siguiente listado (ul/ol) que aparezca luego del heading
            h = headings.nth(i)
            # XPath: buscar el primer ul/ol siguiente en el DOM
            ul = h.locator("xpath=following::*[self::ul or self::ol][1]")
            if ul.count() > 0:
                items = ul.locator("li")
                out = []
                for j in range(min(items.count(), 50)):
                    out.append(normalize_space(items.nth(j).inner_text(timeout=2000)))
                out = [x for x in out if x]
                if out:
                    return out
    return []


def scrape_entity(playwright, entity: dict, limit_per_entity: int) -> list[dict]:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
    )
    page = context.new_page()

    programs = []
    try:
        page.goto(entity["url"], wait_until="networkidle", timeout=60000)
    except PWTimeoutError:
        page.goto(entity["url"], wait_until="load", timeout=60000)

    # En gob.pe, los cards suelen tener enlaces "Ir al servicio" o el título como <a>
    links = page.locator("a")
    seen = set()
    max_links = min(links.count(), 400)

    candidates = []
    for i in range(max_links):
        href = links.nth(i).get_attribute("href")
        if not href:
            continue
        href = href.strip()
        if not href.startswith("http"):
            if href.startswith("/"):
                href = "https://www.gob.pe" + href
            else:
                continue
        # Filtrar a páginas de servicio (heurística: gob.pe/<número>-*)
        if re.search(r"https://www\.gob\.pe/\d+-", href):
            if href in seen:
                continue
            seen.add(href)
            title = normalize_space(links.nth(i).inner_text() or "")
            candidates.append({"url": href, "title": title})

    # Si el título no se resolvió (p. ej., el link es "Ir al servicio"), intentaremos extraerlo en la página destino.
    candidates = candidates[:limit_per_entity]

    for c in candidates:
        try:
            page.goto(c["url"], wait_until="networkidle", timeout=60000)
        except PWTimeoutError:
            page.goto(c["url"], wait_until="load", timeout=60000)

        title = c["title"]
        if not title or title.lower() in {"ir al servicio", "ver más", "leer más"}:
            h1 = page.locator("h1")
            if h1.count() > 0:
                title = normalize_space(h1.first.inner_text(timeout=3000))

        # Descripción: primer párrafo relevante
        desc = ""
        p = page.locator("main p")
        if p.count() > 0:
            desc = normalize_space(p.first.inner_text(timeout=3000))

        reqs = extract_requirements(page)

        programs.append({
            "title": title or "(sin título)",
            "description": desc,
            "requirements": reqs,
            "source_url": c["url"],
        })

    context.close()
    browser.close()
    return programs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entity", help="Slug gob.pe (ej: vivienda, minedu, minsa)")
    ap.add_argument("--all", action="store_true", help="Procesar todas las entidades del manual")
    ap.add_argument("--limit-per-entity", type=int, default=30, help="Máximo de ítems por entidad (para acotar tiempo)")
    args = ap.parse_args()

    root = Path(__file__).resolve().parents[1]
    manual_path = root / "docs" / "data" / "manual.json"
    out_path = root / "docs" / "data" / "catalog.json"

    entities = load_entities(manual_path)

    if args.entity:
        entities = [e for e in entities if e["slug"] == args.entity]
        if not entities:
            raise SystemExit(f"No se encontró entidad con slug '{args.entity}' en {manual_path}")
    elif not args.all:
        raise SystemExit("Debes usar --entity <slug> o --all")

    result = {
        "meta": {
            "generated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "source": "gob.pe",
            "note": "Dataset generado automáticamente. Verifica requisitos en la fuente oficial.",
        },
        "entities": {}
    }

    with sync_playwright() as p:
        for e in entities:
            print(f"[+] Scraping {e['slug']} - {e['name']} ...")
            programs = scrape_entity(p, e, limit_per_entity=args.limit_per_entity)
            result["entities"][e["slug"]] = programs
            print(f"    -> {len(programs)} items")

    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nOK: {out_path}")


if __name__ == "__main__":
    main()
