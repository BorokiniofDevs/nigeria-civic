import React, { useState } from 'react';
import {
  ArrowLeft,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  Building2,
  ChevronRight,
  RefreshCw,
  Landmark,
  MapPin,
  ExternalLink,
  Users,
  Compass,
  FileCheck2,
  AlertCircle,
  Award,
  Layers,
  Search,
  Hospital,
  Siren,
  Navigation,
  Map as MapIcon,
  PhoneCall,
  Sparkles,
} from 'lucide-react';
import { Jurisdiction, OfficialProfile } from '../types/civic';
import { ZONE_CONFIG } from './NigeriaInteractiveMap';
import {
  CONSTITUTIONAL_LAGOS_LGAS,
  LAGOS_LCDAS_MAP,
  getAllLcdas,
  CouncilDefinition,
  generateGoogleMapsDirUrl,
  generateGoogleMapsEmbedUrl,
  generateGoogleMapsSearchUrl,
} from '../utils/data_source_handler';

interface StateHubViewProps {
  state: Jurisdiction;
  officials: OfficialProfile[];
  subJurisdictions: Jurisdiction[];
  onBackToStates: () => void;
  onSelectLga: (lgaId: string) => void;
  onTriggerSync: (profileId: string, position: string) => void;
}

export const StateHubView: React.FC<StateHubViewProps> = ({
  state,
  officials,
  subJurisdictions,
  onBackToStates,
  onSelectLga,
  onTriggerSync,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'cabinet' | 'lgas' | 'lcdas' | 'facilities'>('profile');
  const [searchQuery, setSearchQuery] = useState('');
  const [mapDisplayMode, setMapDisplayMode] = useState<'live_google' | 'admin_vector'>('live_google');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<'ALL' | 'POLICE' | 'HOSPITAL' | 'EMERGENCY'>('ALL');

  const isLagos = state.id === 'state_lagos';

  // Filter officials for this state
  const stateOfficials = officials.filter(
    (o) =>
      o.jurisdiction_id === state.id ||
      o.jurisdiction_id.includes(state.name.toLowerCase()),
  );

  const governor =
    stateOfficials.find(
      (o) =>
        o.badge_title?.includes('Governor') && !o.badge_title?.includes('Deputy'),
    ) ||
    stateOfficials.find(
      (o) =>
        o.position_title.toLowerCase().includes('governor') &&
        !o.position_title.toLowerCase().includes('deputy'),
    );

  const deputyGovernor =
    stateOfficials.find((o) => o.badge_title?.includes('Deputy Governor')) ||
    stateOfficials.find((o) =>
      o.position_title.toLowerCase().includes('deputy governor'),
    );

  const policeCommissioner = stateOfficials.find(
    (o) =>
      o.badge_title?.includes('Commissioner of Police') ||
      o.position_title.toLowerCase().includes('commissioner of police'),
  );

  const speaker = stateOfficials.find((o) =>
    o.position_title.toLowerCase().includes('speaker'),
  );

  const commissioners = stateOfficials.filter(
    (o) =>
      o.id !== governor?.id &&
      o.id !== deputyGovernor?.id &&
      o.id !== policeCommissioner?.id &&
      o.id !== speaker?.id &&
      !o.badge_title?.includes('DPO') &&
      !o.badge_title?.includes('Chairman'),
  );

  // Group sub-jurisdictions into LGAs and LCDAs
  const lgas = subJurisdictions.filter((j) => j.tier === 'LGA');
  const lcdas = subJurisdictions.filter((j) => j.tier === 'LCDA');

  const zoneCfg =
    ZONE_CONFIG[state.zone as keyof typeof ZONE_CONFIG] || ZONE_CONFIG['South-West'];

  // All 20 constitutional LGAs from strict data source handler for Lagos
  const constitutionalLagosLgas = CONSTITUTIONAL_LAGOS_LGAS;
  const allLagosLcdas = getAllLcdas();

  const filteredConstitutionalLgas = constitutionalLagosLgas.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.capital.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.chairman_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.areas_covered.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredConstitutionalLcdas = allLagosLcdas.filter((lc) =>
    lc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lc.capital.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lc.chairman_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (lc.parent_lga_name && lc.parent_lga_name.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Key Facilities List across Lagos
  const lagosFacilities = [
    {
      name: 'Lagos State Police Command Headquarters',
      type: 'POLICE' as const,
      address: 'Police Command HQ, Muiz Banire Street, Ikeja GRA, Lagos',
      phone: '+234 806 329 9264',
      dpo_or_director: 'CP Olanrewaju Ishola (Commissioner of Police)',
      google_maps_url: generateGoogleMapsDirUrl('Lagos State Police Command Headquarters, Ikeja GRA, Lagos', 'Police Command HQ'),
    },
    {
      name: 'Area F Police Divisional Command (Ikeja)',
      type: 'POLICE' as const,
      address: 'Obafemi Awolowo Way, Ikeja, Lagos',
      phone: '+234 803 300 2211',
      dpo_or_director: 'ACP Police Command Division',
      google_maps_url: generateGoogleMapsDirUrl('Area F Police Headquarters, Ikeja, Lagos', 'Area F Police Command'),
    },
    {
      name: 'Lion Building Divisional Police Station (Lagos Island)',
      type: 'POLICE' as const,
      address: 'Campbell Street, Lagos Island, Lagos',
      phone: '+234 802 222 9901',
      dpo_or_director: 'CSP Lion Building Division',
      google_maps_url: generateGoogleMapsDirUrl('Lion Building Police Station, Campbell Street, Lagos Island', 'Lion Building Police'),
    },
    {
      name: 'Ogudu Police Divisional Headquarters (Kosofe)',
      type: 'POLICE' as const,
      address: 'Ogudu Road, Ogudu GRA, Kosofe, Lagos',
      phone: '+234 803 333 4455',
      dpo_or_director: 'CSP Ogundele Adeleke (DPO Ogudu)',
      google_maps_url: generateGoogleMapsDirUrl('Ogudu Police Station, Ogudu Road, Kosofe, Lagos', 'Ogudu Police Division'),
    },
    {
      name: 'Surulere Police Divisional Headquarters (Area C)',
      type: 'POLICE' as const,
      address: 'Barracks Bus Stop, Western Avenue, Surulere, Lagos',
      phone: '+234 803 777 8899',
      dpo_or_director: 'CSP Surulere Command',
      google_maps_url: generateGoogleMapsDirUrl('Area C Police Command, Barracks, Surulere, Lagos', 'Area C Police Command'),
    },
    {
      name: 'Lagos State Emergency Management Agency (LASEMA)',
      type: 'EMERGENCY' as const,
      address: 'LASEMA Command and Control Centre, Alausa, Ikeja, Lagos',
      phone: '112 / 767 (Toll-Free)',
      dpo_or_director: 'Dr. Olufemi Damilola Oke-Osanyintolu (Permanent Secretary)',
      google_maps_url: generateGoogleMapsDirUrl('LASEMA Response Centre, Alausa, Ikeja, Lagos', 'LASEMA Emergency Command'),
    },
    {
      name: 'Lagos State Fire and Rescue Service HQ',
      type: 'EMERGENCY' as const,
      address: 'Governor\'s Road, Alausa, Ikeja, Lagos',
      phone: '+234 1 797 0335 / 112',
      dpo_or_director: 'Mrs. Margaret Adeseye (Controller of Fire)',
      google_maps_url: generateGoogleMapsDirUrl('Lagos State Fire Service HQ, Alausa, Ikeja', 'Lagos Fire Service'),
    },
    {
      name: 'Lagos State Traffic Management Authority (LASTMA) HQ',
      type: 'EMERGENCY' as const,
      address: 'Oshodi-Apapa Expressway, Ilupeju / Oshodi, Lagos',
      phone: '0800 005 27862 (Toll Free)',
      dpo_or_director: 'Hon. Sola Giwa (Special Adviser Transportation)',
      google_maps_url: generateGoogleMapsDirUrl('LASTMA Headquarters, Oshodi, Lagos', 'LASTMA Headquarters'),
    },
    {
      name: 'Lagos State University Teaching Hospital (LASUTH)',
      type: 'HOSPITAL' as const,
      address: '1-5 Oba Akinjobi Way, Ikeja GRA, Ikeja, Lagos',
      phone: '+234 1 291 5566',
      dpo_or_director: 'Prof. Adetokunbo Fabamwo (Chief Medical Director)',
      google_maps_url: generateGoogleMapsDirUrl('LASUTH, Oba Akinjobi Way, Ikeja, Lagos', 'LASUTH General Hospital'),
    },
    {
      name: 'General Hospital Lagos (Odan, Marina)',
      type: 'HOSPITAL' as const,
      address: '1-3 Broad Street, Lagos Island, Lagos',
      phone: '+234 1 263 0451',
      dpo_or_director: 'Medical Director, General Hospital Lagos Island',
      google_maps_url: generateGoogleMapsDirUrl('General Hospital Lagos, Broad Street, Lagos Island', 'General Hospital Lagos Island'),
    },
    {
      name: 'Gbagada General Hospital & Trauma Centre',
      type: 'HOSPITAL' as const,
      address: '1 Hospital Road, Gbagada Phase 2, Kosofe, Lagos',
      phone: '+234 802 300 4455',
      dpo_or_director: 'Medical Director, Gbagada General Hospital',
      google_maps_url: generateGoogleMapsDirUrl('Gbagada General Hospital, Gbagada, Lagos', 'Gbagada General Hospital'),
    },
    {
      name: 'Randle General Hospital, Surulere',
      type: 'HOSPITAL' as const,
      address: 'Randle Avenue, Surulere, Lagos',
      phone: '+234 1 897 4433',
      dpo_or_director: 'Medical Director, Randle General Hospital',
      google_maps_url: generateGoogleMapsDirUrl('Randle General Hospital, Randle Avenue, Surulere, Lagos', 'Randle General Hospital'),
    },
  ];

  const filteredFacilities = lagosFacilities.filter((f) => {
    const matchesType = facilityTypeFilter === 'ALL' || f.type === facilityTypeFilter;
    const matchesSearch =
      searchQuery.trim() === '' ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.dpo_or_director && f.dpo_or_director.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const flagUrl = '/assets/lagos/lagos_state_flag.gif';
  const sealUrl = '/assets/lagos/lagos_state_seal.png';
  const mapUrl = '/assets/lagos/lagos_state_map.png';

  // IBILE Divisions data
  const ibileDivisions = [
    {
      code: 'I',
      name: 'Ikeja Division',
      hq: 'Alausa Secretariat (State Capital)',
      councils: 'Ikeja, Agege, Alimosho, Ifako-Ijaiye, Kosofe, Oshodi-Isolo, Somolu',
      color: '#059669',
    },
    {
      code: 'B',
      name: 'Badagry Division',
      hq: 'Badagry Ancient Town',
      councils: 'Badagry, Ajeromi-Ifelodun, Amuwo-Odofin, Ojo',
      color: '#0284c7',
    },
    {
      code: 'I',
      name: 'Ikorodu Division',
      hq: 'Ikorodu Town Centre',
      councils: 'Ikorodu Local Government & 5 LCDAs',
      color: '#d97706',
    },
    {
      code: 'L',
      name: 'Lagos Island Division',
      hq: 'City Hall, Lagos Marina',
      councils: 'Lagos Island, Lagos Mainland, Surulere, Apapa, Eti-Osa',
      color: '#7c3aed',
    },
    {
      code: 'E',
      name: 'Epe Division',
      hq: 'Epe Marina Town',
      councils: 'Epe, Ibeju-Lekki & 4 LCDAs',
      color: '#dc2626',
    },
  ];

  return (
    <div className="space-y-8 bg-white min-h-screen pb-16">
      {/* Navigation Breadcrumbs & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <button
          onClick={onBackToStates}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 transition-all shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-700" />
          <span>← Back to National 36 States Directory</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>FEDERAL REPUBLIC</span>
          <span>/</span>
          <span className="text-emerald-800 font-bold uppercase">{state.name} STATE</span>
          <span className="text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
            STATE PROFILE
          </span>
        </div>
      </div>

      {/* State Executive Hero Banner with Lagos State Flag as Faded Background */}
      <div className="rounded-3xl border border-slate-300/80 bg-slate-950 text-white p-6 sm:p-8 lg:p-10 shadow-lg relative overflow-hidden">
        {/* Lagos State Flag as Background Image with Faded Opacity for Optimal Contrast */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-20 filter contrast-125"
          style={{ backgroundImage: `url('${flagUrl}')` }}
        />
        {/* Dark Vignette Gradient Overlay ensuring all text remains crisp and readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-900/75 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-8">
          <div className="space-y-3.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
                Centre of Excellence
              </span>
              <span className="text-xs bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full font-bold backdrop-blur-xs">
                Capital: <strong className="text-emerald-300">Ikeja (Alausa)</strong>
              </span>
              <span className="text-xs bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full font-bold backdrop-blur-xs">
                Motto: <strong className="text-slate-200">"Justice and Progress"</strong>
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Lagos State Profile & Civic Governance Hub
            </h1>

            <p className="text-slate-200 text-sm sm:text-base leading-relaxed font-normal">
              Official Executive Secretariat, Legislative Assembly, and Police Command. Constitutional anchor for{' '}
              <strong className="text-white font-bold">20 Constitutional LGAs</strong> (1999 Constitution),{' '}
              <strong className="text-emerald-300 font-bold">37 State-Created LCDAs</strong>, and{' '}
              <strong className="text-white font-bold">377 Grassroots Electoral Wards</strong> across the 5 IBILE Divisions.
            </p>

            {/* Quick Metrics Counter Row */}
            <div className="pt-2 flex flex-wrap gap-4 sm:gap-6 text-xs text-slate-200">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Constitutional LGAs: <strong className="text-white font-bold">20</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
                <span>State LCDAs: <strong className="text-emerald-300 font-bold">37</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Electoral Wards: <strong className="text-white font-bold">377</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Est. Population: <strong className="text-white font-bold">15.5M+</strong></span>
              </div>
            </div>
          </div>

          {/* Insignia Badges: State Flag & Seal */}
          <div className="flex sm:flex-row lg:flex-col items-center sm:items-start gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shrink-0">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <img
                  src={flagUrl}
                  alt="Lagos State Flag"
                  className="w-20 h-13 object-cover rounded-lg border border-white/30 shadow-md"
                />
                <span className="text-[10px] font-bold text-slate-300 uppercase mt-1 block">
                  State Flag
                </span>
              </div>

              <div className="text-center">
                <img
                  src={sealUrl}
                  alt="Lagos State Seal"
                  className="w-14 h-14 object-contain rounded-lg border border-white/30 bg-white p-1 shadow-md"
                />
                <span className="text-[10px] font-bold text-slate-300 uppercase mt-1 block">
                  State Seal
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-300 font-medium sm:border-l lg:border-l-0 lg:border-t border-white/15 sm:pl-4 lg:pl-0 lg:pt-2">
              <span className="font-bold text-white block">Secretariat Location:</span>
              Alausa, Ikeja, Lagos State
            </div>
          </div>
        </div>

        {/* View Tabs Bar */}
        <div className="relative z-10 mt-8 pt-5 border-t border-white/15 flex flex-wrap items-center gap-2.5">
          {[
            { id: 'profile', label: 'State Map & Administrative Geography' },
            { id: 'cabinet', label: `Executive Cabinet & Leadership (${stateOfficials.length})` },
            { id: 'lgas', label: 'Constitutional 20 LGAs' },
            { id: 'lcdas', label: '37 State LCDAs' },
            { id: 'facilities', label: 'Police, Hospitals & Emergency' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                    : 'bg-white/10 text-white hover:bg-white/20 border border-white/15'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 0: Lagos Administrative & Geographic Map Profile */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Map Box with Live Google Maps & Administrative Map Toggle */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Territorial Topography & Geocoding
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    Lagos State Geographic Map
                  </h3>
                </div>

                {/* Map Toggle Switch */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    onClick={() => setMapDisplayMode('live_google')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      mapDisplayMode === 'live_google'
                        ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Live Google Map</span>
                  </button>
                  <button
                    onClick={() => setMapDisplayMode('admin_vector')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      mapDisplayMode === 'admin_vector'
                        ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapIcon className="w-3.5 h-3.5 text-slate-600" />
                    <span>Admin Divisions Map</span>
                  </button>
                </div>
              </div>

              {/* Map Render Frame */}
              <div className="mt-5">
                {mapDisplayMode === 'live_google' ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-300 shadow-xs h-[420px]">
                    <iframe
                      title="Lagos State Secretariat and Municipal Geography"
                      src="https://maps.google.com/maps?q=Lagos+State+Government+Secretariat+Alausa+Ikeja&t=&z=12&ie=UTF8&iwloc=&output=embed"
                      className="w-full h-full border-0"
                      loading="lazy"
                      allowFullScreen
                    />
                    <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs shadow-md flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      <span className="font-bold text-slate-800">
                        Live Centered: Alausa Secretariat, Ikeja
                      </span>
                      <a
                        href={generateGoogleMapsDirUrl('Lagos State Government Secretariat, Alausa, Ikeja, Lagos', 'Lagos Secretariat')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 font-bold hover:underline ml-2"
                      >
                        Directions →
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-col items-center justify-center overflow-hidden">
                    <img
                      src={mapUrl}
                      alt="Lagos State Administrative Map"
                      className="w-full max-h-[380px] object-contain rounded-xl hover:scale-105 transition-transform duration-300"
                    />
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Official 5-Division administrative framework (Ikeja, Badagry, Ikorodu, Lagos Island, Epe).
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: 5 IBILE Divisions of Lagos */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <Compass className="w-4 h-4 text-emerald-700" />
                    <span>5 Administrative Divisions (IBILE)</span>
                  </h4>
                  <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                    Historic Framework
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {ibileDivisions.map((div) => (
                    <div
                      key={div.name}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50/70 hover:bg-white transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-7 h-7 rounded-lg text-white font-black flex items-center justify-center text-xs shadow-2xs"
                            style={{ backgroundColor: div.color }}
                          >
                            {div.code}
                          </span>
                          <div>
                            <h5 className="font-extrabold text-slate-900 text-sm">
                              {div.name}
                            </h5>
                            <span className="text-[11px] text-slate-500 font-medium">
                              HQ: {div.hq}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-2 font-medium">
                        Councils: <span className="text-slate-800 font-semibold">{div.councils}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Constitutional Architecture Banner */}
              <div className="bg-emerald-50/90 border border-emerald-300 rounded-3xl p-5 shadow-2xs">
                <div className="flex items-start gap-3">
                  <FileCheck2 className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-sm">
                      1999 Constitutional Guarantee
                    </h5>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                      Lagos State comprises <strong>20 constitutionally recognized LGAs</strong> in the First Schedule, Part I of the 1999 Constitution, supplemented by <strong>37 State-Created LCDAs</strong> serving <strong>377 Electoral Wards</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 1: Executive Cabinet, Police Commissioner & Key Leaders */}
      {activeTab === 'cabinet' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Lagos State Executive Council & Police Command
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Real public record contacts, verified official headshots, and physical office directions.
              </p>
            </div>
          </div>

          {/* Leadership Triad: Governor, Deputy Gov, Speaker, CP */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Governor */}
            {governor && (
              <div className="bg-white border-2 border-emerald-600 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-700 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                  Executive Governor
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={governor.photo_url || '/assets/officials/gov_sanwo_olu.jpg'}
                      alt={governor.full_name}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-600 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        <span>State Executive</span>
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight truncate mt-0.5">
                        {governor.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {governor.position_title}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Desk Phone:</span>
                      <a href={`tel:${governor.public_phone}`} className="font-mono font-bold text-emerald-800 hover:underline">
                        {governor.public_phone}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Email:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]">{governor.public_email}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Office: Lagos House, Alausa, Ikeja
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={generateGoogleMapsDirUrl('Lagos House, Alausa, Ikeja, Lagos', 'Lagos House Alausa')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>How to get there</span>
                  </a>
                  <button
                    onClick={() => onTriggerSync(governor.id, governor.position_title)}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            )}

            {/* Deputy Governor */}
            {deputyGovernor && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-700 text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                  Deputy Governor
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={deputyGovernor.photo_url || '/assets/officials/dep_gov_hamzat.jpg'}
                      alt={deputyGovernor.full_name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Executive Office</span>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight truncate mt-0.5">
                        {deputyGovernor.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {deputyGovernor.position_title}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Desk Phone:</span>
                      <a href={`tel:${deputyGovernor.public_phone}`} className="font-mono font-bold text-emerald-800 hover:underline">
                        {deputyGovernor.public_phone}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Email:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]">{deputyGovernor.public_email}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Office: Roundhouse, Secretariat, Alausa
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={generateGoogleMapsDirUrl('Deputy Governor Office, Alausa, Ikeja, Lagos', 'Deputy Governor Office')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>How to get there</span>
                  </a>
                  <button
                    onClick={() => onTriggerSync(deputyGovernor.id, deputyGovernor.position_title)}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            )}

            {/* Speaker House of Assembly */}
            {speaker && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-slate-100 text-slate-700 text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                  Speaker, Assembly
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={speaker.photo_url || '/assets/officials/speaker_obasa.jpg'}
                      alt={speaker.full_name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-purple-800 uppercase">Legislative Arm</span>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight truncate mt-0.5">
                        {speaker.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {speaker.position_title}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Assembly Line:</span>
                      <a href={`tel:${speaker.public_phone}`} className="font-mono font-bold text-emerald-800 hover:underline">
                        {speaker.public_phone}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Email:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]">{speaker.public_email}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Office: Assembly Complex, Alausa, Ikeja
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={generateGoogleMapsDirUrl('Lagos State House of Assembly, Alausa, Ikeja, Lagos', 'House of Assembly')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>How to get there</span>
                  </a>
                  <button
                    onClick={() => onTriggerSync(speaker.id, speaker.position_title)}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            )}

            {/* Commissioner of Police */}
            {policeCommissioner && (
              <div className="bg-white border-2 border-sky-300 rounded-2xl p-4 shadow-xs flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-sky-700 text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                  State Police CP
                </div>

                <div>
                  <div className="flex items-center gap-3">
                    <img
                      src={policeCommissioner.photo_url || '/assets/officials/lagos_cp_police.jpg'}
                      alt={policeCommissioner.full_name}
                      className="w-14 h-14 rounded-xl object-cover border-2 border-sky-600 shrink-0 shadow-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-sky-800 uppercase flex items-center gap-1">
                        <Shield className="w-3 h-3 text-sky-700" />
                        <span>Security Command</span>
                      </span>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight truncate mt-0.5">
                        {policeCommissioner.full_name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {policeCommissioner.position_title}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Control Room:</span>
                      <a href={`tel:${policeCommissioner.public_phone}`} className="font-mono font-bold text-sky-800 hover:underline">
                        {policeCommissioner.public_phone}
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span>Email:</span>
                      <span className="font-mono text-slate-800 truncate max-w-[150px]">{policeCommissioner.public_email}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1">
                      Office: Police Command HQ, Ikeja GRA
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <a
                    href={generateGoogleMapsDirUrl('Lagos State Police Command Headquarters, Ikeja GRA, Lagos', 'Police Command HQ')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-800 hover:underline"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>How to get there</span>
                  </a>
                  <button
                    onClick={() => onTriggerSync(policeCommissioner.id, policeCommissioner.position_title)}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sync</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Commissioners Grid */}
          <div className="space-y-3 pt-3">
            <h4 className="font-extrabold text-slate-900 text-base">
              Lagos State Cabinet Commissioners
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {commissioners.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-white border border-slate-200 hover:border-emerald-600 rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <img
                        src={comm.photo_url}
                        alt={comm.full_name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                          {comm.sector}
                        </span>
                        <h5 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate mt-1">
                          {comm.full_name}
                        </h5>
                        <p className="text-[11px] text-slate-600 truncate font-medium">
                          {comm.position_title}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span className="font-mono text-slate-900 font-semibold">{comm.public_phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-700">{comm.public_email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                    <a
                      href={generateGoogleMapsDirUrl(`Ministry of ${comm.sector.toLowerCase()}, Alausa Secretariat, Ikeja, Lagos`, `${comm.position_title}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:underline font-bold inline-flex items-center gap-1"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                    <button
                      onClick={() => onTriggerSync(comm.id, comm.position_title)}
                      className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Sync</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Strict 20 Constitutional LGAs */}
      {activeTab === 'lgas' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Lagos State: 20 Constitutional Local Government Areas
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full font-bold">
                  20 LGAs
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Strictly recognized in the 1999 Constitution (First Schedule, Part I). Click any LGA to inspect its Executive Chairman, DPO Police Station, General Hospital, and Electoral Wards.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search LGA, area, or chairman..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredConstitutionalLgas.map((lga) => {
              const subLcdas = LAGOS_LCDAS_MAP[lga.id] || [];
              return (
                <div
                  key={lga.id}
                  onClick={() => onSelectLga(lga.id)}
                  className="bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                        CONSTITUTIONAL LGA
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-mono font-semibold">
                        ZIP: {lga.zipcode}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-slate-900 text-base mt-2 group-hover:text-emerald-800 transition">
                      {lga.name}
                    </h4>

                    <p className="text-[11px] text-slate-600 mt-1 line-clamp-1">
                      HQ: <strong className="text-slate-800">{lga.capital}</strong> ({lga.secretariat_address.split(',')[1] || 'Secretariat'})
                    </p>

                    {/* Chairman Info */}
                    <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                      <img
                        src={lga.chairman_photo}
                        alt={lga.chairman_name}
                        className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-slate-500 uppercase block">Chairman</span>
                        <div className="font-bold text-slate-900 text-xs truncate">
                          {lga.chairman_name}
                        </div>
                      </div>
                    </div>

                    {/* DPO & Hospital quick tags */}
                    <div className="mt-3 space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Shield className="w-3 h-3 text-sky-700 shrink-0" />
                        <span className="truncate">DPO: <strong className="text-slate-800">{lga.dpo_division_head}</strong></span>
                      </div>
                      {lga.general_hospital && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Hospital className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span className="truncate">{lga.general_hospital}</span>
                        </div>
                      )}
                    </div>

                    {/* Sub-LCDAs chips */}
                    {subLcdas.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 block mb-1">
                          Sub-LCDAs ({subLcdas.length}):
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {subLcdas.map((lc) => (
                            <span
                              key={lc.id}
                              className="text-[9.5px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-medium"
                            >
                              {lc.name.replace('LCDA', '').replace('Local Council Development Area', '').trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-emerald-800">
                    <span>Inspect Wards & Facilities</span>
                    <ChevronRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: State LCDAs (37) */}
      {activeTab === 'lcdas' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Lagos State: 37 Local Council Development Areas (LCDAs)
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full font-bold">
                  37 LCDAs
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                State-created administrative councils bringing direct municipal representation, police divisions, and health centres closer to grassroots communities.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search LCDA or parent LGA..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredConstitutionalLcdas.map((lcda) => (
              <div
                key={lcda.id}
                onClick={() => onSelectLga(lcda.id)}
                className="bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-md flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                      STATE LCDA
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ZIP: {lcda.zipcode}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-base mt-2 group-hover:text-emerald-800 transition">
                    {lcda.name}
                  </h4>

                  <p className="text-xs text-slate-500 mt-1">
                    Parent LGA: <strong className="text-slate-800">{lcda.parent_lga_name || 'Lagos State'}</strong>
                  </p>

                  <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
                    <img
                      src={lcda.chairman_photo}
                      alt={lcda.chairman_name}
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Chairman</span>
                      <div className="font-bold text-slate-900 text-xs truncate">
                        {lcda.chairman_name}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5 truncate">
                      <Shield className="w-3 h-3 text-sky-700 shrink-0" />
                      <span className="truncate">DPO: <strong className="text-slate-800">{lcda.dpo_division_head}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 truncate text-slate-500">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{lcda.secretariat_address}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-emerald-800">
                  <span>Inspect LCDA & Wards</span>
                  <ChevronRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-1.5 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Police Stations, General Hospitals & Emergency Key Places */}
      {activeTab === 'facilities' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Key Public Facilities, Police Divisions & Emergency Hubs
                </h3>
                <span className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full font-bold">
                  Verified Locations
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1">
                Direct addresses, verified dispatch telephone numbers, and one-click Google Maps navigation directions.
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'ALL', label: 'All Places' },
                { id: 'POLICE', label: 'Police Stations' },
                { id: 'HOSPITAL', label: 'General Hospitals' },
                { id: 'EMERGENCY', label: 'Emergency (112/767)' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFacilityTypeFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    facilityTypeFilter === btn.id
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFacilities.map((fac, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl border border-slate-200 hover:border-emerald-600 bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-full ${
                        fac.type === 'POLICE'
                          ? 'bg-sky-100 text-sky-900 border border-sky-200'
                          : fac.type === 'HOSPITAL'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                          : 'bg-red-100 text-red-900 border border-red-200'
                      }`}
                    >
                      {fac.type === 'POLICE'
                        ? 'POLICE COMMAND'
                        : fac.type === 'HOSPITAL'
                        ? 'STATE GENERAL HOSPITAL'
                        : 'RAPID EMERGENCY RESPONSE'}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-base mt-2">
                    {fac.name}
                  </h4>

                  <p className="text-xs text-slate-600 mt-1 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{fac.address}</span>
                  </p>

                  {fac.dpo_or_director && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Lead: <strong className="text-slate-800">{fac.dpo_or_director}</strong>
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={`tel:${fac.phone.split('(')[0].trim()}`}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold font-mono inline-flex items-center gap-1.5 transition"
                  >
                    <Phone className="w-3 h-3 text-emerald-700" />
                    <span>{fac.phone}</span>
                  </a>

                  <a
                    href={fac.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Directions</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
