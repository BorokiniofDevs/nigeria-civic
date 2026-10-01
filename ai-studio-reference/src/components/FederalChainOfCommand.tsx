import React, { useState } from 'react';
import {
  Shield,
  Phone,
  Mail,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Award,
  Building,
  Filter,
  Landmark,
} from 'lucide-react';
import { OfficialProfile, OfficialSector } from '../types/civic';

interface FederalChainOfCommandProps {
  officials: OfficialProfile[];
  onTriggerSync: (profileId: string, position: string) => void;
  onSelectOfficial: (official: OfficialProfile) => void;
}

export const FederalChainOfCommand: React.FC<FederalChainOfCommandProps> = ({
  officials,
  onTriggerSync,
  onSelectOfficial,
}) => {
  const [selectedSector, setSelectedSector] = useState<string>('ALL');

  const federalOfficials = officials.filter(
    (o) => o.jurisdiction_id === 'fed_ng' || o.jurisdiction_id === 'state_fct',
  );

  const filteredOfficials =
    selectedSector === 'ALL'
      ? federalOfficials
      : federalOfficials.filter((o) => o.sector === selectedSector);

  // Separate principal leadership
  const president = federalOfficials.find((o) => o.id === 'off_fed_pres');
  const vicePresident = federalOfficials.find((o) => o.id === 'off_fed_vp');
  const chiefOfStaff = federalOfficials.find((o) => o.id === 'off_fed_cos');
  const senatePres = federalOfficials.find((o) => o.id === 'off_fed_senate_pres');
  const speaker = federalOfficials.find((o) => o.id === 'off_fed_speaker');
  const cjn = federalOfficials.find((o) => o.id === 'off_fed_cjn');
  const igp = federalOfficials.find((o) => o.id === 'off_fed_igp');
  const cds = federalOfficials.find((o) => o.id === 'off_fed_cds');

  const sectors: { id: string; label: string }[] = [
    { id: 'ALL', label: 'All Portfolios' },
    { id: 'GOVERNANCE', label: 'Presidency' },
    { id: 'SECURITY', label: 'Security & Defense' },
    { id: 'LEGISLATURE', label: 'National Assembly' },
    { id: 'JUDICIARY', label: 'Supreme Court' },
    { id: 'INFRASTRUCTURE', label: 'Works & Capital' },
    { id: 'FINANCE', label: 'Finance & Economy' },
    { id: 'HEALTH', label: 'Health & Welfare' },
  ];

  return (
    <div className="space-y-6 bg-white">
      {/* Compact Header with Filter Beside It */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Federal Chain of Command & State Council
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 hidden sm:inline-block">
              Level 1 Federal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified leadership anchored to constitutional mandates with direct official public desk lines.
          </p>
        </div>

        {/* Sector Filter Beside Title */}
        <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto transition">
          <Filter className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer pr-1"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Principal National Triad (President, VP, Chief of Staff) - Compact Cards */}
      {selectedSector === 'ALL' && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {president && (
            <div className="bg-[#f8fafc] hover:bg-white border-2 border-emerald-600/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 bg-emerald-700 text-white text-[9.5px] font-black uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                Head of State
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={president.photo_url}
                    alt={president.full_name}
                    className="w-14 h-14 rounded-xl object-cover border-2 border-emerald-600 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                      <span>COMMANDER-IN-CHIEF</span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                      {president.full_name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {president.position_title}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">State House Line:</span>
                    <a
                      href={`tel:${president.public_phone}`}
                      className="font-mono font-bold text-emerald-800 hover:underline"
                    >
                      {president.public_phone}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Desk Email:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[170px]">
                      {president.public_email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate max-w-[150px]">
                  {president.citation_source}
                </span>
                <button
                  onClick={() => onTriggerSync(president.id, president.position_title)}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Verify</span>
                </button>
              </div>
            </div>
          )}

          {vicePresident && (
            <div className="bg-[#f8fafc] hover:bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 bg-slate-100 text-slate-700 text-[9.5px] font-bold uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                Vice President
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={vicePresident.photo_url}
                    alt={vicePresident.full_name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-500">PRESIDENCY (GCON)</div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                      {vicePresident.full_name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {vicePresident.position_title}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">VP Office Line:</span>
                    <a
                      href={`tel:${vicePresident.public_phone}`}
                      className="font-mono font-bold text-emerald-800 hover:underline"
                    >
                      {vicePresident.public_phone}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Desk Email:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[170px]">
                      {vicePresident.public_email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate max-w-[150px]">
                  {vicePresident.citation_source}
                </span>
                <button
                  onClick={() => onTriggerSync(vicePresident.id, vicePresident.position_title)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Verify</span>
                </button>
              </div>
            </div>
          )}

          {chiefOfStaff && (
            <div className="bg-[#f8fafc] hover:bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-colors">
              <div className="absolute top-0 right-0 bg-slate-100 text-slate-700 text-[9.5px] font-bold uppercase px-2.5 py-0.5 rounded-bl-lg tracking-wider">
                Chief of Staff
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={chiefOfStaff.photo_url}
                    alt={chiefOfStaff.full_name}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold text-slate-500">PRESIDENCY AIDE (CFR)</div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                      {chiefOfStaff.full_name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate">
                      {chiefOfStaff.position_title}
                    </p>
                  </div>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">CoS Line:</span>
                    <a
                      href={`tel:${chiefOfStaff.public_phone}`}
                      className="font-mono font-bold text-emerald-800 hover:underline"
                    >
                      {chiefOfStaff.public_phone}
                    </a>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Desk Email:</span>
                    <span className="font-mono text-slate-800 truncate max-w-[170px]">
                      {chiefOfStaff.public_email}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 truncate max-w-[150px]">
                  {chiefOfStaff.citation_source}
                </span>
                <button
                  onClick={() => onTriggerSync(chiefOfStaff.id, chiefOfStaff.position_title)}
                  className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync Verify</span>
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Legislative, Judicial & Security Chiefs - Compact Row */}
      {selectedSector === 'ALL' && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {senatePres && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={senatePres.photo_url}
                alt={senatePres.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                  Senate President
                </span>
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                  {senatePres.full_name}
                </h4>
                <div className="text-[11px] text-slate-500 font-mono">{senatePres.public_phone}</div>
              </div>
            </div>
          )}

          {speaker && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={speaker.photo_url}
                alt={speaker.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded-full">
                  Speaker, Reps
                </span>
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                  {speaker.full_name}
                </h4>
                <div className="text-[11px] text-slate-500 font-mono">{speaker.public_phone}</div>
              </div>
            </div>
          )}

          {cjn && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <img
                src={cjn.photo_url}
                alt={cjn.full_name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] font-bold text-purple-800 uppercase bg-purple-100 px-2 py-0.5 rounded-full">
                  Chief Justice (CJN)
                </span>
                <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm truncate mt-0.5">
                  {cjn.full_name}
                </h4>
                <div className="text-[11px] text-slate-500 font-mono">{cjn.public_phone}</div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Federal Ministers & Defense Chiefs Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
            Federal Ministers & Defense Chiefs ({filteredOfficials.length})
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">Official Gazetted Portfolios</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredOfficials.map((off) => (
            <div
              key={off.id}
              className="bg-[#f8fafc] hover:bg-white border border-slate-200/90 hover:border-emerald-600 rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src={off.photo_url}
                    alt={off.full_name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                      {off.sector}
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm truncate mt-1">
                      {off.full_name}
                    </h4>
                    <p className="text-[11px] text-slate-600 truncate font-medium">
                      {off.position_title}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="font-mono text-slate-900 font-semibold">{off.public_phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate text-slate-700">{off.public_email}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
                <span className="text-slate-400 truncate max-w-[140px]">
                  {off.citation_source}
                </span>
                <button
                  onClick={() => onTriggerSync(off.id, off.position_title)}
                  className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
