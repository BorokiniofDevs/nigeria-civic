/* ============================================================================
   Lagos Map Prototype — application logic.
   MapLibre GL JS. Real boundaries (GADM v4.1, inlined by build.py);
   civic content from data/fixtures.js (labelled SAMPLE).
   The data layer is behind a provider-shaped seam (see DATA_CONTRACT.md):
   every panel/marker reads through FX.* so a PostGIS backend can replace
   fixtures 1:1 without touching this file's interaction logic.
   ============================================================================ */
(function () {
  'use strict';

  var GEO = window.GEO;
  var FX = window.FIXTURES;

  /* ---------------- utils ---------------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function bboxOf(feature) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    (function pt(c) {
      if (typeof c[0] === 'number') {
        if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1];
        if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1];
      } else { for (var i = 0; i < c.length; i++) pt(c[i]); }
    })(feature.geometry.coordinates);
    return b;
  }
  function placeIn(bbox, salt, i) {
    var r = FX.rng(salt + ':' + i), pad = 0.14;
    return [
      bbox[0] + (bbox[2] - bbox[0]) * (pad + r() * (1 - 2 * pad)),
      bbox[1] + (bbox[3] - bbox[1]) * (pad + r() * (1 - 2 * pad))
    ];
  }
  function featureByName(features, name) {
    for (var i = 0; i < features.length; i++) if (features[i].properties.name === name) return features[i];
    return null;
  }
  function tag(t) { return '<span class="tag">' + esc(t) + '</span>'; }
  function statusChip(s) {
    var label = FX.STATUS_LABEL[s] || s;
    return '<span class="st st-' + esc(s) + '">' + esc(label) + '</span>';
  }

  /* ---------------- view state + history ---------------- */
  var view = { level: 'country', state: null, lga: null, lcda: null };
  var history = []; // [{view, camera}]
  var detailCtx = null; // {kind, id} when panel shows an item detail

  function cam() { var c = map.getCenter(); return { center: [c.lng, c.lat], zoom: map.getZoom() }; }
  function restoreCamera(c) { map.easeTo({ center: c.center, zoom: c.zoom, duration: 900 }); }

  function render() {
    detailCtx = null;
    renderBreadcrumb();
    renderPanel();
    updateMapForView();
    $('#panel').scrollTop = 0;
  }
  function navigate(newView, moveFn) {
    history.push({ view: JSON.parse(JSON.stringify(view)), camera: cam() });
    view = newView;
    render();
    if (moveFn) moveFn();
  }
  function goToLevel(level) {
    var target = null;
    while (history.length) {
      var h = history.pop();
      if (h.view.level === level) { target = h; break; }
    }
    if (target) { view = target.view; render(); restoreCamera(target.camera); }
    else {
      history = [];
      if (level === 'country') view = { level: 'country', state: null, lga: null, lcda: null };
      else if (level === 'state') view = { level: 'state', state: view.state, lga: null, lcda: null };
      else if (level === 'lga') view = { level: 'lga', state: view.state, lga: view.lga, lcda: null };
      render();
      fitViewBounds();
    }
  }

  /* ---------------- map ---------------- */
  var map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [8.6, 9.3], zoom: 5, minZoom: 4.5, maxZoom: 16,
    attributionControl: { compact: true }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  var NIGERIA_BOUNDS = [[2.6, 4.1], [14.8, 14.0]];
  var markers = [];
  var markersByGroup = { facilities: [], projects: [], reports: [], lcda: [] };
  var itemIndex = {}; // id -> {kind, data, coords}

  function clearMarkers() {
    markers.forEach(function (m) { m.remove(); });
    markers = [];
    markersByGroup = { facilities: [], projects: [], reports: [], lcda: [] };
    itemIndex = {};
  }
  function addMarker(lngLat, cls, title, group, onClick) {
    var d = document.createElement('div');
    d.className = 'mk ' + cls; d.title = title;
    var m = new maplibregl.Marker({ element: d }).setLngLat(lngLat).addTo(map);
    d.addEventListener('click', function (e) { e.stopPropagation(); onClick(d); });
    markers.push(m); markersByGroup[group].push(m);
    return m;
  }

  map.on('load', function () {
    map.addSource('states-src', { type: 'geojson', data: GEO.states, promoteId: 'id' });
    map.addSource('lgas-src', { type: 'geojson', data: GEO.lagosLgas, promoteId: 'id' });

    map.addLayer({ id: 'states-fill', type: 'fill', source: 'states-src',
      paint: { 'fill-color': '#0E7C6B', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.16, 0.05] } });
    map.addLayer({ id: 'states-line', type: 'line', source: 'states-src',
      paint: { 'line-color': '#8A8F98', 'line-width': 1 } });
    map.addLayer({ id: 'states-label', type: 'symbol', source: 'states-src',
      minzoom: 4.5, maxzoom: 7.5,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#3A3F47', 'text-halo-color': '#F7F6F2', 'text-halo-width': 1 } });

    map.addLayer({ id: 'lgas-fill', type: 'fill', source: 'lgas-src',
      paint: { 'fill-color': '#0E7C6B', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.18, 0.06] },
      layout: { visibility: 'none' } });
    map.addLayer({ id: 'lgas-line', type: 'line', source: 'lgas-src',
      paint: { 'line-color': '#6B7280', 'line-width': 1 },
      layout: { visibility: 'none' } });
    map.addLayer({ id: 'lgas-label', type: 'symbol', source: 'lgas-src',
      minzoom: 7.5,
      layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-font': ['Noto Sans Regular'], visibility: 'none' },
      paint: { 'text-color': '#3A3F47', 'text-halo-color': '#F7F6F2', 'text-halo-width': 1 } });

    map.addLayer({ id: 'sel-line', type: 'line', source: 'states-src',
      paint: { 'line-color': '#008751', 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''] });
    map.addLayer({ id: 'sel-lga-line', type: 'line', source: 'lgas-src',
      paint: { 'line-color': '#008751', 'line-width': 2.5 },
      filter: ['==', ['get', 'id'], ''], layout: { visibility: 'none' } });

    // hover
    var hovered = null;
    function hover(layer, source) {
      map.on('mousemove', layer, function (e) {
        if (!e.features.length) return;
        if (hovered) map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
        hovered = { source: source, id: e.features[0].id };
        map.setFeatureState({ source: source, id: e.features[0].id }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layer, function () {
        if (hovered) map.setFeatureState({ source: hovered.source, id: hovered.id }, { hover: false });
        hovered = null; map.getCanvas().style.cursor = '';
      });
    }
    hover('states-fill', 'states-src');
    hover('lgas-fill', 'lgas-src');

    map.on('click', 'states-fill', function (e) {
      if (view.level === 'country' && e.features.length) selectState(e.features[0].properties.name);
    });
    map.on('click', 'lgas-fill', function (e) {
      if (view.level === 'state' && view.state === 'Lagos' && e.features.length) selectLGA(e.features[0].properties.name);
    });

    map.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration: 0 });
    render();
  });

  function setLayerVis(id, vis) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis ? 'visible' : 'none');
  }

  /* ---------------- identity ---------------- */
  function setIdentity(accent, label) {
    document.documentElement.style.setProperty('--accent', accent);
    if (map.getLayer('sel-line')) map.setPaintProperty('sel-line', 'line-color', accent);
    if (map.getLayer('sel-lga-line')) map.setPaintProperty('sel-lga-line', 'line-color', accent);
    $('#stateLabel').textContent = label;
  }

  /* ---------------- navigation ---------------- */
  function selectState(name) {
    var f = featureByName(GEO.states.features, name);
    if (!f) return;
    navigate({ level: 'state', state: name, lga: null, lcda: null }, function () {
      map.fitBounds(bboxOf(f), { padding: 60, duration: 1400 });
    });
    $('#stateSelect').value = (name === 'Lagos' || name === 'Kano' || name === 'Rivers') ? name : 'ng';
  }
  function selectLGA(name) {
    var f = featureByName(GEO.lagosLgas.features, name);
    if (!f) return;
    navigate({ level: 'lga', state: 'Lagos', lga: name, lcda: null }, function () {
      map.fitBounds(bboxOf(f), { padding: 60, duration: 1400 });
    });
  }
  function selectLCDA(lcda) {
    var pt = lcda._pt;
    navigate({ level: 'lcda', state: 'Lagos', lga: view.lga, lcda: lcda.id }, function () {
      map.flyTo({ center: pt, zoom: 13, duration: 1400 });
    });
  }
  function fitViewBounds() {
    if (view.level === 'country') map.fitBounds(NIGERIA_BOUNDS, { padding: 40, duration: 900 });
    else if (view.level === 'state') { var f = featureByName(GEO.states.features, view.state); if (f) map.fitBounds(bboxOf(f), { padding: 60, duration: 900 }); }
    else if (view.level === 'lga') { var g = featureByName(GEO.lagosLgas.features, view.lga); if (g) map.fitBounds(bboxOf(g), { padding: 60, duration: 900 }); }
  }

  /* ---------------- breadcrumb ---------------- */
  function renderBreadcrumb() {
    var crumbs = [{ level: 'country', label: 'Nigeria' }];
    if (view.state) crumbs.push({ level: 'state', label: view.state + (view.state === 'Federal Capital Territory' ? '' : ' State') });
    if (view.lga) crumbs.push({ level: 'lga', label: view.lga + ' LGA' });
    if (view.lcda) {
      var l = currentLCDA(); crumbs.push({ level: 'lcda', label: l ? l.name : view.lcda });
    }
    $('#crumbs').innerHTML = crumbs.map(function (c, i) {
      var last = i === crumbs.length - 1;
      return (i ? '<span class="sep">›</span>' : '') +
        (last ? '<span class="crumb current">' + esc(c.label) + '</span>'
              : '<button class="crumb" data-level="' + c.level + '">' + esc(c.label) + '</button>');
    }).join('');
  }
  $('#crumbs').addEventListener('click', function (e) {
    var b = e.target.closest('button.crumb'); if (b) goToLevel(b.dataset.level);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !detailCtx) {
      if (view.level === 'lcda') goToLevel('lga');
      else if (view.level === 'lga') goToLevel('state');
      else if (view.level === 'state') goToLevel('country');
    }
  });

  /* ---------------- panel ---------------- */
  function section(title, inner, sample) {
    return '<div class="sec"><div class="sec-h"><span>' + esc(title) + '</span>' +
      (sample === false ? '' : tag('SAMPLE')) + '</div><div class="sec-b">' + inner + '</div></div>';
  }
  function kv(rows) {
    return '<dl class="kv">' + rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('') + '</dl>';
  }
  function row(iid, inner) {
    return '<div class="row" data-iid="' + esc(iid) + '" tabindex="0" role="button">' + inner + '</div>';
  }

  function currentLCDA() {
    if (view.lga !== 'Kosofe' || !view.lcda) return null;
    var list = FX.KOSOFE.lcdas;
    for (var i = 0; i < list.length; i++) if (list[i].id === view.lcda) return list[i];
    return null;
  }

  function renderPanel() {
    var h = '';
    if (detailCtx) h = renderDetail();
    else if (view.level === 'country') h = renderCountry();
    else if (view.level === 'state') h = renderState();
    else if (view.level === 'lga') h = renderLGA();
    else if (view.level === 'lcda') h = renderLCDA();
    $('#panelBody').innerHTML = h;
  }

  function renderCountry() {
    setIdentity(FX.NIGERIA_ACCENT, 'Nigeria');
    var rows = GEO.states.features.map(function (f) {
      var n = f.properties.name;
      var idn = FX.stateIdentity(n);
      return '<tr data-state="' + esc(n) + '" tabindex="0">' +
        '<td class="t-main">' + esc(idn.name) + '</td>' +
        '<td>' + (idn.capital ? esc(idn.capital) : '—') + '</td>' +
        '<td class="t-num">' + (idn.lgaCount ? idn.lgaCount + ' <span class="src">GADM</span>' : '—') + '</td></tr>';
    }).join('');
    return '<div class="p-head"><h1>Nigeria</h1><p class="sub">Federal Republic of Nigeria — civic intelligence</p></div>' +
      section('Coverage', kv([
        ['Subnational entities', '36 states + Federal Capital Territory <span class="src">GADM v4.1</span>'],
        ['Pilot depth', 'Lagos State — 20 LGAs, drill-down enabled <span class="src">GADM v4.1</span>'],
        ['Civic content', 'Labelled sample fixtures — see Provenance']
      ]), false) +
      '<div class="sec"><div class="sec-h"><span>States &amp; FCT — select to explore</span></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>State</th><th>Capital</th><th>LGAs</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
  }

  function renderState() {
    var idn = FX.stateIdentity(view.state);
    setIdentity(idn.accent, idn.name);
    var h = '<div class="p-head"><div class="accent-bar"></div><h1>' + esc(idn.name) + '</h1>' +
      '<p class="sub">' + (idn.capital ? 'Capital: ' + esc(idn.capital) : 'Federal Capital Territory') + ' ' + tag('IDENTITY FIXTURE') + '</p></div>';

    if (!idn.fullFixture) {
      return h + section('Prototype coverage',
        '<p class="note">Boundary data is real. Civic fixtures in this build cover Lagos, Kano and Rivers. ' +
        'Production will load verified records for every state from the same architecture.</p>' +
        '<button class="btn" id="openLagos">Open Lagos pilot</button>', false);
    }

    var gov = section('Government', kv([
      ['Governor', esc(idn.governor) + ' ' + tag('SAMPLE')],
      ['Deputy Governor', esc(idn.deputy) + ' ' + tag('SAMPLE')],
      ['Assembly Speaker', esc(idn.speaker) + ' ' + tag('SAMPLE')],
      ['Local government areas', idn.lgaCount + ' <span class="src">GADM v4.1</span>']
    ]));

    if (view.state === 'Lagos') {
      var lgas = GEO.lagosLgas.features.map(function (f) {
        return '<tr data-lga="' + esc(f.properties.name) + '" tabindex="0"><td class="t-main">' +
          esc(f.properties.name) + '</td><td class="t-num">›</td></tr>';
      }).join('');
      var mdas = FX.LAGOS_MDAS.map(function (m) { return '<li>' + esc(m) + ' ' + tag('SAMPLE') + '</li>'; }).join('');
      h += gov +
        '<div class="sec"><div class="sec-h"><span>Local Government Areas (20)</span><span class="src">GADM v4.1</span></div>' +
        '<div class="tbl-wrap"><table class="tbl"><tbody>' + lgas + '</tbody></table></div></div>' +
        section('Key ministries & agencies', '<ul class="lst">' + mdas + '</ul>') +
        section('Lagos civic brief — 2026-09-24',
          '<ul class="lst">' + FX.KOSOFE.brief.items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>');
    } else {
      h += gov + section('Prototype coverage',
        '<p class="note">Full civic fixtures (LGAs, facilities, projects, reports) are modelled for Lagos in this build. ' +
        'Kano and Rivers demonstrate state-identity switching on the same architecture.</p>' +
        '<button class="btn" id="openLagos">Open Lagos pilot</button>', false);
    }
    return h;
  }

  function lgaItems(lgaName) {
    var bbox = bboxOf(featureByName(GEO.lagosLgas.features, lgaName));
    var fx = lgaName === 'Kosofe'
      ? { info: FX.KOSOFE, facilities: FX.KOSOFE.facilities, projects: FX.KOSOFE.projects, reports: FX.KOSOFE.reports }
      : { info: FX.lgaFixture(lgaName), facilities: FX.genericFacilities(lgaName, 3),
          projects: FX.genericProjects(lgaName, 2), reports: FX.genericReports(lgaName, 3) };
    fx.facilities.forEach(function (f, i) { f._pt = placeIn(bbox, 'fac:' + lgaName, i); });
    fx.projects.forEach(function (p, i) { p._pt = placeIn(bbox, 'prj:' + lgaName, i); });
    fx.reports.forEach(function (r, i) { r._pt = placeIn(bbox, 'rep:' + lgaName, i); });
    return fx;
  }

  function renderLGA() {
    var fx = lgaItems(view.lga), info = fx.info;
    var h = '<div class="p-head"><div class="accent-bar"></div><h1>' + esc(view.lga) + '</h1>' +
      '<p class="sub">Local Government Area — Lagos State</p></div>';

    h += section('Local government', kv([
      ['Chairman', esc(info.chairman) + ' ' + tag('SAMPLE')],
      ['Vice-Chairman', esc(info.viceChairman) + ' ' + tag('SAMPLE')],
      ['Councillors', info.councillors + ' ' + tag('SAMPLE')],
      ['Wards', info.wards + ' ' + tag('SAMPLE')]
    ]));

    if (view.lga === 'Kosofe') {
      var lcdas = FX.KOSOFE.lcdas.map(function (l, i) {
        var bbox = bboxOf(featureByName(GEO.lagosLgas.features, 'Kosofe'));
        l._pt = placeIn(bbox, 'lcda', i);
        return '<tr data-lcda="' + esc(l.id) + '" tabindex="0"><td class="t-main">' + esc(l.name) +
          '<div class="t-sub">' + esc(l.chairman) + '</div></td><td class="t-num">' + l.wards + ' wards</td><td class="t-num">›</td></tr>';
      }).join('');
      h += '<div class="sec"><div class="sec-h"><span>Local Council Development Areas</span>' + tag('SAMPLE') + '</div>' +
        '<div class="tbl-wrap"><table class="tbl"><tbody>' + lcdas + '</tbody></table></div>' +
        '<p class="note">LCDA positions are illustrative fixtures — official LCDA boundary data is pending.</p></div>';
    } else {
      h += section('Sub-LGA structure',
        '<p class="note">LCDA-level fixtures are modelled for Kosofe in this prototype. ' +
        'Select Kosofe to walk the full LGA → LCDA drill-down.</p>', false);
    }

    var fac = fx.facilities.map(function (f) {
      return row(f.id, '<div class="r-main">' + esc(f.name) + '</div><div class="r-sub">' +
        esc(f.typeLabel) + ' · ' + esc(f.status) + '</div>');
    }).join('');
    var prj = fx.projects.map(function (p) {
      return row(p.id, '<div class="r-main">' + esc(p.name) + '</div><div class="r-sub">' +
        esc(p.sector) + ' · ' + esc(p.status) + ' · Budgeted ' + esc(p.budgeted) + '</div>');
    }).join('');
    var rep = fx.reports.map(function (r) {
      return row(r.id, '<div class="r-main">' + esc(r.title) + '</div><div class="r-sub">' +
        esc(r.category) + ' · ' + statusChip(r.status) + '</div>');
    }).join('');

    h += section('Public facilities (' + fx.facilities.length + ')', '<div class="rows">' + fac + '</div>');
    h += section('Projects (' + fx.projects.length + ')', '<div class="rows">' + prj + '</div>');
    h += section('Civic reports (' + fx.reports.length + ')', '<div class="rows">' + rep + '</div>');
    return h;
  }

  function renderLCDA() {
    var l = currentLCDA();
    if (!l) return '<div class="p-head"><h1>LCDA</h1></div>' + section('Note', '<p class="note">LCDA fixtures are modelled for Kosofe in this prototype.</p>', false);
    var fx = lgaItems(view.lga);
    var fac = fx.facilities.slice(0, 3).map(function (f) {
      return row(f.id, '<div class="r-main">' + esc(f.name) + '</div><div class="r-sub">' + esc(f.typeLabel) + '</div>');
    }).join('');
    var rep = fx.reports.slice(0, 3).map(function (r) {
      return row(r.id, '<div class="r-main">' + esc(r.title) + '</div><div class="r-sub">' + statusChip(r.status) + '</div>');
    }).join('');
    return '<div class="p-head"><div class="accent-bar"></div><h1>' + esc(l.name) + '</h1>' +
      '<p class="sub">' + esc(view.lga) + ' LGA — Lagos State</p></div>' +
      section('LCDA administration', kv([
        ['Chairman', esc(l.chairman) + ' ' + tag('SAMPLE')],
        ['Wards', l.wards + ' ' + tag('SAMPLE')]
      ]) +
        '<p class="note">' + esc(l.note) + '</p>') +
      section('Facilities nearby', '<div class="rows">' + fac + '</div>') +
      section('Civic reports', '<div class="rows">' + rep + '</div>');
  }

  function renderDetail() {
    var it = itemIndex[detailCtx.id];
    if (!it) return '<div class="p-head"><h1>Record</h1></div>';
    var d = it.data;
    var backName = view.level === 'country' ? 'Nigeria'
      : view.level === 'state' ? FX.stateIdentity(view.state).name
      : view.level === 'lga' ? view.lga + ' LGA'
      : (currentLCDA() || {}).name || 'Back';
    var h = '<div class="p-head"><button class="link" id="backBtn">‹ ' + esc(backName) + '</button>' +
      '<h1 class="h2">' + esc(d.name || d.title) + '</h1>' + tag('SAMPLE') + '</div>';
    if (it.kind === 'facility') {
      h += section('Facility', kv([
        ['Type', esc(d.typeLabel)], ['Status', esc(d.status)], ['Phone', esc(d.phone)], ['Source', 'Sample fixture']
      ]));
    } else if (it.kind === 'project') {
      h += section('Project', kv([
        ['Sector', esc(d.sector)], ['Status', esc(d.status)], ['Budgeted', esc(d.budgeted)],
        ['Released', esc(d.released)], ['Contractor', esc(d.contractor)], ['Last updated', esc(d.updated)]
      ]) + '<p class="note">' + esc(d.description) + '</p>');
    } else if (it.kind === 'report') {
      var hist = d.history.map(function (ev) {
        return '<li><span class="mono">' + esc(ev[0]) + '</span> — ' + esc(ev[1]) + '</li>';
      }).join('');
      h += section('Report', kv([
        ['Category', esc(d.category)], ['Status', statusChip(d.status)], ['Severity', esc(d.severity)], ['Reported', esc(d.reported)]
      ]) + '<p class="note">' + esc(d.description) + '</p>') +
        section('History', '<ul class="lst timeline">' + hist + '</ul>');
    }
    h += '<div class="sec"><button class="btn" id="locateBtn">Locate on map</button></div>';
    return h;
  }

  function showDetail(kind, id, markerEl) {
    detailCtx = { kind: kind, id: id };
    renderPanel();
    if (markerEl) { markerEl.classList.add('pulse'); setTimeout(function () { markerEl.classList.remove('pulse'); }, 1600); }
    $('#panel').scrollTop = 0;
  }

  /* panel interactions (delegated) */
  $('#panelBody').addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('#backBtn'))) { renderPanel(); $('#panel').scrollTop = 0; return; }
    if ((t = e.target.closest('#locateBtn')) && detailCtx) {
      var it = itemIndex[detailCtx.id];
      if (it) map.flyTo({ center: it.coords, zoom: Math.max(map.getZoom(), 13.5), duration: 1200 });
      return;
    }
    if ((t = e.target.closest('#openLagos'))) { selectState('Lagos'); return; }
    if ((t = e.target.closest('tr[data-state]'))) { selectState(t.dataset.state); return; }
    if ((t = e.target.closest('tr[data-lga]'))) { selectLGA(t.dataset.lga); return; }
    if ((t = e.target.closest('tr[data-lcda]'))) {
      var l = null;
      FX.KOSOFE.lcdas.forEach(function (x) { if (x.id === t.dataset.lcda) l = x; });
      if (l) selectLCDA(l);
      return;
    }
    if ((t = e.target.closest('.row[data-iid]'))) {
      var it2 = itemIndex[t.dataset.iid];
      if (it2) {
        map.flyTo({ center: it2.coords, zoom: Math.max(map.getZoom(), 13), duration: 1200 });
        showDetail(it2.kind, t.dataset.iid, null);
      }
      return;
    }
  });
  $('#panelBody').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var t = e.target.closest('tr[data-state],tr[data-lga],tr[data-lcda],.row[data-iid]');
      if (t) t.click();
    }
  });

  /* ---------------- map <-> panel sync ---------------- */
  var layerOn = { boundaries: true, facilities: true, projects: true, reports: true };

  function updateMapForView() {
    clearMarkers();
    var showLgas = view.level !== 'country' && view.state === 'Lagos';
    setLayerVis('lgas-fill', showLgas && layerOn.boundaries);
    setLayerVis('lgas-line', showLgas && layerOn.boundaries);
    setLayerVis('lgas-label', showLgas);
    setLayerVis('states-fill', view.level === 'country');
    setLayerVis('states-label', view.level === 'country');

    var selId = '', selLgaId = '';
    if (view.level !== 'country') {
      var sf = featureByName(GEO.states.features, view.state);
      if (sf) selId = sf.properties.id;
    }
    if (view.level === 'lga' || view.level === 'lcda') {
      var gf = featureByName(GEO.lagosLgas.features, view.lga);
      if (gf) selLgaId = gf.properties.id;
    }
    map.setFilter('sel-line', ['==', ['get', 'id'], selId]);
    map.setFilter('sel-lga-line', ['==', ['get', 'id'], selLgaId]);
    setLayerVis('sel-lga-line', !!selLgaId);

    if (view.level === 'lga' || view.level === 'lcda') {
      var fx = lgaItems(view.lga);
      fx.facilities.forEach(function (f) {
        itemIndex[f.id] = { kind: 'facility', data: f, coords: f._pt };
        addMarker(f._pt, 'mk-fac', f.name, 'facilities', function (el) { showDetail('facility', f.id, el); });
      });
      fx.projects.forEach(function (p) {
        itemIndex[p.id] = { kind: 'project', data: p, coords: p._pt };
        addMarker(p._pt, 'mk-prj', p.name, 'projects', function (el) { showDetail('project', p.id, el); });
      });
      fx.reports.forEach(function (r) {
        itemIndex[r.id] = { kind: 'report', data: r, coords: r._pt };
        addMarker(r._pt, 'mk-rep-' + r.status, r.title, 'reports', function (el) { showDetail('report', r.id, el); });
      });
      if (view.level === 'lcda') {
        var l = currentLCDA();
        if (l) {
          var bbox = bboxOf(featureByName(GEO.lagosLgas.features, view.lga));
          // ensure _pt exists (renderLCDA path may not have run yet)
          if (!l._pt) { var idx = FX.KOSOFE.lcdas.indexOf(l); l._pt = placeIn(bbox, 'lcda', idx < 0 ? 0 : idx); }
          addMarker(l._pt, 'mk-lcda', l.name + ' (illustrative)', 'lcda', function () {});
        }
      }
      applyLayerToggles();
    }
    // state select sync
    var sv = view.level === 'country' ? 'ng' : (['Lagos', 'Kano', 'Rivers'].indexOf(view.state) >= 0 ? view.state : 'ng');
    if ($('#stateSelect').value !== sv) $('#stateSelect').value = sv;
  }

  function applyLayerToggles() {
    Object.keys(markersByGroup).forEach(function (g) {
      var on = layerOn[g] !== false;
      markersByGroup[g].forEach(function (m) {
        m.getElement().style.display = on ? '' : 'none';
      });
    });
    var showLgas = view.level !== 'country' && view.state === 'Lagos';
    setLayerVis('lgas-fill', showLgas && layerOn.boundaries);
    setLayerVis('lgas-line', showLgas && layerOn.boundaries);
    setLayerVis('states-line', layerOn.boundaries);
  }

  document.querySelectorAll('.lyr input').forEach(function (cb) {
    cb.addEventListener('change', function () {
      layerOn[cb.dataset.layer] = cb.checked;
      applyLayerToggles();
    });
  });

  /* ---------------- header controls ---------------- */
  $('#stateSelect').addEventListener('change', function () {
    var v = this.value;
    if (v === 'ng') { if (view.level !== 'country') goToLevel('country'); }
    else selectState(v);
  });
  $('#provBtn').addEventListener('click', function () { $('#drawer').classList.add('open'); });
  $('#drawerClose').addEventListener('click', function () { $('#drawer').classList.remove('open'); });
  $('#drawer').addEventListener('click', function (e) { if (e.target.id === 'drawer') this.classList.remove('open'); });
})();
