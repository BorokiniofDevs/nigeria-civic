/* ============================================================================
   FIXTURES — labelled sample civic data for the Lagos map prototype.
   ----------------------------------------------------------------------------
   EVERYTHING in this file is sample data for UI validation only. No official,
   facility, project, report, figure or brief here describes a real person,
   place or event. Real geometry lives in data/nigeria-states.geojson and
   data/lagos-lgas.geojson (GADM v4.1). LCDA marker positions are illustrative
   fixtures — official LCDA boundary data is pending.
   The production backend replaces this module 1:1 (see DATA_CONTRACT.md).
   ============================================================================ */
window.FIXTURES = (function () {
  'use strict';

  var SAMPLE = 'SAMPLE'; // badge text used across the UI

  /* Deterministic PRNG from a string seed — stable marker placement. */
  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = hashStr(seed);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  var TITLES = ['Dr.', 'Mrs.', 'Engr.', 'Alhaji', 'Barr.', 'Mr.', 'Hon.', 'Ms.'];
  var FIRST = ['Adeola', 'Funmilayo', 'Chukwuemeka', 'Musa', 'Ngozi', 'Olufemi', 'Halima',
               'Tunde', 'Aisha', 'Ibrahim', 'Emeka', 'Kemi', 'Yetunde', 'Segun', 'Fatima',
               'Obinna', 'Ronke', 'Sani', 'Adaeze', 'Babatunde', 'Nneka', 'Abubakar'];
  var LAST = ['Balogun', 'Adebayo-Ogunleye', 'Obi-Nwosu', 'Danladi', 'Eze-Franklin', 'Ajayi',
              'Suleiman', 'Bakare-Adeyinka', 'Bello-Mohammed', 'Musa-Kano', 'Nwachukwu',
              'Ogundele', 'Sogbesan', 'Alabi-Isola', 'Okonkwo-Adeyemi', 'Yusuf-Abdullahi',
              'Ezeani', 'Okafor-Mensah', 'Garba-Shettima', 'Adewumi', 'Dantata-Bello'];
  function person(r) { return pick(r, TITLES) + ' ' + pick(r, FIRST) + ' ' + pick(r, LAST); }

  /* ---- State identity fixtures: restrained, never flag-themed ---- */
  var NIGERIA_ACCENT = '#008751';
  var STATE_IDENTITY = {
    'Lagos':  { capital: 'Ikeja',         accent: '#0E7C6B' },
    'Kano':   { capital: 'Kano',          accent: '#1B7A3D' },
    'Rivers': { capital: 'Port Harcourt', accent: '#1D5FBF' }
  };
  // LGA counts below are from GADM v4.1 (real); everything else on this panel is sample.
  var LGA_COUNTS = { 'Lagos': 20, 'Kano': 44, 'Rivers': 23 };

  function stateIdentity(name) {
    var base = STATE_IDENTITY[name];
    var r = rng('state:' + name);
    return {
      name: name === 'Federal Capital Territory' ? name : name + ' State',
      capital: base ? base.capital : null,
      accent: base ? base.accent : '#5A6470',
      fullFixture: !!base,
      governor: base ? person(r) : null,
      deputy: base ? person(r) : null,
      speaker: base ? person(r) : null,
      lgaCount: LGA_COUNTS[name] || null,
      lgaCountSource: LGA_COUNTS[name] ? 'GADM v4.1' : null
    };
  }

  /* ---- Generic LGA fixture (deterministic from the LGA name) ---- */
  function lgaFixture(name) {
    var r = rng('lga:' + name);
    return {
      name: name,
      chairman: person(r),
      viceChairman: person(r),
      councillors: 7 + Math.floor(r() * 6),
      wards: 8 + Math.floor(r() * 5),
      departments: ['Works & Infrastructure', 'Primary Healthcare', 'Education', 'Environment & Sanitation']
    };
  }

  /* ---- Facility / project / report templates ---- */
  var FACILITY_TYPES = {
    primary_health_centre: 'Primary Health Centre',
    general_hospital: 'General Hospital',
    police_division: 'Police Division',
    police_station: 'Police Station',
    fire_station: 'Fire Service Station'
  };
  var REPORT_STATUSES = ['reported', 'under_review', 'in_progress', 'resolved'];
  var STATUS_LABEL = { reported: 'Reported', under_review: 'Under review', in_progress: 'In progress', resolved: 'Resolved' };

  function genericFacilities(lgaName, n) {
    var r = rng('fac:' + lgaName), out = [], keys = Object.keys(FACILITY_TYPES);
    var towns = ['Ketu', 'Ojota', 'Mile 12', 'Agboyi', 'Ikosi', 'Isheri', 'Oregun', 'Alausa'];
    for (var i = 0; i < n; i++) {
      var t = keys[Math.floor(r() * keys.length)];
      out.push({
        id: 'f-' + lgaName.replace(/\W/g, '') + '-' + i,
        name: pick(r, towns) + ' ' + FACILITY_TYPES[t] + ' (sample)',
        type: t, typeLabel: FACILITY_TYPES[t],
        status: 'Operational', phone: '0' + (700 + Math.floor(r() * 200)) + ' ' +
                (100 + Math.floor(r() * 899)) + ' ' + (1000 + Math.floor(r() * 8999)),
        source: SAMPLE
      });
    }
    return out;
  }
  function genericProjects(lgaName, n) {
    var r = rng('prj:' + lgaName), out = [];
    var kinds = ['Road Rehabilitation', 'Drainage Desilting', 'Primary Healthcare Upgrade',
                 'Streetlight Restoration', 'Market Sanitation Works', 'Borehole Project'];
    for (var i = 0; i < n; i++) {
      var v = 120 + Math.floor(r() * 900);
      out.push({
        id: 'p-' + lgaName.replace(/\W/g, '') + '-' + i,
        name: lgaName + ' ' + pick(r, kinds) + ' — Phase ' + (1 + Math.floor(r() * 3)) + ' (sample)',
        sector: pick(r, ['Roads', 'Health', 'Environment', 'Water']),
        status: pick(r, ['Ongoing', 'Ongoing', 'Planned', 'Completed']),
        budgeted: '₦' + v + ',000,000', released: '₦' + Math.floor(v * (0.3 + r() * 0.5)) + ',000,000',
        contractor: pick(r, ['—', 'Withheld (sample)', '—']),
        updated: '2026-09-' + (1 + Math.floor(r() * 23)),
        description: 'Sample project record for UI validation. Figures are illustrative, not real.',
        source: SAMPLE
      });
    }
    return out;
  }
  function genericReports(lgaName, n) {
    var r = rng('rep:' + lgaName), out = [];
    var kinds = [
      ['Potholes on major road', 'Roads'], ['Blocked drainage channel', 'Environment'],
      ['Faulty streetlights', 'Infrastructure'], ['Overflowing refuse point', 'Environment'],
      ['Broken water pipe', 'Water'], ['Damaged pedestrian bridge', 'Roads']
    ];
    var towns = ['Ketu', 'Ojota', 'Mile 12', 'Agboyi', 'Ikosi', 'Isheri'];
    for (var i = 0; i < n; i++) {
      var k = pick(r, kinds);
      out.push({
        id: 'r-' + lgaName.replace(/\W/g, '') + '-' + i,
        title: k[0] + ' — ' + pick(r, towns) + ' (sample)',
        category: k[1], status: pick(r, REPORT_STATUSES),
        severity: pick(r, ['Low', 'Medium', 'High']),
        reported: '2026-09-' + (1 + Math.floor(r() * 23)),
        description: 'Sample citizen report for UI validation. Not a real incident.',
        history: [['2026-09-' + (1 + Math.floor(r() * 23)), 'Report submitted (sample)']],
        source: SAMPLE
      });
    }
    return out;
  }

  /* ---- Kosofe: hand-authored fixture detail for the pilot walkthrough ---- */
  var KOSOFE = {
    chairman: 'Hon. Babatunde Sogbesan (sample)',
    viceChairman: 'Mrs. Ronke Alabi-Isola (sample)',
    councillors: 10, wards: 12,
    departments: ['Works & Infrastructure', 'Primary Healthcare', 'Education', 'Environment & Sanitation', 'Revenue & Records'],
    lcdas: [
      { id: 'agboyi-ketu', name: 'Agboyi-Ketu LCDA', chairman: 'Hon. Tunde Bakare-Adeyinka (sample)', wards: 7,
        note: 'Position illustrative — official LCDA boundary data pending.' },
      { id: 'ikosi-isheri', name: 'Ikosi-Isheri LCDA', chairman: 'Mrs. Funmilayo Adebayo-Ogunleye (sample)', wards: 5,
        note: 'Position illustrative — official LCDA boundary data pending.' }
    ],
    facilities: [
      { id: 'f-ketuphc', name: 'Ketu Primary Health Centre (sample)', type: 'primary_health_centre', typeLabel: 'Primary Health Centre', status: 'Operational', phone: '0700 000 1001', source: SAMPLE },
      { id: 'f-ojotapol', name: 'Ojota Police Division (sample)', type: 'police_division', typeLabel: 'Police Division', status: 'Operational', phone: '0700 000 1002', source: SAMPLE },
      { id: 'f-agboyigh', name: 'Agboyi General Hospital (sample)', type: 'general_hospital', typeLabel: 'General Hospital', status: 'Operational', phone: '0700 000 1003', source: SAMPLE },
      { id: 'f-mile12pol', name: 'Mile 12 Police Station (sample)', type: 'police_station', typeLabel: 'Police Station', status: 'Operational', phone: '0700 000 1004', source: SAMPLE },
      { id: 'f-ikosifire', name: 'Ikosi Fire Service Station (sample)', type: 'fire_station', typeLabel: 'Fire Service Station', status: 'Operational', phone: '0700 000 1005', source: SAMPLE }
    ],
    projects: [
      { id: 'p-ikorodu', name: 'Ikorodu Road Rehabilitation — Ketu Section (sample)', sector: 'Roads', status: 'Ongoing',
        budgeted: '₦480,000,000', released: '₦240,000,000', contractor: 'Withheld (sample)', updated: '2026-09-10',
        description: 'Sample project record for UI validation. Figures are illustrative, not real.', source: SAMPLE },
      { id: 'p-agboyidrain', name: 'Agboyi-Ketu Drainage Desilting (sample)', sector: 'Environment', status: 'Ongoing',
        budgeted: '₦150,000,000', released: '₦90,000,000', contractor: '—', updated: '2026-09-14',
        description: 'Sample project record for UI validation. Figures are illustrative, not real.', source: SAMPLE },
      { id: 'p-ikosiphc', name: 'Ikosi-Isheri Primary Healthcare Upgrade (sample)', sector: 'Health', status: 'Planned',
        budgeted: '₦220,000,000', released: '₦0', contractor: '—', updated: '2026-08-30',
        description: 'Sample project record for UI validation. Figures are illustrative, not real.', source: SAMPLE }
    ],
    reports: [
      { id: 'r-pothole', title: 'Potholes on Ikorodu Road near Ketu (sample)', category: 'Roads', status: 'in_progress', severity: 'High', reported: '2026-09-18',
        description: 'Sample citizen report for UI validation. Not a real incident.',
        history: [['2026-09-18', 'Report submitted'], ['2026-09-19', 'Acknowledged by works desk (sample)'], ['2026-09-21', 'Repair crew assigned (sample)']], source: SAMPLE },
      { id: 'r-drainage', title: 'Blocked drainage channel at Mile 12 (sample)', category: 'Environment', status: 'under_review', severity: 'Medium', reported: '2026-09-20',
        description: 'Sample citizen report for UI validation. Not a real incident.',
        history: [['2026-09-20', 'Report submitted'], ['2026-09-22', 'Under review by environment desk (sample)']], source: SAMPLE },
      { id: 'r-lights', title: 'Faulty streetlights along Ojota interchange (sample)', category: 'Infrastructure', status: 'reported', severity: 'Medium', reported: '2026-09-22',
        description: 'Sample citizen report for UI validation. Not a real incident.',
        history: [['2026-09-22', 'Report submitted']], source: SAMPLE },
      { id: 'r-refuse', title: 'Overflowing refuse collection point, Agboyi (sample)', category: 'Environment', status: 'resolved', severity: 'Low', reported: '2026-09-05',
        description: 'Sample citizen report for UI validation. Not a real incident.',
        history: [['2026-09-05', 'Report submitted'], ['2026-09-07', 'Cleared by sanitation crew (sample)'], ['2026-09-08', 'Marked resolved (sample)']], source: SAMPLE }
    ],
    brief: {
      date: '2026-09-24',
      items: [
        'Works desk acknowledges the Ikorodu Road (Ketu section) rehabilitation remains ongoing; no verified completion date published (sample).',
        'Two drainage-related citizen reports in Mile 12 and Agboyi are under review by the environment desk (sample).',
        'No verified emergency advisories for Kosofe in the last 24 hours (sample).'
      ]
    }
  };

  var LAGOS_MDAS = [
    'Ministry of Transportation', 'Ministry of Health', 'Ministry of Education',
    'Ministry of Environment & Water Resources', 'Ministry of Works & Infrastructure',
    'Lagos State Emergency Management Agency (LASEMA)'
  ];

  return {
    SAMPLE: SAMPLE,
    NIGERIA_ACCENT: NIGERIA_ACCENT,
    STATUS_LABEL: STATUS_LABEL,
    stateIdentity: stateIdentity,
    lgaFixture: lgaFixture,
    genericFacilities: genericFacilities,
    genericProjects: genericProjects,
    genericReports: genericReports,
    KOSOFE: KOSOFE,
    LAGOS_MDAS: LAGOS_MDAS,
    rng: rng
  };
})();
