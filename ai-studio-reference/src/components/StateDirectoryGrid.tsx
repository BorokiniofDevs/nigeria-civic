import React, { useState } from 'react';
import {
  MapPin,
  Landmark,
  ChevronRight,
  Search,
  Filter,
  Users,
  Compass,
  Building,
  Award,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { Jurisdiction, GeopoliticalZone } from '../types/civic';
import { NigeriaInteractiveMap, ZONE_CONFIG } from './NigeriaInteractiveMap';

interface StateDirectoryGridProps {
  states: Jurisdiction[];
  onSelectState: (stateId: string) => void;
}

export const StateDirectoryGrid: React.FC<StateDirectoryGridProps> = ({
  states,
  onSelectState,
}) => {
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedMapStateId, setSelectedMapStateId] = useState<string | null>('state_lagos');

  const onlyStates = states
    .filter((j) => j.tier === 'STATE')
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredStates = onlyStates.filter((s) => {
    const matchesZone = selectedZone === 'ALL' || s.zone === selectedZone;
    const matchesQuery =
      filterQuery.trim() === '' ||
      s.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      (s.capital && s.capital.toLowerCase().includes(filterQuery.toLowerCase()));
    return matchesZone && matchesQuery;
  });

  const zones: { id: string; label: string; color: string }[] = [
    { id: 'ALL', label: 'All 36 States + FCT', color: '#0f172a' },
    { id: 'North-West', label: 'North-West (7)', color: '#008751' },
    { id: 'North-East', label: 'North-East (6)', color: '#0f766e' },
    { id: 'North-Central', label: 'North-Central (6+FCT)', color: '#b45309' },
    { id: 'South-West', label: 'South-West (6)', color: '#008751' },
    { id: 'South-East', label: 'South-East (5)', color: '#4338ca' },
    { id: 'South-South', label: 'South-South (6)', color: '#0369a1' },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Interactive SVG Map of 6 Geopolitical Zones */}
      <NigeriaInteractiveMap
        selectedStateId={selectedMapStateId}
        onSelectState={(stateId) => setSelectedMapStateId(stateId)}
        onDrillDownState={(stateId) => onSelectState(stateId)}
      />

      {/* 2. States Alphabetical Directory Section */}
      <section className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6 lg:p-7">
        {/* Directory Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 text-[10.5px] font-bold uppercase tracking-wider mb-1.5">
              <Landmark className="w-3.5 h-3.5 text-emerald-700" />
              National Geo-Hierarchy Directory
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              36 States & FCT Governance Registry
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-0.5 max-w-2xl">
              Constitutional breakdown across all 774 Local Government Areas, State Police Commissioners,
              and Executive Cabinets.
            </p>
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter states or capitals..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/20"
            />
          </div>
        </div>

        {/* Geopolitical Zones Pills Filter */}
        <div className="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-emerald-700" />
            <span>Zone:</span>
          </span>
          {zones.map((z) => {
            const isSelected = selectedZone === z.id;
            return (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border shadow-2xs cursor-pointer shrink-0 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: z.color }}
                />
                <span>{z.label}</span>
              </button>
            );
          })}
        </div>

        {/* 36 States + FCT Grid with subtle distinct surface shading */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredStates.map((state) => {
            const zoneCfg =
              ZONE_CONFIG[state.zone as GeopoliticalZone] || ZONE_CONFIG['South-West'];
            const isLagos = state.id === 'state_lagos';

            return (
              <div
                key={state.id}
                onClick={() => onSelectState(state.id)}
                className="bg-[#f8fafc] hover:bg-white border border-slate-200/90 hover:border-emerald-600 rounded-xl p-4 sm:p-5 transition-all duration-200 cursor-pointer shadow-2xs hover:shadow-xs flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Colored Accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 transition-all group-hover:h-1.5"
                  style={{ backgroundColor: zoneCfg.color }}
                />

                <div>
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <span
                      className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${zoneCfg.badgeBg}`}
                    >
                      {state.zone}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                      {state.code}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-slate-900 text-base mt-2 group-hover:text-emerald-800 transition">
                    {state.name} State
                  </h3>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Capital:</span>
                      <strong className="text-slate-900">{state.capital}</strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Constitutional LGAs:</span>
                      <strong className="font-mono text-emerald-800 font-bold">
                        {state.lga_count} LGAs
                      </strong>
                    </div>

                    {/* Accurate Lagos Highlights */}
                    {isLagos && (
                      <div className="pt-2 border-t border-slate-200/70 text-[11px] text-emerald-900 font-semibold space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">State LCDAs:</span>
                          <span className="font-mono text-emerald-800 font-bold">37 LCDAs</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Electoral Wards:</span>
                          <span className="font-mono text-emerald-800 font-bold">377 Wards</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between text-xs font-bold text-slate-600 group-hover:text-emerald-800">
                  <span>Enter State Hub & LGAs</span>
                  <ChevronRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
