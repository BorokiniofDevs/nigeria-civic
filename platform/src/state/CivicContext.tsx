'use client';
// CivicContext — the single source of truth for geographic navigation state:
// view hierarchy, history (with camera restore), item detail, layer toggles,
// provenance drawer, search, and satellite mode. Drives mapController
// imperatively. National by construction: no state-specific branches.
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { mapController } from '@/lib/mapController';
import { aoiAround } from '@/lib/geo';
import { civicStore } from '@/lib/civic';
import {
  COUNTRY_ID, accentForState, jurisdictionIdForView,
} from '@/lib/civic/geoEntities';
import type { CivicEntity, SearchGroup } from '@/lib/civic/types';
import { getObservationWithFallback } from '@/lib/satellite/registry';
import type { AreaOfInterest, ImageryObservation, ProviderSkip } from '@/lib/satellite/types';
import { getProject } from '@/lib/civic/projectService';
import type { CameraState, DetailSel, ItemKind, Level, ViewState } from '@/lib/view';
import { COUNTRY_VIEW } from '@/lib/view';
import { reportService } from '@/lib/civic/reportService';
import {
  LOCATION_STATUS_LABEL, searchReports,
} from '@/lib/civic/reporting';

export interface SatelliteState {
  active: boolean;
  projectId: string | null;
  projectName: string | null;
  aoi: AreaOfInterest | null;
  observation: ImageryObservation | null;
  providerName: string | null;
  /** Every satellite rung tried before the serving one, and why it was skipped. */
  providerSkips: ProviderSkip[];
}

const SAT_OFF: SatelliteState = {
  active: false, projectId: null, projectName: null, aoi: null, observation: null, providerName: null,
  providerSkips: [],
};

interface CivicContextValue {
  view: ViewState;
  detail: DetailSel | null;
  satellite: SatelliteState;
  layers: Record<string, boolean>;
  drawerOpen: boolean;
  mapReady: boolean;
  accent: string;
  searchQuery: string;
  searchGroups: SearchGroup[];
  selectState(name: string): void;
  selectLGA(name: string): void;
  selectLCDA(id: string): void;
  selectWard(id: string): void;
  goToLevel(level: Level): void;
  goToEntity(entityId: string): void;
  showDetail(kind: ItemKind, id: string): void;
  closeDetail(): void;
  toggleLayer(key: string): void;
  setDrawerOpen(open: boolean): void;
  setSearchQuery(q: string): void;
  selectSearchResult(entityId: string): void;
  enterSatelliteView(projectId: string): Promise<void>;
  exitSatelliteView(): void;
  bindMap(container: HTMLDivElement): () => void;
  // Phase 3 — citizen reporting (minimal; Phase 2 navigation untouched).
  reportFlowOpen: boolean;
  moderatorOpen: boolean;
  reportsVersion: number;
  setReportFlowOpen(open: boolean): void;
  setModeratorOpen(open: boolean): void;
  bumpReports(): void;
  // Officials directory (federal tier first).
  officialsOpen: boolean;
  setOfficialsOpen(open: boolean): void;
  // Street view panel.
  streetViewOpen: boolean;
  setStreetViewOpen(open: boolean): void;
  // Projects panel (Lagos pilot).
  projectsOpen: boolean;
  setProjectsOpen(open: boolean): void;
  /** Deepest jurisdiction entity id for the current view (or null). */
  currentJurisdictionId(): string | null;
  startLocationPick(cb: (p: [number, number]) => void): void;
  stopLocationPick(): void;
  setPickMarker(p: [number, number] | null): void;
}

const CivicContext = createContext<CivicContextValue | null>(null);

export function useCivic(): CivicContextValue {
  const ctx = useContext(CivicContext);
  if (!ctx) throw new Error('useCivic must be used inside CivicProvider');
  return ctx;
}

export function accentForView(view: ViewState): string {
  return accentForState(view.level === 'country' ? null : view.state);
}

/** Build a navigation view for a jurisdiction entity (via its lineage). */
function viewForJurisdiction(e: CivicEntity): ViewState | null {
  const lineage = civicStore.lineageOf(e.id);
  const byKind = new Map(lineage.map((x) => [x.kind, x]));
  const state = byKind.get('state');
  const lga = byKind.get('lga');
  const lcda = byKind.get('lcda');
  const stateName = state ? stateGadmName(state) : null;
  switch (e.kind) {
    case 'country':
      return { ...COUNTRY_VIEW };
    case 'state':
      return { level: 'state', state: stateGadmName(e), lga: null, lcda: null, ward: null };
    case 'lga':
      return { level: 'lga', state: stateName, lga: e.name, lcda: null, ward: null };
    case 'lcda':
      return { level: 'lcda', state: stateName, lga: lga?.name ?? null, lcda: e.id, ward: null };
    case 'ward':
      return { level: 'ward', state: stateName, lga: lga?.name ?? null, lcda: lcda?.id ?? null, ward: e.id };
    default:
      return null;
  }
}

/** GADM state name from a state entity (display name may carry ' State'). */
function stateGadmName(e: CivicEntity): string {
  return e.name === 'Federal Capital Territory' ? e.name : e.name.replace(/ State$/, '');
}

export function CivicProvider({ children }: { children: React.ReactNode }) {
  const [view, setViewState] = useState<ViewState>(COUNTRY_VIEW);
  const [detail, setDetail] = useState<DetailSel | null>(null);
  const [satellite, setSatellite] = useState<SatelliteState>(SAT_OFF);
  const [layers, setLayers] = useState<Record<string, boolean>>({
    boundaries: true, facilities: true, projects: true, reports: true,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Phase 3 — citizen reporting UI state.
  const [reportFlowOpen, setReportFlowOpen] = useState(false);
  const [moderatorOpen, setModeratorOpen] = useState(false);
  const [reportsVersion, setReportsVersion] = useState(0);
  const bumpReports = useCallback(() => setReportsVersion((n) => n + 1), []);
  // Officials directory UI state.
  const [officialsOpen, setOfficialsOpen] = useState(false);
  // Street view panel UI state.
  const [streetViewOpen, setStreetViewOpen] = useState(false);
  // Projects panel UI state.
  const [projectsOpen, setProjectsOpen] = useState(false);

  const viewRef = useRef(view);
  const satelliteRef = useRef(satellite);
  const history = useRef<{ view: ViewState; camera: CameraState }[]>([]);

  // Keep imperative reads current without writing refs during render.
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { satelliteRef.current = satellite; }, [satellite]);

  const searchGroups = useMemo(() => {
    // Re-run when the report store changes (module-level service, not state).
    void reportsVersion;
    const groups = civicStore.search(searchQuery);
    // Phase 3: merge citizen reports into search — only when real reports
    // exist. Zero reports → no group, honest empty state.
    const reportGroup = searchReports(
      reportService.listReports(),
      (r) => {
        const lineage = r.geoEntityId
          ? civicStore.lineageOf(r.geoEntityId).map((e) => e.name).join(' › ')
          : '';
        return lineage || LOCATION_STATUS_LABEL[r.locationStatus];
      },
      searchQuery,
    );
    if (reportGroup) {
      groups.push({
        group: reportGroup.group,
        items: reportGroup.items.map((i) => ({
          entityId: `report:${i.reportId}`,
          name: i.title,
          kind: 'report' as const,
          context: `${i.category} · ${i.context}`,
        })),
      });
    }
    return groups;
  }, [searchQuery, reportsVersion]);

  /**
   * Sync citizen report markers for the visible jurisdiction subtree.
   * Only real submitted reports with a jurisdiction in the current subtree
   * render — never invented positions. Reports without a usable location
   * remain valid records with no map position.
   */
  const syncReportMarkers = useCallback(() => {
    if (!mapController.ready()) return;
    const v = viewRef.current;
    if (v.level === 'country' || v.level === 'state') {
      mapController.syncReportMarkers([]);
      return;
    }
    const jid = jurisdictionIdForView(v);
    const subtree = new Set<string>();
    if (jid) {
      const walk = (id: string) => {
        subtree.add(id);
        for (const c of civicStore.childrenOf(id)) walk(c.id);
      };
      walk(jid);
    }
    const items = reportService.listReports()
      .filter((r) => r.geom && r.geoEntityId && subtree.has(r.geoEntityId))
      .map((r) => ({
        id: r.id,
        title: r.title,
        position: [r.geom!.lng, r.geom!.lat] as [number, number],
      }));
    mapController.syncReportMarkers(items);
  }, []);

  // Re-sync report markers whenever the report store changes.
  useEffect(() => { syncReportMarkers(); }, [reportsVersion, syncReportMarkers]);

  const applyView = useCallback((v: ViewState) => {
    setDetail(null);
    setViewState(v);
    mapController.setView(v);
    mapController.setIdentity(accentForView(v));
    syncReportMarkers();
  }, [syncReportMarkers]);

  /** If satellite mode is on, the first interaction returns to the civic map. */
  const ensureCivic = useCallback((): boolean => {
    if (satelliteRef.current.active) {
      mapController.exitSatellite();
      setSatellite(SAT_OFF);
      return false;
    }
    return true;
  }, []);

  const navigate = useCallback((v: ViewState, move: () => void) => {
    if (!mapController.ready()) return;
    if (!ensureCivic()) return;
    history.current.push({ view: viewRef.current, camera: mapController.getCamera() });
    applyView(v);
    move();
  }, [applyView, ensureCivic]);

  /** Camera move for a view: real bounds where geometry exists, else the entity's labelled position. */
  const moveToView = useCallback((v: ViewState, duration = 1400) => {
    const jid = jurisdictionIdForView(v);
    const bounds = jid ? mapController.entityBounds(jid) : null;
    if (bounds) { mapController.fitBounds(bounds, duration); return; }
    const e = jid ? civicStore.getEntity(jid) : undefined;
    if (e?.position) mapController.flyTo(e.position, v.level === 'ward' ? 14 : 13, duration);
  }, []);

  const selectState = useCallback((name: string) => {
    const bounds = mapController.stateBounds(name);
    if (!bounds) return;
    navigate(
      { level: 'state', state: name, lga: null, lcda: null, ward: null },
      () => mapController.fitBounds(bounds),
    );
  }, [navigate]);

  const selectLGA = useCallback((name: string) => {
    const state = viewRef.current.state;
    if (!state) return;
    const bounds = mapController.lgaBounds(state, name);
    if (!bounds) return;
    navigate(
      { level: 'lga', state, lga: name, lcda: null, ward: null },
      () => mapController.fitBounds(bounds),
    );
  }, [navigate]);

  const selectLCDA = useCallback((id: string) => {
    const e = civicStore.getEntity(id);
    if (!e || e.kind !== 'lcda') return;
    const v = viewRef.current;
    navigate(
      { level: 'lcda', state: v.state, lga: v.lga, lcda: id, ward: null },
      () => { if (e.position) mapController.flyTo(e.position, 13); },
    );
  }, [navigate]);

  const selectWard = useCallback((id: string) => {
    const e = civicStore.getEntity(id);
    if (!e || e.kind !== 'ward') return;
    const v = viewRef.current;
    navigate(
      { level: 'ward', state: v.state, lga: v.lga, lcda: v.lcda, ward: id },
      () => { if (e.position) mapController.flyTo(e.position, 14); },
    );
  }, [navigate]);

  const goToEntity = useCallback((entityId: string) => {
    const e = civicStore.getEntity(entityId);
    if (!e) return;
    const v = viewForJurisdiction(e);
    if (!v) return;
    navigate(v, () => moveToView(v));
  }, [navigate, moveToView]);

  const goToLevel = useCallback((level: Level) => {
    if (!mapController.ready()) return;
    if (!ensureCivic()) return;
    let target: { view: ViewState; camera: CameraState } | null = null;
    while (history.current.length) {
      const h = history.current.pop()!;
      if (h.view.level === level) { target = h; break; }
    }
    if (target) {
      applyView(target.view);
      mapController.restoreCamera(target.camera);
      return;
    }
    history.current = [];
    const v = { ...viewRef.current };
    if (level === 'country') { applyView(COUNTRY_VIEW); mapController.fitNigeria(); return; }
    if (level === 'state') { v.lga = null; v.lcda = null; v.ward = null; }
    if (level === 'lga') { v.lcda = null; v.ward = null; }
    if (level === 'lcda') { v.ward = null; }
    v.level = level;
    applyView(v);
    moveToView(v, 900);
  }, [applyView, ensureCivic, moveToView]);

  const showDetail = useCallback((kind: ItemKind, id: string) => {
    if (!ensureCivic()) return;
    setDetail({ kind, id });
  }, [ensureCivic]);

  const closeDetail = useCallback(() => setDetail(null), []);

  // ---------------- Phase 3: citizen reporting helpers ----------------
  /** Deepest jurisdiction entity id for the current view — used to anchor a
   *  report's geoEntityId. Null when the view has no resolvable jurisdiction. */
  const currentJurisdictionId = useCallback((): string | null => {
    const v = viewRef.current;
    if (v.ward) return v.ward;
    if (v.lcda) return v.lcda;
    if (v.state) {
      const st = civicStore.states().find(
        (s) => s.name.toLowerCase() === v.state!.toLowerCase(),
      );
      if (!st) return null;
      if (v.lga) {
        const lgaEnt = civicStore.childrenOf(st.id).find(
          (c) => c.name.toLowerCase() === v.lga!.toLowerCase(),
        );
        return lgaEnt ? lgaEnt.id : st.id;
      }
      return st.id;
    }
    return null;
  }, []);

  const startLocationPick = useCallback((cb: (p: [number, number]) => void) => {
    mapController.setPickMode(cb);
  }, []);
  const stopLocationPick = useCallback(() => mapController.setPickMode(null), []);
  const setPickMarker = useCallback((p: [number, number] | null) => {
    mapController.setPickMarker(p);
  }, []);

  const selectSearchResult = useCallback((entityId: string) => {
    // Phase 3: citizen report result — travel to its jurisdiction (if any),
    // then open the report detail. Never invents a position.
    if (entityId.startsWith('report:')) {
      const reportId = entityId.slice('report:'.length);
      const bundle = reportService.getReport(reportId);
      if (!bundle) return;
      setSearchQuery('');
      const gid = bundle.report.geoEntityId;
      if (gid) {
        const e = civicStore.getEntity(gid);
        if (e) {
          const v = viewForJurisdiction(e);
          if (v) navigate(v, () => moveToView(v));
        }
      }
      showDetail('report', reportId);
      return;
    }
    const e = civicStore.getEntity(entityId);
    if (!e) return;
    setSearchQuery('');
    const isJurisdiction = ['country', 'state', 'lga', 'lcda', 'ward', 'community', 'street', 'senatorial_district'].includes(e.kind);
    if (isJurisdiction) { goToEntity(entityId); return; }
    // Record: travel to its jurisdiction for geographic context, then open detail.
    const lineage = civicStore.lineageOf(entityId);
    const jurisdiction = [...lineage].reverse().find((x) =>
      ['ward', 'lcda', 'lga', 'state', 'country'].includes(x.kind));
    if (jurisdiction && jurisdiction.id !== COUNTRY_ID) {
      const v = viewForJurisdiction(jurisdiction);
      if (v) navigate(v, () => moveToView(v));
    }
    showDetail(e.kind, e.id);
  }, [goToEntity, navigate, moveToView, showDetail]);

  const toggleLayer = useCallback((key: string) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      mapController.setLayersOn(next);
      return next;
    });
  }, []);

  const enterSatelliteView = useCallback(async (projectId: string) => {
    if (!mapController.ready()) return;
    // Civic projects resolve first (approximate corridor locations); geo
    // entities remain supported for the pre-existing callers.
    let name: string;
    let position: [number, number];
    let aoiLabel = 'Area of interest';
    const proj = getProject(projectId);
    if (proj) {
      name = proj.name;
      position = [proj.lng, proj.lat];
      aoiLabel = 'Area of interest (approximate project location)';
    } else {
      const e = civicStore.getEntity(projectId);
      if (!e?.position) return;
      name = e.name;
      position = e.position;
    }
    const aoi: AreaOfInterest = {
      id: `aoi-${projectId}`,
      name,
      polygon: aoiAround(position),
      label: aoiLabel,
    };
    // Multi-provider ladder with graceful fallback: the freshest available
    // satellite source serves the area; every skipped rung is disclosed.
    const fb = await getObservationWithFallback(aoi);
    setSatellite({
      active: true, projectId, projectName: name,
      aoi, observation: fb.observation, providerName: fb.providerName,
      providerSkips: fb.skipped,
    });
    mapController.enterSatellite(aoi, fb.observation);
  }, []);

  const exitSatelliteView = useCallback(() => {
    mapController.exitSatellite();
    setSatellite(SAT_OFF);
  }, []);

  const bindMap = useCallback((container: HTMLDivElement) => {
    mapController.init(container, {
      onStateClick: (name) => selectState(name),
      onLgaClick: (name) => selectLGA(name),
      onItemClick: (kind, id) => showDetail(kind, id),
    });
    mapController.setIdentity(accentForView(viewRef.current));
    setMapReady(true);
    return () => { mapController.destroy(); setMapReady(false); };
  }, [selectState, selectLGA, showDetail]);

  const value = useMemo<CivicContextValue>(() => ({
    view, detail, satellite, layers, drawerOpen, mapReady,
    accent: accentForView(view),
    searchQuery, searchGroups,
    selectState, selectLGA, selectLCDA, selectWard, goToLevel, goToEntity,
    showDetail, closeDetail, toggleLayer, setDrawerOpen,
    setSearchQuery, selectSearchResult,
    enterSatelliteView, exitSatelliteView, bindMap,
    reportFlowOpen, moderatorOpen, reportsVersion,
    setReportFlowOpen, setModeratorOpen, bumpReports,
    officialsOpen, setOfficialsOpen,
    streetViewOpen, setStreetViewOpen,
    projectsOpen, setProjectsOpen,
    currentJurisdictionId, startLocationPick, stopLocationPick, setPickMarker,
  }), [
    view, detail, satellite, layers, drawerOpen, mapReady,
    searchQuery, searchGroups,
    selectState, selectLGA, selectLCDA, selectWard, goToLevel, goToEntity,
    showDetail, closeDetail, toggleLayer,
    setSearchQuery, selectSearchResult,
    enterSatelliteView, exitSatelliteView, bindMap,
    reportFlowOpen, moderatorOpen, reportsVersion,
    setReportFlowOpen, setModeratorOpen, bumpReports,
    officialsOpen, setOfficialsOpen,
    streetViewOpen, setStreetViewOpen,
    projectsOpen, setProjectsOpen,
    currentJurisdictionId, startLocationPick, stopLocationPick, setPickMarker,
  ]);

  return <CivicContext.Provider value={value}>{children}</CivicContext.Provider>;
}
