import React, { useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import {
  Building2,
  Users,
  ShieldCheck,
  ChevronRight,
  Award,
  FileCheck2,
  Sparkles,
  Compass,
  CheckCircle2,
} from 'lucide-react';
import { GeopoliticalZone } from '../types/civic';
import nigeriaGeoData from '../data/nigeriaGeo.json';

export interface StateMapData {
  id: string;
  code: string;
  name: string;
  zone: GeopoliticalZone;
  capital: string;
  lgaCount: number;
  lcdaCount?: number;
  wardCount?: number;
  governor: string;
  governorPhoto?: string;
  deputyGovernor?: string;
  cpName: string;
  population: string;
  flagUrl?: string;
  sealUrl?: string;
}

// 6 Geopolitical Zones styling palette - distinct colors with distinct boundary strokes
export const ZONE_CONFIG: Record<
  GeopoliticalZone,
  {
    name: string;
    color: string;
    fillColor: string;
    hoverFill: string;
    activeFill: string;
    borderColor: string;
    badgeBg: string;
    badgeText: string;
    statesCount: number;
  }
> = {
  'North-West': {
    name: 'North-West',
    color: '#059669', // Emerald Green
    fillColor: '#d1fae5',
    hoverFill: '#a7f3d0',
    activeFill: '#10b981',
    borderColor: '#047857',
    badgeBg: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    badgeText: 'text-emerald-700',
    statesCount: 7,
  },
  'North-East': {
    name: 'North-East',
    color: '#0891b2', // Cyan / Teal
    fillColor: '#cffafe',
    hoverFill: '#a5f3fc',
    activeFill: '#06b6d4',
    borderColor: '#0e7490',
    badgeBg: 'bg-cyan-50 border-cyan-300 text-cyan-800',
    badgeText: 'text-cyan-700',
    statesCount: 6,
  },
  'North-Central': {
    name: 'North-Central',
    color: '#d97706', // Amber / Gold
    fillColor: '#fef3c7',
    hoverFill: '#fde68a',
    activeFill: '#f59e0b',
    borderColor: '#b45309',
    badgeBg: 'bg-amber-50 border-amber-300 text-amber-800',
    badgeText: 'text-amber-700',
    statesCount: 6,
  },
  'South-West': {
    name: 'South-West',
    color: '#16a34a', // Vivid Green
    fillColor: '#bbf7d0',
    hoverFill: '#86efac',
    activeFill: '#22c55e',
    borderColor: '#15803d',
    badgeBg: 'bg-green-50 border-green-300 text-green-900',
    badgeText: 'text-green-800',
    statesCount: 6,
  },
  'South-East': {
    name: 'South-East',
    color: '#4f46e5', // Indigo
    fillColor: '#e0e7ff',
    hoverFill: '#c7d2fe',
    activeFill: '#6366f1',
    borderColor: '#3730a3',
    badgeBg: 'bg-indigo-50 border-indigo-300 text-indigo-800',
    badgeText: 'text-indigo-700',
    statesCount: 5,
  },
  'South-South': {
    name: 'South-South',
    color: '#0284c7', // Sky / Azure
    fillColor: '#bae6fd',
    hoverFill: '#7dd3fc',
    activeFill: '#0ea5e9',
    borderColor: '#0369a1',
    badgeBg: 'bg-sky-50 border-sky-300 text-sky-800',
    badgeText: 'text-sky-700',
    statesCount: 6,
  },
  'Federal Capital Territory': {
    name: 'Federal Capital Territory (FCT)',
    color: '#7c3aed',
    fillColor: '#ede9fe',
    hoverFill: '#ddd6fe',
    activeFill: '#8b5cf6',
    borderColor: '#5b21b6',
    badgeBg: 'bg-purple-50 border-purple-300 text-purple-800',
    badgeText: 'text-purple-700',
    statesCount: 1,
  },
};

// Accurate metadata mapping for all 36 States + FCT (774 Constitutional LGAs nationwide)
export const NIGERIA_STATES_MAP_DATA: StateMapData[] = [
  // SOUTH-WEST (6 States)
  {
    id: 'state_lagos',
    code: 'LA',
    name: 'Lagos',
    zone: 'South-West',
    capital: 'Ikeja',
    lgaCount: 20, // 20 Officially recognized in 1999 Constitution
    lcdaCount: 37, // 37 Created by Lagos State Government
    wardCount: 377, // 377 Electoral Wards
    governor: 'Mr. Babajide Olusola Sanwo-Olu',
    governorPhoto: '/assets/officials/gov_sanwo_olu.jpg',
    deputyGovernor: 'Dr. Kadri Obafemi Hamzat',
    cpName: 'CP Olanrewaju Ishola',
    population: '15.5M+',
    flagUrl: '/assets/lagos/lagos_state_flag.gif',
    sealUrl: '/assets/lagos/lagos_state_seal.png',
  },
  {
    id: 'state_ogun',
    code: 'OG',
    name: 'Ogun',
    zone: 'South-West',
    capital: 'Abeokuta',
    lgaCount: 20,
    governor: 'Prince Dapo Abiodun MFR',
    cpName: 'CP Abiodun Alamutu',
    population: '6.4M+',
  },
  {
    id: 'state_oyo',
    code: 'OY',
    name: 'Oyo',
    zone: 'South-West',
    capital: 'Ibadan',
    lgaCount: 33,
    governor: 'Engr. Seyi Makinde',
    cpName: 'CP Adebola Hamzat',
    population: '7.8M+',
  },
  {
    id: 'state_osun',
    code: 'OS',
    name: 'Osun',
    zone: 'South-West',
    capital: 'Osogbo',
    lgaCount: 30,
    governor: 'Sen. Ademola Adeleke',
    cpName: 'CP Mohammed Umar Abba',
    population: '4.7M+',
  },
  {
    id: 'state_ondo',
    code: 'ON',
    name: 'Ondo',
    zone: 'South-West',
    capital: 'Akure',
    lgaCount: 18,
    governor: 'Hon. Lucky Aiyedatiwa',
    cpName: 'CP Abayomi Oladipo Peter',
    population: '5.3M+',
  },
  {
    id: 'state_ekiti',
    code: 'EK',
    name: 'Ekiti',
    zone: 'South-West',
    capital: 'Ado-Ekiti',
    lgaCount: 16,
    governor: 'Mr. Biodun Oyebanji',
    cpName: 'CP Adeniran Akinwale',
    population: '3.3M+',
  },

  // NORTH-WEST (7 States)
  {
    id: 'state_sokoto',
    code: 'SO',
    name: 'Sokoto',
    zone: 'North-West',
    capital: 'Sokoto',
    lgaCount: 23,
    governor: 'Dr. Ahmed Aliyu',
    cpName: 'CP Ali Hayatu Kaigama',
    population: '5.9M+',
  },
  {
    id: 'state_kebbi',
    code: 'KB',
    name: 'Kebbi',
    zone: 'North-West',
    capital: 'Birnin Kebbi',
    lgaCount: 21,
    governor: 'Dr. Nasir Idris',
    cpName: 'CP Chris Aimionowane',
    population: '5.2M+',
  },
  {
    id: 'state_zamfara',
    code: 'ZA',
    name: 'Zamfara',
    zone: 'North-West',
    capital: 'Gusau',
    lgaCount: 14,
    governor: 'Dr. Dauda Lawal',
    cpName: 'CP Muhammad Shehu Dalijan',
    population: '4.5M+',
  },
  {
    id: 'state_katsina',
    code: 'KT',
    name: 'Katsina',
    zone: 'North-West',
    capital: 'Katsina',
    lgaCount: 34,
    governor: 'Dr. Dikko Umaru Radda',
    cpName: 'CP Aliyu Abubakar Musa',
    population: '9.3M+',
  },
  {
    id: 'state_kano',
    code: 'KN',
    name: 'Kano',
    zone: 'North-West',
    capital: 'Kano',
    lgaCount: 44,
    governor: 'Engr. Abba Kabir Yusuf',
    cpName: 'CP Salman Dogo Garba',
    population: '15.4M+',
  },
  {
    id: 'state_jigawa',
    code: 'JI',
    name: 'Jigawa',
    zone: 'North-West',
    capital: 'Dutse',
    lgaCount: 27,
    governor: 'Malam Umar Namadi',
    cpName: 'CP Ahmadu Abdullahi',
    population: '6.7M+',
  },
  {
    id: 'state_kaduna',
    code: 'KD',
    name: 'Kaduna',
    zone: 'North-West',
    capital: 'Kaduna',
    lgaCount: 23,
    governor: 'Sen. Uba Sani',
    cpName: 'CP Audu Ali Dabigi',
    population: '8.9M+',
  },

  // NORTH-EAST (6 States)
  {
    id: 'state_yobe',
    code: 'YO',
    name: 'Yobe',
    zone: 'North-East',
    capital: 'Damaturu',
    lgaCount: 17,
    governor: 'Hon. Mai Mala Buni',
    cpName: 'CP Garba Ahmed',
    population: '3.6M+',
  },
  {
    id: 'state_borno',
    code: 'BO',
    name: 'Borno',
    zone: 'North-East',
    capital: 'Maiduguri',
    lgaCount: 27,
    governor: 'Prof. Babagana Umara Zulum',
    cpName: 'CP Yusufu Lawal',
    population: '6.8M+',
  },
  {
    id: 'state_bauchi',
    code: 'BA',
    name: 'Bauchi',
    zone: 'North-East',
    capital: 'Bauchi',
    lgaCount: 20,
    governor: 'Sen. Bala Mohammed',
    cpName: 'CP Auwal Musa Mohammad',
    population: '7.5M+',
  },
  {
    id: 'state_gombe',
    code: 'GO',
    name: 'Gombe',
    zone: 'North-East',
    capital: 'Gombe',
    lgaCount: 11,
    governor: 'Muhammad Inuwa Yahaya',
    cpName: 'CP Hayatu Usman',
    population: '3.8M+',
  },
  {
    id: 'state_adamawa',
    code: 'AD',
    name: 'Adamawa',
    zone: 'North-East',
    capital: 'Yola',
    lgaCount: 21,
    governor: 'Ahmadu Umaru Fintiri',
    cpName: 'CP Dankombo Morris',
    population: '4.9M+',
  },
  {
    id: 'state_taraba',
    code: 'TR',
    name: 'Taraba',
    zone: 'North-East',
    capital: 'Jalingo',
    lgaCount: 16,
    governor: 'Col. Agbu Kefas (Rtd)',
    cpName: 'CP David Iloyanomon',
    population: '3.6M+',
  },

  // NORTH-CENTRAL (6 States + FCT)
  {
    id: 'state_niger',
    code: 'NI',
    name: 'Niger',
    zone: 'North-Central',
    capital: 'Minna',
    lgaCount: 25,
    governor: 'Mohammed Umaru Bago',
    cpName: 'CP Shawulu Dan-Mamman',
    population: '6.7M+',
  },
  {
    id: 'state_fct',
    code: 'FC',
    name: 'Federal Capital Territory',
    zone: 'Federal Capital Territory',
    capital: 'Abuja (Federal Capital)',
    lgaCount: 6, // 6 Area Councils
    governor: 'Barr. Nyesom Wike (Minister of FCT)',
    cpName: 'CP Bennett Igweh',
    population: '4.0M+',
  },
  {
    id: 'state_nasarawa',
    code: 'NA',
    name: 'Nasarawa',
    zone: 'North-Central',
    capital: 'Lafia',
    lgaCount: 13,
    governor: 'Engr. Abdullahi Sule',
    cpName: 'CP Umar Shehu Nadada',
    population: '2.9M+',
  },
  {
    id: 'state_plateau',
    code: 'PL',
    name: 'Plateau',
    zone: 'North-Central',
    capital: 'Jos',
    lgaCount: 17,
    governor: 'Barr. Caleb Mutfwang',
    cpName: 'CP Emmanuel Olugbemiga Adesina',
    population: '4.7M+',
  },
  {
    id: 'state_benue',
    code: 'BE',
    name: 'Benue',
    zone: 'North-Central',
    capital: 'Makurdi',
    lgaCount: 23,
    governor: 'Rev. Fr. Hyacinth Alia',
    cpName: 'CP Hassan Steve Yabanet',
    population: '6.1M+',
  },
  {
    id: 'state_kogi',
    code: 'KO',
    name: 'Kogi',
    zone: 'North-Central',
    capital: 'Lokoja',
    lgaCount: 21,
    governor: 'Alh. Ahmed Usman Ododo',
    cpName: 'CP Bethrand Onuoha',
    population: '4.5M+',
  },
  {
    id: 'state_kwara',
    code: 'KW',
    name: 'Kwara',
    zone: 'North-Central',
    capital: 'Ilorin',
    lgaCount: 16,
    governor: 'Mallam AbdulRahman AbdulRazaq',
    cpName: 'CP Victor Olaiya',
    population: '3.6M+',
  },

  // SOUTH-EAST (5 States)
  {
    id: 'state_enugu',
    code: 'EN',
    name: 'Enugu',
    zone: 'South-East',
    capital: 'Enugu',
    lgaCount: 17,
    governor: 'Barr. Peter Mbah',
    cpName: 'CP Kanayo Uzuegbu',
    population: '4.7M+',
  },
  {
    id: 'state_anambra',
    code: 'AN',
    name: 'Anambra',
    zone: 'South-East',
    capital: 'Awka',
    lgaCount: 21,
    governor: 'Prof. Charles Chukwuma Soludo',
    cpName: 'CP Nnaghe Obono Itam',
    population: '5.9M+',
  },
  {
    id: 'state_ebonyi',
    code: 'EB',
    name: 'Ebonyi',
    zone: 'South-East',
    capital: 'Abakaliki',
    lgaCount: 13,
    governor: 'Rt. Hon. Francis Nwifuru',
    cpName: 'CP Augustina Ogbodo',
    population: '3.2M+',
  },
  {
    id: 'state_imo',
    code: 'IM',
    name: 'Imo',
    zone: 'South-East',
    capital: 'Owerri',
    lgaCount: 27,
    governor: 'Sen. Hope Uzodimma',
    cpName: 'CP Aboki Danjuma',
    population: '5.4M+',
  },
  {
    id: 'state_abia',
    code: 'AB',
    name: 'Abia',
    zone: 'South-East',
    capital: 'Umuahia',
    lgaCount: 17,
    governor: 'Dr. Alex Otti OFR',
    cpName: 'CP Danladi Isa',
    population: '4.1M+',
  },

  // SOUTH-SOUTH (6 States)
  {
    id: 'state_edo',
    code: 'ED',
    name: 'Edo',
    zone: 'South-South',
    capital: 'Benin City',
    lgaCount: 18,
    governor: 'Sen. Monday Okpebholo',
    cpName: 'CP Nemi Edwin-Iwo',
    population: '4.8M+',
  },
  {
    id: 'state_delta',
    code: 'DE',
    name: 'Delta',
    zone: 'South-South',
    capital: 'Asaba',
    lgaCount: 25,
    governor: 'Rt. Hon. Sheriff Oborevwori',
    cpName: 'CP Olufemi Abaniwonda',
    population: '5.7M+',
  },
  {
    id: 'state_bayelsa',
    code: 'BY',
    name: 'Bayelsa',
    zone: 'South-South',
    capital: 'Yenagoa',
    lgaCount: 8,
    governor: 'Sen. Douye Diri',
    cpName: 'CP Alonyenu Francis Idu',
    population: '2.5M+',
  },
  {
    id: 'state_rivers',
    code: 'RI',
    name: 'Rivers',
    zone: 'South-South',
    capital: 'Port Harcourt',
    lgaCount: 23,
    governor: 'Sir Siminalayi Fubara GSSRS',
    cpName: 'CP Mustapha Mohammed Bala',
    population: '7.5M+',
  },
  {
    id: 'state_cross_river',
    code: 'CR',
    name: 'Cross River',
    zone: 'South-South',
    capital: 'Calabar',
    lgaCount: 18,
    governor: 'Sen. Bassey Otu',
    cpName: 'CP Gyogon Augustine Grimah',
    population: '4.4M+',
  },
  {
    id: 'state_akwa_ibom',
    code: 'AK',
    name: 'Akwa Ibom',
    zone: 'South-South',
    capital: 'Uyo',
    lgaCount: 31,
    governor: 'Pastor Umo Eno',
    cpName: 'CP Joseph Eribo',
    population: '5.5M+',
  },
];

// Helper to normalize names between TopoJSON and State Data
function findStateByTopoName(topoName: string): StateMapData | undefined {
  const cleanName = topoName.trim().toLowerCase();
  return NIGERIA_STATES_MAP_DATA.find((s) => {
    const sName = s.name.toLowerCase();
    if (sName === cleanName) return true;
    if (cleanName === 'nassarawa' && sName === 'nasarawa') return true;
    if (cleanName.includes('federal capital') && s.id === 'state_fct') return true;
    return false;
  });
}

// True WGS84 geographic centroid coordinates [longitude, latitude] for Nigeria
const STATE_GEO_COORDS: Record<string, [number, number]> = {
  Rivers: [6.816, 4.962],
  Katsina: [7.67, 12.586],
  Sokoto: [5.383, 13.244],
  Zamfara: [6.301, 12.133],
  Yobe: [11.599, 11.929],
  Kebbi: [4.12, 12.128],
  Adamawa: [12.434, 9.627],
  Borno: [13.315, 12.127],
  'Akwa Ibom': [7.803, 4.906],
  Abia: [7.607, 5.661],
  Imo: [7.015, 5.555],
  Bayelsa: [6.124, 4.679],
  Benue: [9.047, 7.327],
  'Cross River': [8.581, 5.951],
  Taraba: [10.88, 7.827],
  Kwara: [4.958, 8.651],
  Lagos: [3.867, 6.545],
  Niger: [5.795, 9.872],
  'Federal Capital Territory': [7.066, 8.821],
  Ogun: [3.426, 7.037],
  Ondo: [4.873, 6.885],
  Ekiti: [5.317, 7.721],
  Osun: [4.572, 7.519],
  Oyo: [3.594, 8.172],
  Anambra: [6.968, 6.235],
  Bauchi: [9.957, 10.342],
  Gombe: [11.244, 10.524],
  Delta: [5.796, 5.524],
  Edo: [5.971, 6.587],
  Enugu: [7.432, 6.541],
  Ebonyi: [8.064, 6.318],
  Kaduna: [7.546, 10.621],
  Kogi: [7.175, 7.418],
  Plateau: [9.669, 9.065],
  Nassarawa: [8.249, 8.592],
  Jigawa: [9.463, 12.413],
  Kano: [8.521, 11.805],
};

interface Props {
  selectedStateId: string | null;
  onSelectState: (stateId: string) => void;
  onDrillDownState: (stateId: string) => void;
}

export const NigeriaInteractiveMap: React.FC<Props> = ({
  selectedStateId,
  onSelectState,
  onDrillDownState,
}) => {
  const [activeZoneFilter, setActiveZoneFilter] = useState<GeopoliticalZone | 'ALL'>('ALL');
  const [hoveredState, setHoveredState] = useState<StateMapData | null>(null);

  // Active state profile for dossier
  const activeState =
    NIGERIA_STATES_MAP_DATA.find((s) => s.id === (selectedStateId || hoveredState?.id)) ||
    NIGERIA_STATES_MAP_DATA.find((s) => s.id === 'state_lagos')!;

  const zonesList: GeopoliticalZone[] = [
    'North-West',
    'North-East',
    'North-Central',
    'South-West',
    'South-East',
    'South-South',
  ];

  // States belonging to the currently active zone filter
  const statesInActiveZone = NIGERIA_STATES_MAP_DATA.filter((s) =>
    activeZoneFilter === 'ALL' ? true : s.zone === activeZoneFilter,
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 lg:p-7 transition-all mb-8">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Accurate Geopolitical Zones Map
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            6 Geopolitical Zones of Nigeria
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5 max-w-2xl leading-relaxed">
            Interactive geopolitical zones with distinct boundaries and labeled states. Click any state or zone to preview constitutional leadership.
          </p>
        </div>

        {/* Legend Quick Count */}
        <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/90 px-3.5 py-2 rounded-xl shadow-2xs">
          <Award className="w-4 h-4 text-emerald-700 shrink-0" />
          <div className="text-xs">
            <span className="font-extrabold text-slate-900">774 Constitutional LGAs</span>
            <span className="text-slate-500 ml-1">in 36 States + FCT</span>
          </div>
        </div>
      </div>

      {/* Geopolitical Zone Filter Bar */}
      <div className="mt-4 flex flex-wrap gap-1.5 items-center">
        <button
          onClick={() => setActiveZoneFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
            activeZoneFilter === 'ALL'
              ? 'bg-emerald-800 text-white ring-2 ring-emerald-800/30'
              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          All 36 States + FCT (37)
        </button>

        {zonesList.map((z) => {
          const cfg = ZONE_CONFIG[z];
          const isSelected = activeZoneFilter === z;
          return (
            <button
              key={z}
              onClick={() => {
                setActiveZoneFilter(z);
                // Automatically select the first state in this zone if active state is not in this zone
                if (activeState.zone !== z) {
                  const firstInZone = NIGERIA_STATES_MAP_DATA.find((s) => s.zone === z);
                  if (firstInZone) onSelectState(firstInZone.id);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                isSelected
                  ? `${cfg.badgeBg} ring-2 ring-emerald-600 ring-offset-1 font-extrabold`
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: cfg.color }}
              />
              <span>{z}</span>
              <span className="text-[10px] opacity-75">({cfg.statesCount})</span>
            </button>
          );
        })}
      </div>

      {/* States Under Active Zone Pill List */}
      <div className="mt-3 p-2.5 bg-slate-50/90 rounded-xl border border-slate-200/80">
        <div className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-emerald-700" />
          <span>
            States under {activeZoneFilter === 'ALL' ? 'All Zones' : `${activeZoneFilter} Zone`} ({statesInActiveZone.length}):
          </span>
          <span className="text-slate-400 font-normal ml-auto text-[10px]">Click any state to preview</span>
        </div>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
          {statesInActiveZone.map((st) => {
            const isSelected = activeState.id === st.id;
            const zoneCfg = ZONE_CONFIG[st.zone];
            return (
              <button
                key={st.id}
                onClick={() => onSelectState(st.id)}
                className={`px-2 py-0.5 rounded-md text-[11.5px] font-semibold transition flex items-center gap-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-emerald-800 text-white border-emerald-800 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: zoneCfg.color }}
                />
                <span>{st.name}</span>
                <span className={`text-[9.5px] ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>({st.lgaCount})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: React-Simple-Maps Container (Left) + Detail Dossier Card (Right) */}
      <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* SVG Map Container - Crisp light background */}
        <div className="lg:col-span-7 bg-[#f8fafc] border border-slate-200/90 rounded-2xl p-3 sm:p-5 relative overflow-hidden flex flex-col items-center justify-center">
          {/* Subtle watermark contour in background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#008751_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Active Zone Overlay Banner */}
          <div className="w-full flex items-center justify-between pb-2 mb-1.5 border-b border-slate-200/60 text-xs">
            <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11.5px]">
              <Compass className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                Map View:{' '}
                <strong className="text-slate-900">
                  {activeZoneFilter === 'ALL' ? 'All 6 Geopolitical Zones' : `${activeZoneFilter} Zone Highlighted`}
                </strong>
              </span>
            </span>
            <span className="text-emerald-800 font-semibold text-[10.5px]">
              Click any state
            </span>
          </div>

          {/* High-Accuracy react-simple-maps Topography */}
          <div className="w-full max-w-[650px] relative">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{
                scale: 3300,
                center: [8.6753, 9.0820],
              }}
              width={800}
              height={600}
              className="w-full h-auto drop-shadow-xs select-none"
            >
              <Geographies geography={nigeriaGeoData as any}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const stateName = geo.properties?.name || '';
                    const stateData = findStateByTopoName(stateName);
                    if (!stateData) return null;

                    const zoneCfg = ZONE_CONFIG[stateData.zone];
                    const isSelected = activeState.id === stateData.id;
                    const isHovered = hoveredState?.id === stateData.id;
                    const matchesZone =
                      activeZoneFilter === 'ALL' || stateData.zone === activeZoneFilter;

                    let fill = zoneCfg.fillColor;
                    if (!matchesZone) {
                      fill = '#f1f5f9'; // Soft dimmed if filtered out
                    } else if (isSelected) {
                      fill = zoneCfg.activeFill;
                    } else if (isHovered) {
                      fill = zoneCfg.hoverFill;
                    }

                    const stroke = isSelected
                      ? '#064e3b'
                      : matchesZone
                      ? zoneCfg.borderColor
                      : '#cbd5e1';

                    const strokeWidth = isSelected ? 2.5 : matchesZone ? 1.6 : 0.8;

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        onClick={() => {
                          onSelectState(stateData.id);
                          if (activeZoneFilter !== 'ALL' && activeZoneFilter !== stateData.zone) {
                            setActiveZoneFilter(stateData.zone);
                          }
                        }}
                        onMouseEnter={() => setHoveredState(stateData)}
                        onMouseLeave={() => setHoveredState(null)}
                        style={{
                          default: {
                            fill,
                            stroke,
                            strokeWidth,
                            outline: 'none',
                            transition: 'all 150ms ease-in-out',
                            cursor: 'pointer',
                          },
                          hover: {
                            fill: matchesZone ? zoneCfg.hoverFill : '#cbd5e1',
                            stroke: '#064e3b',
                            strokeWidth: 2.2,
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: {
                            fill: zoneCfg.activeFill,
                            stroke: '#064e3b',
                            strokeWidth: 2.5,
                            outline: 'none',
                          },
                        } as any}
                      />
                    );
                  })
                }
              </Geographies>

              {/* State Labels & Markers positioned at real WGS84 coordinates - Well-labeled for all states */}
              {Object.entries(STATE_GEO_COORDS).map(([name, [lon, lat]]) => {
                const stateData = findStateByTopoName(name);
                if (!stateData) return null;
                const matchesZone =
                  activeZoneFilter === 'ALL' || stateData.zone === activeZoneFilter;
                const isSelected = activeState.id === stateData.id;

                return (
                  <Marker key={name} coordinates={[lon, lat]}>
                    <g className="pointer-events-none select-none">
                      <circle
                        r={isSelected ? 3.5 : 1.8}
                        fill={isSelected ? '#064e3b' : matchesZone ? '#0f172a' : '#94a3b8'}
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                      <text
                        textAnchor="middle"
                        y={-4.5}
                        style={{
                          paintOrder: 'stroke fill',
                          stroke: '#ffffff',
                          strokeWidth: '2.5px',
                          strokeLinecap: 'round',
                          strokeLinejoin: 'round',
                        }}
                        className={`text-[7.5px] font-bold ${
                          isSelected
                            ? 'fill-emerald-950 font-black text-[9px]'
                            : matchesZone
                            ? 'fill-slate-900 font-extrabold'
                            : 'fill-slate-400 font-medium'
                        }`}
                      >
                        {stateData.name}
                      </text>
                    </g>
                  </Marker>
                );
              })}
            </ComposableMap>
          </div>

          {/* Map Hover Indicator Bar */}
          <div className="mt-3 w-full bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
              <span className="text-[11.5px]">
                {hoveredState ? (
                  <>
                    <strong className="text-slate-900">{hoveredState.name} State</strong> (
                    {hoveredState.zone}) • {hoveredState.lgaCount} LGAs
                    {hoveredState.lcdaCount ? ` + ${hoveredState.lcdaCount} LCDAs` : ''} •{' '}
                    Governor: {hoveredState.governor}
                  </>
                ) : (
                  <>Active: <strong className="text-slate-900">{activeState.name} State</strong> ({activeState.zone})</>
                )}
              </span>
            </div>
            <span className="text-emerald-700 font-bold text-[11px] shrink-0">Click to Select</span>
          </div>
        </div>

        {/* Selected State Dossier (Right Column) */}
        <div className="lg:col-span-5 flex flex-col h-full justify-between bg-slate-50/70 border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-2xs">
          <div>
            {/* Header with Zone Badge & Flag */}
            <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      ZONE_CONFIG[activeState.zone]?.badgeBg || 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {activeState.zone}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">CODE: {activeState.code}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 tracking-tight">
                  {activeState.name} State
                </h3>
                <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                  State Capital: <strong className="text-slate-800">{activeState.capital}</strong>
                </p>
              </div>

              {/* Insignia / Flag display */}
              {activeState.flagUrl ? (
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <img
                    src={activeState.flagUrl}
                    alt={`${activeState.name} Flag`}
                    className="w-14 h-9 rounded-lg object-cover border border-slate-200 shadow-2xs"
                  />
                  <span className="text-[9px] font-bold text-slate-500 uppercase">State Flag</span>
                </div>
              ) : (
                <div className="w-12 h-8 rounded-lg overflow-hidden border border-slate-200 shadow-2xs flex shrink-0">
                  <div className="w-1/3 h-full bg-[#008751]" />
                  <div className="w-1/3 h-full bg-white" />
                  <div className="w-1/3 h-full bg-[#008751]" />
                </div>
              )}
            </div>

            {/* Special Callout for Lagos Constitutional Architecture */}
            {activeState.id === 'state_lagos' && (
              <div className="mt-5 p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-xs text-emerald-950 leading-relaxed shadow-2xs">
                <div className="flex items-center gap-1.5 font-extrabold text-emerald-900 mb-1">
                  <FileCheck2 className="w-4 h-4 text-emerald-700" />
                  <span>1999 Constitution & Grassroots Architecture</span>
                </div>
                Lagos has <strong>20 constitutionally recognized LGAs</strong> in the 1999 Constitution
                of Nigeria, augmented by <strong>37 State-created LCDAs</strong>, serving{' '}
                <strong>377 Electoral Wards</strong> across 57 local council secretariats.
              </div>
            )}

            {/* Numerical Governance Metrics Grid */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Const. LGAs
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
                  {activeState.lgaCount}
                </span>
                <span className="text-[10px] text-slate-400">1999 Constitution</span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {activeState.lcdaCount ? 'State LCDAs' : 'Total Councils'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 block">
                  {activeState.lcdaCount || activeState.lgaCount}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeState.lcdaCount ? '37 Local Councils' : 'Recognized Councils'}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  {activeState.wardCount ? 'Electoral Wards' : 'Est. Population'}
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-900 mt-1 block">
                  {activeState.wardCount || activeState.population}
                </span>
                <span className="text-[10px] text-slate-400">
                  {activeState.wardCount ? 'Grassroots Wards' : 'Citizens'}
                </span>
              </div>
            </div>

            {/* Verified Key Personnel with Real Headshots */}
            <div className="mt-6 space-y-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {activeState.governorPhoto ? (
                    <img
                      src={activeState.governorPhoto}
                      alt={activeState.governor}
                      className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-600 shadow-2xs"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center font-bold text-emerald-800">
                      {activeState.code}
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Executive Governor
                    </span>
                    <div className="font-extrabold text-slate-900 text-sm sm:text-base mt-0.5">
                      {activeState.governor}
                    </div>
                    {activeState.deputyGovernor && (
                      <span className="text-[11px] text-slate-500 block">
                        Dep: {activeState.deputyGovernor}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 shrink-0">
                  Executive
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Commissioner of Police (CP)
                  </span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{activeState.cpName}</div>
                </div>
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              </div>
            </div>
          </div>

          {/* Drill Down Action Button */}
          <div className="mt-8 pt-5 border-t border-slate-100">
            <button
              onClick={() => onDrillDownState(activeState.id)}
              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm sm:text-base shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Inspect {activeState.name} State Command & LGAs</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2">
              Drill down into Executive Cabinet, CP Headquarters, and 774 LGA/Ward Emergency Panels
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
