#!/usr/bin/env python3
"""Build the single-file Lagos map prototype.

Inlines styles.css, the GeoJSON boundaries, fixtures.js and app.js into
index.html, producing dist/lagos-map-prototype.html — one file that runs
anywhere (CDN access needed for MapLibre, fonts and basemap tiles).
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

def read(p):
    with open(os.path.join(ROOT, p), encoding='utf-8') as f:
        return f.read()

def main():
    html = read('index.html')

    css = read('styles.css')
    geo = ('window.GEO = {\n  states: ' + read('data/nigeria-states.geojson') +
           ',\n  lagosLgas: ' + read('data/lagos-lgas.geojson') + '\n};')
    fixtures = read('data/fixtures.js')
    app = read('app.js')

    for needle, content in [
        ('/*INLINE:styles.css*/', css),
        ('/*INLINE:geo*/', geo),
        ('/*INLINE:data/fixtures.js*/', fixtures),
        ('/*INLINE:app.js*/', app),
    ]:
        if needle not in html:
            sys.exit('placeholder missing: ' + needle)
        html = html.replace(needle, content, 1)

    # sanity: no placeholders remain
    leftover = re.findall(r'/\*INLINE:[^*]+\*/', html)
    if leftover:
        sys.exit('unreplaced placeholders: %s' % leftover)

    outdir = os.path.join(ROOT, 'dist')
    os.makedirs(outdir, exist_ok=True)
    out = os.path.join(outdir, 'lagos-map-prototype.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    size_kb = os.path.getsize(out) // 1024
    print('built %s (%d KB)' % (out, size_kb))

if __name__ == '__main__':
    main()
