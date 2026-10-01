import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Shield,
  PhoneCall,
  ChevronDown,
  Building2,
  UserCheck,
  Landmark,
  MapPin,
  Flame,
  AlertTriangle,
  X,
  ExternalLink,
  Sparkles,
  Map,
} from 'lucide-react';
import { OfficialProfile, Jurisdiction } from '../types/civic';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSelectJurisdiction: (jurisdictionId: string) => void;
  onSelectOfficial: (official: OfficialProfile) => void;
  jurisdictions: Jurisdiction[];
  officials: OfficialProfile[];
  onOpenAiAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onSelectJurisdiction,
  onSelectOfficial,
  jurisdictions,
  officials,
  onOpenAiAssistant,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered search results
  const q = searchQuery.toLowerCase().trim();
  const matchedJurisdictions = q
    ? jurisdictions
        .filter(
          (j) =>
            j.name.toLowerCase().includes(q) ||
            (j.capital && j.capital.toLowerCase().includes(q)),
        )
        .slice(0, 5)
    : [];

  const matchedOfficials = q
    ? officials
        .filter(
          (o) =>
            o.full_name.toLowerCase().includes(q) ||
            o.position_title.toLowerCase().includes(q) ||
            (o.badge_title && o.badge_title.toLowerCase().includes(q)) ||
            (o.jurisdiction_name && o.jurisdiction_name.toLowerCase().includes(q)),
        )
        .slice(0, 6)
    : [];

  const hasResults = matchedJurisdictions.length > 0 || matchedOfficials.length > 0;

  return (
    <header className="relative w-full bg-white border-b border-slate-200/90 shadow-2xs z-30">
      {/* Sleek Top National Ribbon */}
      <div className="bg-[#008751] text-white text-[11px] px-4 sm:px-8 py-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-bold tracking-wide">
          <div className="inline-flex h-3 w-5 rounded-xs overflow-hidden border border-white/50 shrink-0">
            <span className="w-1.5 bg-[#008751]" />
            <span className="w-2 bg-white" />
            <span className="w-1.5 bg-[#008751]" />
          </div>
          <span>FEDERAL REPUBLIC OF NIGERIA</span>
          <span className="hidden sm:inline text-emerald-200/70 font-normal">|</span>
          <span className="hidden md:inline text-emerald-100 font-normal text-[10.5px]">
            National Civic Governance & Public Accountability Network
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenAiAssistant && (
            <button
              onClick={onOpenAiAssistant}
              className="flex items-center gap-1 bg-emerald-900/90 hover:bg-emerald-950 text-emerald-100 px-2.5 py-0.5 rounded-md font-bold text-[10.5px] border border-emerald-400/40 transition cursor-pointer"
            >
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span className="hidden sm:inline">Civic AI Advisor</span>
              <span className="sm:hidden">AI Advisor</span>
            </button>
          )}

          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-0.5 rounded-md font-bold text-[10.5px] transition shadow-xs cursor-pointer"
          >
            <PhoneCall className="w-3 h-3 text-white" />
            <span>Emergency 112</span>
          </button>
        </div>
      </div>

      {/* Main Snug Executive Header: Brand Title, Search Icon + Bar, on the Exact Same Row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-[#008751] flex items-center justify-center shadow-2xs shrink-0">
            <Landmark className="w-4 h-4 text-[#008751]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 leading-none">
              Naija<span className="text-[#008751]">Civic</span>
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden md:inline">
              Public Directory
            </span>
          </div>
        </div>

        {/* Omni Search Bar - Snug on same row */}
        <div ref={searchRef} className="relative flex-1 max-w-md sm:max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Lagos 20 LGAs, 37 LCDAs, DPO, Governor, Ward..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-white border border-slate-300 rounded-lg text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#008751] focus:ring-1 focus:ring-[#008751] shadow-2xs transition-all font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Auto-complete Dropdown */}
          {isSearchOpen && searchQuery.trim().length > 0 && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-96 overflow-y-auto divide-y divide-slate-100">
              {/* Jurisdictions matches */}
              {matchedJurisdictions.length > 0 && (
                <div className="p-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 px-2 py-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Jurisdictions ({matchedJurisdictions.length})</span>
                  </div>
                  {matchedJurisdictions.map((jur) => (
                    <button
                      key={jur.id}
                      onClick={() => {
                        onSelectJurisdiction(jur.id);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-50 transition flex items-center justify-between text-xs text-slate-800 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{jur.name}</span>
                        <span className="text-[9.5px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded font-semibold text-slate-600">
                          {jur.tier}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-slate-500 font-medium">{jur.zone}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Officials matches */}
              {matchedOfficials.length > 0 && (
                <div className="p-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 px-2 py-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Verified Officials ({matchedOfficials.length})</span>
                  </div>
                  {matchedOfficials.map((off) => (
                    <button
                      key={off.id}
                      onClick={() => {
                        onSelectOfficial(off);
                        setIsSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-50 transition flex items-center gap-2.5 text-xs cursor-pointer"
                    >
                      <img
                        src={off.photo_url}
                        alt={off.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-emerald-500 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                          <span>{off.full_name}</span>
                          {off.is_verified && (
                            <Shield className="w-3 h-3 text-[#008751] shrink-0 inline" />
                          )}
                        </div>
                        <div className="text-[10.5px] text-slate-600 truncate">
                          {off.position_title}
                        </div>
                      </div>
                      <span className="text-[9.5px] bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                        {off.sector}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {!hasResults && (
                <div className="p-4 text-center text-xs text-slate-500">
                  No verified jurisdiction or official matching "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs - Compact single snug row */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100 flex items-center overflow-x-auto no-scrollbar">
        <div className="flex items-center space-x-1.5 py-1.5">
          {[
            { id: 'command', label: 'Federal Leadership', icon: Building2 },
            { id: 'states', label: '36 States & 774 LGAs', icon: Landmark },
            { id: 'incidents', label: 'Incident Escalation', icon: AlertTriangle },
            { id: 'budget', label: 'Open Budget Tracker', icon: Shield },
            { id: 'admin', label: 'Audit & Sync Queue', icon: UserCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Emergency Quick Dial Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowEmergencyModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                <PhoneCall className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  National Emergency Quick-Dial
                </h3>
                <p className="text-xs text-slate-500">
                  Direct official first-responder dispatch lines (Nigeria)
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                {
                  service: 'National Emergency Dispatch',
                  number: '112',
                  desc: 'Police, Ambulance & Fire Rescue Nationwide (Toll-Free)',
                  color: 'border-red-300 bg-red-50/70',
                },
                {
                  service: 'Lagos State Emergency Service',
                  number: '767 / 112',
                  desc: 'LASEMA, LASAMBUS Ambulance & Fire Service',
                  color: 'border-emerald-300 bg-emerald-50/70',
                },
                {
                  service: 'Federal Road Safety Corps (FRSC)',
                  number: '122',
                  desc: 'Highway Accident Response & Traffic Emergency',
                  color: 'border-amber-300 bg-amber-50/70',
                },
                {
                  service: 'NPF Complaint Response Unit',
                  number: '08057000001',
                  desc: 'Police Conduct, Extortion & Escalation Desk',
                  color: 'border-slate-300 bg-slate-50',
                },
              ].map((em, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${em.color} flex items-center justify-between`}
                >
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{em.service}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{em.desc}</div>
                  </div>
                  <a
                    href={`tel:${em.number.replace(/\s+/g, '')}`}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-mono font-bold text-sm shadow-xs transition"
                  >
                    {em.number}
                  </a>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEmergencyModal(false)}
              className="w-full mt-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-sm transition"
            >
              Close Quick-Dial
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
