// MapController — owns the MapLibre instance and all imperative map behaviour:
// layers, selection, markers, camera, identity accents, satellite mode.
// React (state/CivicContext.tsx) drives it; it never imports React.
//
// National by construction: LGA boundary geometry is loaded per state from a
// registry (lib/civic/geoEntities.ts). States without loaded LGA geometry show
// no LGA layer — the UI reports that honestly. No Lagos branches anywhere.
import { Map, Marker, NavigationControl, config as maplibreConfig } from 'maplibre-gl';
import type { StyleSpecification } from 'maplibre-gl';
import {
  STATES, NIGERIA_BOUNDS,
  boundsOfFeature, featureByName,
  type GeoFeature, type LngLat, type Bounds, type FeatureCollection,
} from './geo';
import { lgaGeometryFor, jurisdictionIdForView } from './civic/geoEntities';
import { civicStore } from './civic';
import type { EntityKind } from './civic/types';
import type { AreaOfInterest, ImageryObservation } from './satellite/types';
import type { CameraState, ViewState } from './view';
import { COUNTRY_VIEW } from './view';

export interface MapCallbacks {
  onStateClick(name: string): void;
  onLgaClick(name: string): void;
  onItemClick(kind: EntityKind, id: string): void;
}

/** Provider-neutral basemap. Swap this URL to change providers — no code changes. */
export const BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

interface ItemEntry {
  kind: EntityKind;
  id: string;
  coords: LngLat;
}

function aoiBounds(aoi: AreaOfInterest): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of aoi.polygon) {
    for (const [x, y] of ring) {
      if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y;
      if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
    }
  }
  return b;
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

class MapController {
  private map: Map | null = null;
  private cb: MapCallbacks | null = null;
  private markers: Marker[] = [];
  private markersByGroup: Record<string, Marker[]> = {};
  private itemIndex: Record<string, ItemEntry> = {};
  private layersOn: Record<string, boolean> = { boundaries: true, facilities: true, projects: true, reports: true };
  private lastView: ViewState | null = null;
  private accent = '#008751';
  private satellite = false;
  private civicCamera: CameraState | null = null;
  private hovered: { source: string; id: string | number } | null = null;
  private lgaState: string | null = null; // which state's LGA geometry is loaded
  // Phase 3: citizen location-pick mode. While set, map clicks report a
  // coordinate to the intake flow instead of driving jurisdiction navigation.
  private pickMode: ((lngLat: LngLat) => void) | null = null;
  private pickMarker: Marker | null = null;

  ready(): boolean { return this.map !== null; }
  isSatellite(): boolean { return this.satellite; }

  init(container: HTMLElement, cb: MapCallbacks): void {
    this.cb = cb;
    // Explicit worker URL, set before the first `new Map()`.
    //
    // Next.js 16 / Turbopack miscompiles MapLibre's internal dynamic
    // `new URL(`./${name}`, import.meta.url)` worker resolution: the compiled
    // code drops the worker filename, the browser requests /[object Object],
    // Next.js answers with its HTML 404 page, and the module worker fails
    // strict MIME checking — so the map never initializes. This official
    // `config.WORKER_URL` override bypasses the broken computation entirely.
    //
    // The worker files are copied from the pinned maplibre-gl package into
    // public/workers/ by scripts/copy-maplibre-workers.mjs (postinstall).
    // Each worker is served alongside the sibling shared module it relatively
    // imports. Served locally from the pinned package — never a CDN.
    maplibreConfig.WORKER_URL = process.env.NODE_ENV === 'development'
      ? '/workers/maplibre-gl-worker-dev.mjs'
      : '/workers/maplibre-gl-worker.mjs';
    const map = new Map({
      container,
      style: BASEMAP_STYLE,
      center: [8.6, 9.3],
      zoom: 5,
      minZoom: 4.5,
      maxZoom: 16,
      attributionControl: { compact: true },
    });
    this.map = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    map.on('load', () => {
      this.addCivicLayers();
      map.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration: 0 });
      this.applyView(this.lastView ?? COUNTRY_VIEW);
    });
  }

  destroy(): void {
    this.clearMarkers();
    this.map?.remove();
    this.map = null;
    this.cb = null;
  }

  // ---------------- civic layers ----------------
  private setVis(id: string, visible: boolean): void {
    const map = this.map;
    if (map?.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
  }

  private setLgaData(stateName: string | null): void {
    const map = this.map;
    const src = map?.getSource('lgas-src') as unknown as { setData(d: unknown): void } | undefined;
    if (!src) return;
    if (stateName && lgaGeometryFor(stateName)) {
      src.setData(lgaGeometryFor(stateName) as unknown as GeoJSON.FeatureCollection);
      this.lgaState = stateName;
    } else {
      src.setData(EMPTY_FC as unknown as GeoJSON.FeatureCollection);
      this.lgaState = null;
    }
  }

  private addCivicLayers(): void {
    const map = this.map; if (!map) return;

    map.addSource('states-src', { type: 'geojson', data: STATES as unknown as GeoJSON.FeatureCollection, promoteId: 'id' });
    map.addSource('lgas-src', { type: 'geojson', data: EMPTY_FC as unknown as GeoJSON.FeatureCollection, promoteId: 'id' });

    map.addLayer({
      id: 'states-fill', type: 'fill', source: 'states-src',
      paint: {
        'fill-color': '#0E7C6B',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.16, 0.05],
      },
    });
    map.addLayer({ id: 'states-line', type: 'line', source: 'states-src', paint: { 'line-color': '#8A8F98', 'line-width': 1 } });
    map.addLayer({
      id: 'states-label', type: 'symbol', source: 'states-src', minzoom: 4.5, maxzoom: 7.5,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#3A3F47', 'text-halo-color': '#F7F6F2', 'text-halo-width': 1 },
    });

    map.addLayer({
      id: 'lgas-fill', type: 'fill', source: 'lgas-src',
      paint: {
        'fill-color': '#0E7C6B',
        'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.18, 0.06],
      },
      layout: { visibility: 'none' },
    });
    map.addLayer({
      id: 'lgas-line', type: 'line', source: 'lgas-src',
      paint: { 'line-color': '#6B7280', 'line-width': 1 }, layout: { visibility: 'none' },
    });
    map.addLayer({
      id: 'lgas-label', type: 'symbol', source: 'lgas-src', minzoom: 7.5,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], visibility: 'none' },
      paint: { 'text-color': '#3A3F47', 'text-halo-color': '#F7F6F2', 'text-halo-width': 1 },
    });

    map.addLayer({
      id: 'sel-line', type: 'line', source: 'states-src',
      paint: { 'line-color': this.accent, 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''],
    });
    map.addLayer({
      id: 'sel-lga-line', type: 'line', source: 'lgas-src',
      paint: { 'line-color': this.accent, 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''], layout: { visibility: 'none' },
    });

    const hover = (layer: string, source: string) => {
      map.on('mousemove', layer, (e) => {
        const feat = e.features?.[0]; if (!feat) return;
        if (this.hovered) map.setFeatureState({ source: this.hovered.source, id: this.hovered.id }, { hover: false });
        const id = feat.id as string | number;
        this.hovered = { source, id };
        map.setFeatureState({ source, id }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, () => {
        if (this.hovered) map.setFeatureState({ source: this.hovered.source, id: this.hovered.id }, { hover: false });
        this.hovered = null;
        map.getCanvas().style.cursor = '';
      });
    };
    hover('states-fill', 'states-src');
    hover('lgas-fill', 'lgas-src');

    map.on('click', 'states-fill', (e) => {
      if (this.pickMode) return; // pick mode consumes clicks for intake
      if (this.lastView?.level === 'country' && e.features?.length) {
        this.cb?.onStateClick(e.features[0].properties.name as string);
      }
    });
    map.on('click', 'lgas-fill', (e) => {
      // LGA drill-down is available wherever LGA geometry is loaded.
      if (this.pickMode) return; // pick mode consumes clicks for intake
      if (this.lgaState && e.features?.length) {
        this.cb?.onLgaClick(e.features[0].properties.name as string);
      }
    });
    map.on('click', (e) => {
      if (this.pickMode) this.pickMode([e.lngLat.lng, e.lngLat.lat]);
    });
  }

  // ---------------- Phase 3: location pick mode + report markers ----------------
  /** Enable/disable citizen location picking. Null disables. */
  setPickMode(cb: ((lngLat: LngLat) => void) | null): void {
    this.pickMode = cb;
    const canvas = this.map?.getCanvas();
    if (canvas) canvas.style.cursor = cb ? 'crosshair' : '';
  }

  /** Show/clear the temporary picked-point marker (intake only). */
  setPickMarker(lngLat: LngLat | null): void {
    if (this.pickMarker) { this.pickMarker.remove(); this.pickMarker = null; }
    if (!lngLat || !this.map) return;
    const el = document.createElement('div');
    el.className = 'mk mk-pick';
    el.title = 'Picked location';
    this.pickMarker = new Marker({ element: el }).setLngLat(lngLat).addTo(this.map);
  }

  /**
   * Sync citizen report markers into the existing 'reports' layer group.
   * Only real submitted reports with a jurisdiction in the visible subtree
   * are passed in by the caller — never invented positions.
   */
  syncReportMarkers(items: { id: string; title: string; position: LngLat }[]): void {
    const map = this.map; if (!map) return;
    for (const m of this.markersByGroup['reports'] ?? []) m.remove();
    this.markers = this.markers.filter((m) => !(this.markersByGroup['reports'] ?? []).includes(m));
    this.markersByGroup['reports'] = [];
    for (const item of items) {
      this.addMarker(item.position, 'mk-rep', item.title, 'reports', () =>
        this.cb?.onItemClick('report', item.id),
      );
    }
    this.applyLayerToggles();
  }

  // ---------------- markers ----------------
  private clearMarkers(): void {
    this.markers.forEach((m) => m.remove());
    this.markers = [];
    this.markersByGroup = {};
    this.itemIndex = {};
    if (this.pickMarker) { this.pickMarker.remove(); this.pickMarker = null; }
  }

  private addMarker(lngLat: LngLat, cls: string, title: string, group: string, onClick?: () => void): void {
    const map = this.map; if (!map) return;
    const el = document.createElement('div');
    el.className = `mk ${cls}`;
    el.title = title;
    const marker = new Marker({ element: el }).setLngLat(lngLat).addTo(map);
    if (onClick) el.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    this.markers.push(marker);
    (this.markersByGroup[group] ??= []).push(marker);
  }

  /** Marker class: kind drives shape. Illustrative jurisdiction positions get the dashed treatment. */
  private markerClass(kind: EntityKind): { cls: string; group: string } {
    switch (kind) {
      case 'facility': return { cls: 'mk-fac', group: 'facilities' };
      case 'project': return { cls: 'mk-prj', group: 'projects' };
      case 'report': return { cls: 'mk-rep', group: 'reports' };
      default: return { cls: 'mk-jur', group: 'jurisdiction' };
    }
  }

  // ---------------- view sync ----------------
  setView(view: ViewState): void {
    this.lastView = view;
    if (this.map && !this.satellite) this.applyView(view);
  }

  private applyView(view: ViewState): void {
    const map = this.map; if (!map) return;
    this.clearMarkers();

    // LGA layer follows loaded geometry for the selected state — national, data-driven.
    const lgaFc = view.state ? lgaGeometryFor(view.state) : undefined;
    if ((view.state ?? null) !== this.lgaState) this.setLgaData(view.state ?? null);
    const showLgas = !!lgaFc && view.level !== 'country';

    this.setVis('lgas-fill', showLgas && this.layersOn.boundaries);
    this.setVis('lgas-line', showLgas && this.layersOn.boundaries);
    this.setVis('lgas-label', showLgas);
    this.setVis('states-fill', view.level === 'country');
    this.setVis('states-label', view.level === 'country');

    let selId = '', selLgaId = '';
    if (view.level !== 'country' && view.state) {
      const f = featureByName(STATES.features, view.state);
      if (f) selId = f.properties.id;
    }
    if ((view.level === 'lga' || view.level === 'lcda' || view.level === 'ward') && view.lga && lgaFc) {
      const g = featureByName(lgaFc.features, view.lga);
      if (g) selLgaId = g.properties.id;
    }
    map.setFilter('sel-line', ['==', ['get', 'id'], selId]);
    map.setFilter('sel-lga-line', ['==', ['get', 'id'], selLgaId]);
    this.setVis('sel-lga-line', !!selLgaId);

    // Markers: entities with positions under the current jurisdiction.
    // Rendered at LGA level and below only — the country/state views stay clean.
    const jurisdictionId = jurisdictionIdForView(view);
    if (jurisdictionId && (view.level === 'lga' || view.level === 'lcda' || view.level === 'ward')) {
      const onItem = (kind: EntityKind, id: string) => () => this.cb?.onItemClick(kind, id);
      const place = (entityId: string) => {
        const e = civicStore.getEntity(entityId);
        if (!e?.position) return;
        const { cls, group } = this.markerClass(e.kind);
        this.itemIndex[e.id] = { kind: e.kind, id: e.id, coords: e.position };
        this.addMarker(e.position, cls, e.name, group, onItem(e.kind, e.id));
      };
      const walk = (id: string) => {
        for (const c of civicStore.childrenOf(id)) {
          if (c.position) place(c.id);
          walk(c.id);
        }
      };
      walk(jurisdictionId);
      this.applyLayerToggles();
    }
  }

  getItem(id: string): ItemEntry | undefined {
    return this.itemIndex[id];
  }

  // ---------------- camera ----------------
  getCamera(): CameraState {
    const map = this.map!;
    const c = map.getCenter();
    return { center: [c.lng, c.lat], zoom: map.getZoom() };
  }
  fitBounds(bounds: Bounds, duration = 1400): void {
    this.map?.fitBounds(bounds, { padding: 60, duration });
  }
  fitNigeria(duration = 900): void {
    this.map?.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration });
  }
  flyTo(center: LngLat, zoom: number, duration = 1400): void {
    this.map?.flyTo({ center, zoom, duration });
  }
  restoreCamera(cam: CameraState): void {
    this.map?.easeTo({ center: cam.center, zoom: cam.zoom, duration: 900 });
  }
  stateBounds(name: string): Bounds | null {
    const f = featureByName(STATES.features, name);
    return f ? boundsOfFeature(f) : null;
  }
  lgaBounds(stateName: string, lgaName: string): Bounds | null {
    const fc = lgaGeometryFor(stateName);
    const f = fc ? featureByName(fc.features, lgaName) : undefined;
    return f ? boundsOfFeature(f) : null;
  }
  /** Bounds for any jurisdiction entity with loaded geometry. */
  entityBounds(entityId: string): Bounds | null {
    const e = civicStore.getEntity(entityId);
    if (!e?.geometryRef) return null;
    const fc: FeatureCollection | undefined =
      e.geometryRef.collection === 'states' ? STATES : lgaGeometryFor(this.lgaState ?? '');
    const f = fc?.features.find((x: GeoFeature) => x.properties.id === e.geometryRef!.featureId);
    return f ? boundsOfFeature(f) : null;
  }
  hasLgaGeometry(stateName: string): boolean {
    return !!lgaGeometryFor(stateName);
  }

  // ---------------- identity & layers ----------------
  setIdentity(accent: string): void {
    this.accent = accent;
    const map = this.map; if (!map) return;
    if (map.getLayer('sel-line')) map.setPaintProperty('sel-line', 'line-color', accent);
    if (map.getLayer('sel-lga-line')) map.setPaintProperty('sel-lga-line', 'line-color', accent);
  }

  setLayersOn(layers: Record<string, boolean>): void {
    this.layersOn = layers;
    if (!this.satellite) this.applyLayerToggles();
  }

  private applyLayerToggles(): void {
    for (const group of Object.keys(this.markersByGroup)) {
      // Jurisdiction illustrative markers always render; kind groups toggle.
      const on = group === 'jurisdiction'
        ? true
        : this.layersOn[group] !== false;
      for (const m of this.markersByGroup[group]) {
        m.getElement().style.display = on ? '' : 'none';
      }
    }
    const v = this.lastView;
    const showLgas = !!v && v.level !== 'country' && !!v.state && this.hasLgaGeometry(v.state);
    this.setVis('lgas-fill', showLgas && this.layersOn.boundaries);
    this.setVis('lgas-line', showLgas && this.layersOn.boundaries);
    this.setVis('states-line', this.layersOn.boundaries);
  }

  // ---------------- satellite mode (existing stub — untouched by Phase 2) ----------------
  enterSatellite(aoi: AreaOfInterest, observation: ImageryObservation | null): void {
    const map = this.map; if (!map) return;
    this.satellite = true;
    this.civicCamera = this.getCamera();
    this.clearMarkers();

    map.setStyle({
      version: 8,
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b0d10' } }],
    } as unknown as StyleSpecification);

    map.once('styledata', () => {
      const m = this.map; if (!m) return;
      if (observation?.tileTemplate) {
        m.addSource('sat-src', {
          type: 'raster',
          tiles: [observation.tileTemplate],
          tileSize: 256,
          maxzoom: 19,
          attribution: observation.attribution,
        });
        m.addLayer({ id: 'sat-lyr', type: 'raster', source: 'sat-src' });
      }
      m.addSource('aoi-src', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: aoi.polygon },
        } as unknown as GeoJSON.Feature,
      });
      m.addLayer({
        id: 'aoi-line', type: 'line', source: 'aoi-src',
        paint: { 'line-color': '#FFD400', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      const b = aoiBounds(aoi);
      m.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 80, duration: 1600 });
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      const el = document.createElement('div');
      el.className = 'mk mk-site';
      el.title = aoi.name;
      const marker = new Marker({ element: el }).setLngLat([cx, cy]).addTo(m);
      this.markers.push(marker);
    });
  }

  exitSatellite(): void {
    const map = this.map; if (!map) return;
    this.satellite = false;
    map.setStyle(BASEMAP_STYLE);
    map.once('styledata', () => {
      this.addCivicLayers();
      if (this.lastView) this.applyView(this.lastView);
      if (this.civicCamera) this.restoreCamera(this.civicCamera);
    });
  }
}

export const mapController = new MapController();
