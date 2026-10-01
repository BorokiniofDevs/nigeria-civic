import React, { useState } from 'react';
import {
  ArrowLeft,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  Building,
  UserCheck,
  AlertCircle,
  PhoneCall,
  Activity,
  Wrench,
  Truck,
  RefreshCw,
  PlusCircle,
  MapPin,
  ExternalLink,
  Search,
  Compass,
  FileCheck2,
  Award,
  Layers,
  Hospital,
  Siren,
  ChevronRight,
  Navigation,
  Map as MapIcon,
  Sparkles,
} from 'lucide-react';
import { Jurisdiction, OfficialProfile } from '../types/civic';
import {
  CONSTITUTIONAL_LAGOS_LGAS,
  getAllLcdas,
  CouncilDefinition,
  WardDefinition,
  generateGoogleMapsDirUrl,
  generateGoogleMapsEmbedUrl,
} from '../utils/data_source_handler';

interface LgaMicroViewProps {
  lga: Jurisdiction;
  parentState?: Jurisdiction;
  officials: OfficialProfile[];
  wards: Jurisdiction[];
  onBackToState: () => void;
  onOpenReportIncident: (jurisdictionId: string) => void;
  onTriggerSync: (profileId: string, position: string) => void;
}

export const LgaMicroView: React.FC<LgaMicroViewProps> = ({
  lga,
  parentState,
  officials,
  wards: propWards,
  onBackToState,
  onOpenReportIncident,
  onTriggerSync,
}) => {
  const [wardSearchQuery, setWardSearchQuery] = useState('');
  const [selectedWardFilter, setSelectedWardFilter] = useState<string>('ALL');
  const [mapMode, setMapMode] = useState<'embed' | 'image'>('embed');

  // Find rich CouncilDefinition from data_source_handler
  const allCouncils = [...CONSTITUTIONAL_LAGOS_LGAS, ...getAllLcdas()];
  const councilDef: CouncilDefinition | undefined =
    allCouncils.find((c) => c.id === lga.id) ||
    allCouncils.find(
      (c) =>
        c.name.toLowerCase().includes(lga.name.toLowerCase()) ||
        lga.name.toLowerCase().includes(c.name.toLowerCase()),
    );

  // If council has wards defined in data_source_handler, use them;
  // otherwise generate default constitutional wards from areas_covered
  const activeWards: WardDefinition[] =
    councilDef?.wards && councilDef.wards.length > 0
      ? councilDef.wards
      : (councilDef?.areas_covered || ['Central Ward', 'North Ward', 'South Ward', 'Commercial Axis']).map(
          (area, idx) => ({
            id: `ward_${lga.id}_${idx + 1}`,
            name: `Ward 0${idx + 1} (${area})`,
            code: `WD-0${idx + 1}`,
            zipcode: councilDef?.zipcode || lga.zipcode || '100001',
            parent_lga_id: lga.id,
            areas_covered: [area, `${area} Commercial Axis`, `${area} Residential Estate`],
            councilor_name: `Hon. Councilor ${area.split(' ')[0]}`,
            councilor_photo:
              idx % 2 === 0
                ? '/assets/officials/moyosore_ogunlewe.jpg'
                : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=faces',
            councilor_phone: `+234 803 555 ${1000 + idx * 11}`,
            councilor_office: `${councilDef?.secretariat_address || 'Council Secretariat'}, Ward Liaison Desk`,
            councilor_directions_url: generateGoogleMapsDirUrl(
              councilDef?.secretariat_address || `${lga.name} Secretariat, Lagos`,
              `Ward 0${idx + 1} Councilor Office`,
            ),
            phc_name: `${area} Primary Health Care Centre`,
            phc_address: `${area} Community Road, ${lga.name}, Lagos`,
            phc_phone: `+234 802 444 ${2000 + idx * 22}`,
            phc_directions_url: generateGoogleMapsDirUrl(
              `${area} Community Road, ${lga.name}, Lagos`,
              `${area} Primary Health Clinic`,
            ),
            dpo_name: `${councilDef?.dpo_division_head || 'NPF Divisional Command'} (${area} Outpost)`,
            dpo_division: `${area} Police Division`,
            dpo_address: `${area} Main Road, near Council Boundary, Lagos`,
            dpo_phone: councilDef?.dpo_phone || '+234 803 333 4455',
            dpo_directions_url: generateGoogleMapsDirUrl(
              `${area}, ${lga.name}, Lagos`,
              `${area} Police Division`,
            ),
            hospital_name: councilDef?.general_hospital || 'Lagos State General Hospital',
            hospital_address: councilDef?.general_hospital_address || 'General Hospital Road, Lagos',
            hospital_phone: councilDef?.general_hospital_phone || '+234 1 295 1120',
            hospital_directions_url:
              councilDef?.general_hospital_directions_url ||
              generateGoogleMapsDirUrl(
                councilDef?.general_hospital_address || 'Lagos State General Hospital',
                'General Hospital',
              ),
          }),
        );

  // Filter wards based on search query
  const filteredWards = activeWards.filter((w) => {
    if (selectedWardFilter !== 'ALL' && w.id !== selectedWardFilter) return false;
    if (!wardSearchQuery.trim()) return true;

    const query = wardSearchQuery.toLowerCase();
    const nameMatch = w.name.toLowerCase().includes(query);
    const codeMatch = w.code.toLowerCase().includes(query);
    const zipMatch = w.zipcode.includes(query);
    const areaMatch = w.areas_covered.some((a) => a.toLowerCase().includes(query));
    const councilorMatch = w.councilor_name.toLowerCase().includes(query);
    const dpoMatch = w.dpo_name.toLowerCase().includes(query);
    const phcMatch = w.phc_name.toLowerCase().includes(query);

    return nameMatch || codeMatch || zipMatch || areaMatch || councilorMatch || dpoMatch || phcMatch;
  });

  const chairmanPhoto =
    councilDef?.chairman_photo ||
    (lga.id.includes('kosofe') ? '/assets/officials/moyosore_ogunlewe.jpg' : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces');

  const chairmanName = councilDef?.chairman_name || 'Hon. Council Chairman';
  const secretariatAddress =
    councilDef?.secretariat_address ||
    `${lga.name} Secretariat, ${lga.capital || 'Lagos State'}, Nigeria`;
  const directionsUrl =
    councilDef?.secretariat_directions_url ||
    generateGoogleMapsDirUrl(secretariatAddress, `${lga.name} Secretariat`);

  const mapImageUrl =
    lga.map_image_url ||
    (lga.id.includes('kosofe') ? '/assets/lagos/kosofe_lga_map.png' : undefined);

  return (
    <div className="space-y-8 bg-white min-h-screen pb-16">
      {/* Navigation Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <button
          onClick={onBackToState}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 transition-all shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-emerald-700" />
          <span>← Back to {parentState?.name || 'Lagos'} State Command</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>{parentState?.name?.toUpperCase() || 'LAGOS'} STATE</span>
          <span>/</span>
          <span className="text-emerald-800 font-bold uppercase">{councilDef?.name || lga.name}</span>
          <span className="text-[10px] bg-emerald-50 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-bold">
            {councilDef?.tier || lga.tier} DIRECTORY
          </span>
        </div>
      </div>

      {/* LGA/LCDA Banner with Executive Summary & Fast Actions */}
      <div className="bg-slate-950 text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg relative overflow-hidden">
        {/* Subtle Lagos Flag glow background */}
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-15 filter contrast-125"
          style={{ backgroundImage: `url('/assets/lagos/lagos_state_flag.gif')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-900/75 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-black uppercase px-3 py-1 rounded-full bg-emerald-600 text-white shadow-2xs">
                {councilDef?.tier === 'LCDA'
                  ? 'State-Created LCDA'
                  : 'Constitutional LGA (1999 Constitution)'}
              </span>
              <span className="text-xs bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full font-mono font-bold backdrop-blur-xs">
                Postal / ZIP: <strong className="text-emerald-300">{councilDef?.zipcode || lga.zipcode || '100242'}</strong>
              </span>
              <span className="text-xs bg-white/10 border border-white/20 text-white px-3 py-1 rounded-full font-medium backdrop-blur-xs">
                Secretariat HQ: <strong className="text-slate-200">{councilDef?.capital || lga.capital}</strong>
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {councilDef?.name || lga.name}
            </h1>

            <p className="text-slate-200 text-sm sm:text-base leading-relaxed">
              Official municipal secretariat, assigned Divisional Police Officer (DPO) command, Primary Health Care (PHC) clinics, and grassroots councilors across all constituent electoral wards.
            </p>

            <div className="pt-2 flex flex-wrap gap-4 sm:gap-6 text-xs text-slate-200">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span>Electoral Wards: <strong className="text-white font-bold">{activeWards.length} Wards</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Est. Population: <strong className="text-white font-bold">{councilDef?.population_est || lga.population_est || '650,000+'}</strong></span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Police Division: <strong className="text-white font-bold">{councilDef?.dpo_division_head || 'NPF Command'}</strong></span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full lg:w-auto">
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white text-slate-950 hover:bg-slate-100 px-5 py-3 rounded-2xl font-bold text-sm shadow-md transition"
            >
              <Navigation className="w-4 h-4 text-emerald-700" />
              <span>Get Directions to Secretariat</span>
            </a>
            <button
              onClick={() => onOpenReportIncident(lga.id)}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl font-bold text-sm shadow-md transition cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Local Incident</span>
            </button>
          </div>
        </div>
      </div>

      {/* Leadership & Geographic Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Map & Secretariat Directions */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                Council Geography & Secretariat
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                Location & Boundary Map
              </h3>
            </div>

            {mapImageUrl && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setMapMode('embed')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    mapMode === 'embed' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Live Map
                </button>
                <button
                  onClick={() => setMapMode('image')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                    mapMode === 'image' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Area Map
                </button>
              </div>
            )}
          </div>

          <div className="mt-4">
            {mapMode === 'embed' || !mapImageUrl ? (
              <div className="rounded-2xl overflow-hidden border border-slate-200 h-[280px] relative shadow-2xs">
                <iframe
                  title={`${councilDef?.name || lga.name} Map Location`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(secretariatAddress)}&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                  className="w-full h-full border-0"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col items-center justify-center">
                <img
                  src={mapImageUrl}
                  alt={`${lga.name} Boundary Map`}
                  className="max-h-[260px] object-contain rounded-xl"
                />
              </div>
            )}
          </div>

          <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block font-bold">Secretariat Physical Address:</strong>
                <span>{secretariatAddress}</span>
              </div>
            </div>

            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold inline-flex items-center gap-1.5 shrink-0 shadow-2xs"
            >
              <Navigation className="w-3 h-3" />
              <span>How to get there</span>
            </a>
          </div>

          {/* Areas Covered Pills */}
          {councilDef?.areas_covered && councilDef.areas_covered.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                Constituent Areas & Neighborhoods:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {councilDef.areas_covered.map((area, i) => (
                  <span
                    key={i}
                    className="text-xs bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg font-medium"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Executive Council Officials & First Responders */}
        <div className="lg:col-span-6 space-y-4">
          {/* Executive Chairman Card */}
          <div className="bg-white rounded-3xl border-2 border-emerald-600 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-700 text-white tracking-wider">
                Executive Chairman
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {councilDef?.tier || lga.tier} CHIEF EXECUTIVE
              </span>
            </div>

            <div className="mt-3.5 flex items-start gap-4">
              <img
                src={chairmanPhoto}
                alt={chairmanName}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-600 shrink-0 shadow-xs"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-900 text-base leading-tight">
                  {chairmanName}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {councilDef?.chairman_title || `Executive Chairman, ${lga.name}`}
                </p>

                <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
                  <a
                    href={`tel:${councilDef?.chairman_phone || '+234 803 300 1122'}`}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg font-mono font-bold inline-flex items-center gap-1 hover:bg-emerald-100"
                  >
                    <Phone className="w-3 h-3 text-emerald-700" />
                    <span>{councilDef?.chairman_phone || '+234 803 300 1122'}</span>
                  </a>
                  {councilDef?.chairman_email && (
                    <a
                      href={`mailto:${councilDef.chairman_email}`}
                      className="px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-mono text-[11px] inline-flex items-center gap-1 hover:bg-slate-100"
                    >
                      <Mail className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[150px]">{councilDef.chairman_email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Other Council Executives */}
            {councilDef?.vice_chairman && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">Vice Chairman</span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {councilDef.vice_chairman}
                  </span>
                </div>
                {councilDef.slg_name && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Secretary (SLG)</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5">
                      {councilDef.slg_name}
                    </span>
                  </div>
                )}
                {councilDef.council_leader && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Council Leader</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5">
                      {councilDef.council_leader}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DPO Police Headquarters Card */}
          <div className="bg-white rounded-3xl border-2 border-sky-300 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-sky-700 text-white tracking-wider flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>Divisional Police Headquarters</span>
              </span>
              <span className="text-xs text-sky-800 font-bold">Nigeria Police Force</span>
            </div>

            <div className="mt-3 space-y-1.5 text-xs text-slate-700">
              <h5 className="font-extrabold text-slate-900 text-sm">
                {councilDef?.dpo_division_head || 'NPF Divisional Headquarters'}
              </h5>
              <p className="text-slate-600 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{councilDef?.dpo_station_address || `${lga.name} Divisional Police Station, Lagos`}</span>
              </p>
            </div>

            <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
              <a
                href={`tel:${councilDef?.dpo_phone || '+234 803 333 4455'}`}
                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white rounded-xl text-xs font-bold font-mono inline-flex items-center gap-1.5 shadow-2xs transition"
              >
                <PhoneCall className="w-3 h-3" />
                <span>{councilDef?.dpo_phone || '+234 803 333 4455'}</span>
              </a>

              <a
                href={generateGoogleMapsDirUrl(
                  councilDef?.dpo_station_address || `${lga.name} Police Station, Lagos`,
                  'Police Divisional Headquarters',
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
              >
                <Navigation className="w-3 h-3 text-sky-700" />
                <span>How to get there</span>
              </a>
            </div>
          </div>

          {/* General Hospital / Emergency Card */}
          {councilDef?.general_hospital && (
            <div className="bg-white rounded-3xl border-2 border-emerald-300 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-700 text-white tracking-wider flex items-center gap-1">
                  <Hospital className="w-3 h-3" />
                  <span>State-Owned General Hospital</span>
                </span>
                <span className="text-xs text-emerald-800 font-bold">Lagos Health Service</span>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-700">
                <h5 className="font-extrabold text-slate-900 text-sm">
                  {councilDef.general_hospital}
                </h5>
                <p className="text-slate-600 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{councilDef.general_hospital_address}</span>
                </p>
              </div>

              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <a
                  href={`tel:${councilDef.general_hospital_phone || '+234 1 295 1120'}`}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold font-mono inline-flex items-center gap-1.5 shadow-2xs transition"
                >
                  <Phone className="w-3 h-3" />
                  <span>{councilDef.general_hospital_phone}</span>
                </a>

                <a
                  href={councilDef.general_hospital_directions_url || directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition"
                >
                  <Navigation className="w-3 h-3 text-emerald-700" />
                  <span>How to get there</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Electoral Wards & Grassroots Facilities Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                Electoral Wards & Grassroots Public Facilities
              </h3>
              <span className="text-xs bg-emerald-100 text-emerald-900 px-3 py-1 rounded-full font-bold">
                {activeWards.length} Wards
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              Assigned Ward Councilor, Primary Health Care (PHC) Clinic, Police Outpost, and constituent neighborhoods.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ward, street, clinic..."
              value={wardSearchQuery}
              onChange={(e) => setWardSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Wards Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWards.map((ward) => (
            <div
              key={ward.id}
              className="bg-white border border-slate-200 hover:border-emerald-600 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                    WARD {ward.code}
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">
                    ZIP: {ward.zipcode}
                  </span>
                </div>

                <h4 className="font-extrabold text-slate-900 text-base mt-2">
                  {ward.name}
                </h4>

                {/* Areas Covered */}
                <div className="mt-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Areas & Streets:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {ward.areas_covered.map((a, i) => (
                      <span
                        key={i}
                        className="text-[10.5px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Councilor */}
                <div className="mt-3.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={ward.councilor_photo}
                      alt={ward.councilor_name}
                      className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block">Councilor</span>
                      <span className="font-bold text-slate-900 text-xs truncate block">
                        {ward.councilor_name}
                      </span>
                    </div>
                  </div>
                  <a
                    href={`tel:${ward.councilor_phone}`}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Health Centre (PHC) & Police Outpost */}
                <div className="mt-3 space-y-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-emerald-900 font-bold text-[11px]">
                        <Hospital className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{ward.phc_name}</span>
                      </div>
                      <a
                        href={ward.phc_directions_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-emerald-800 font-bold hover:underline"
                      >
                        Directions →
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{ward.phc_address}</p>
                    <div className="flex items-center gap-1 text-[11px] text-emerald-800 font-mono font-bold">
                      <Phone className="w-3 h-3" />
                      <span>{ward.phc_phone}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-sky-900 font-bold text-[11px]">
                        <Shield className="w-3.5 h-3.5 text-sky-700" />
                        <span>{ward.dpo_name}</span>
                      </div>
                      <a
                        href={ward.dpo_directions_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-sky-800 font-bold hover:underline"
                      >
                        Directions →
                      </a>
                    </div>
                    <p className="text-[11px] text-slate-600 truncate">{ward.dpo_address}</p>
                    <div className="flex items-center gap-1 text-[11px] text-sky-800 font-mono font-bold">
                      <PhoneCall className="w-3 h-3" />
                      <span>{ward.dpo_phone}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">
                  Constituent of <strong className="text-slate-800">{councilDef?.name || lga.name}</strong>
                </span>
                <button
                  onClick={() => onOpenReportIncident(lga.id)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>Report Issue</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
