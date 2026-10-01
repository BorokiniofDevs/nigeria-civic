import React, { useState } from 'react';
import {
  AlertTriangle,
  Flame,
  Shield,
  ThumbsUp,
  MapPin,
  Clock,
  CheckCircle2,
  Send,
  PlusCircle,
  FileText,
  Camera,
  UserCheck,
  ChevronRight,
  Filter,
  ExternalLink,
  X,
  Activity,
  Wrench,
  AlertCircle,
} from 'lucide-react';
import { Incident, OfficialSector, Jurisdiction } from '../types/civic';

interface IncidentEscalationPipelineProps {
  incidents: Incident[];
  jurisdictions: Jurisdiction[];
  onVoteIncident: (incidentId: string, isLocal: boolean) => void;
  onCreateIncident: (data: {
    jurisdiction_id: string;
    sector: OfficialSector;
    title: string;
    description: string;
    media_urls: string[];
    is_local: boolean;
    reported_by: string;
    is_emergency: boolean;
  }) => void;
}

export const IncidentEscalationPipeline: React.FC<IncidentEscalationPipelineProps> = ({
  incidents,
  jurisdictions,
  onVoteIncident,
  onCreateIncident,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Form State
  const [formData, setFormData] = useState<{
    jurisdiction_id: string;
    sector: OfficialSector;
    title: string;
    description: string;
    media_url: string;
    is_local: boolean;
    reported_by: string;
    is_emergency: boolean;
  }>({
    jurisdiction_id: 'lcda_lagos_kosofe_west',
    sector: 'INFRASTRUCTURE',
    title: '',
    description: '',
    media_url: '',
    is_local: true,
    reported_by: '',
    is_emergency: false,
  });

  const filteredIncidents = incidents.filter((inc) => {
    const matchesSector = selectedSector === 'ALL' || inc.sector === selectedSector;
    const matchesStatus = selectedStatus === 'ALL' || inc.status === selectedStatus;
    return matchesSector && matchesStatus;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    onCreateIncident({
      jurisdiction_id: formData.jurisdiction_id,
      sector: formData.sector,
      title: formData.title,
      description: formData.description,
      media_urls: formData.media_url ? [formData.media_url] : [],
      is_local: formData.is_local,
      reported_by: formData.reported_by || 'Verified Citizen Auditor',
      is_emergency: formData.is_emergency,
    });

    setShowCreateModal(false);
    setFormData({
      jurisdiction_id: 'lcda_lagos_kosofe_west',
      sector: 'INFRASTRUCTURE',
      title: '',
      description: '',
      media_url: '',
      is_local: true,
      reported_by: '',
      is_emergency: false,
    });
  };

  return (
    <div className="space-y-8 bg-white min-h-screen">
      {/* Header Banner */}
      <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              Direct Civic Escalation Protocol
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Incident Pipeline & Automated Escalation Engine
            </h2>
            <p className="text-slate-600 text-sm mt-1 max-w-2xl leading-relaxed">
              Eliminating social media noise with structured, geo-anchored accountability. Reports automatically
              route to the responsible DPO, PHC clinic, or PWD engineer and escalate directly to the Governor
              if unresolved after 48 hours.
            </p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sm transition shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Log Verified Civic Incident</span>
          </button>
        </div>

        {/* Dynamic Formula Display Box */}
        <div className="mt-8 pt-6 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1. Mathematical Score Formula
            </span>
            <div className="text-xs font-mono text-emerald-800 font-bold mt-1">
              Score = (Local × 1.5) + (External × 0.5) + (Photo Proof ? 10 : 0)
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              2. Auto-Routing Destination
            </span>
            <div className="text-xs text-slate-700 mt-1">
              <strong className="text-sky-800">Security</strong> → DPO |{' '}
              <strong className="text-amber-800">Roads</strong> → PWD |{' '}
              <strong className="text-emerald-800">Health</strong> → PHC Lead
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-2xs">
            <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider block">
              3. Automatic 48hr Threshold
            </span>
            <div className="text-xs text-red-700 font-bold mt-1">
              Score ≥ 25 Trigger → Escalates to State Commissioner & Governor
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-700" />
          <span className="text-xs text-slate-600 font-bold">Filter Sector:</span>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2"
          >
            <option value="ALL">All Sectors</option>
            <option value="SECURITY">Security / Police</option>
            <option value="INFRASTRUCTURE">Roads & Public Works</option>
            <option value="HEALTH">Primary Healthcare</option>
            <option value="ENVIRONMENT">Drainage & Environment</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-bold">Status:</span>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 rounded-xl px-3 py-2"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ESCALATED">Escalated to Governor</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incident Feed */}
      <div className="space-y-6">
        {filteredIncidents.map((inc) => {
          const isOverThreshold = inc.escalation_score >= 25;
          const progressPercent = Math.min(100, Math.round((inc.escalation_score / 25) * 100));

          return (
            <div
              key={inc.id}
              className={`bg-white border rounded-3xl p-6 sm:p-8 shadow-xs transition ${
                isOverThreshold
                  ? 'border-red-400 ring-2 ring-red-50'
                  : 'border-slate-200/90'
              }`}
            >
              {/* Escalated Ribbon */}
              {isOverThreshold && (
                <div className="bg-red-50 border border-red-200 text-red-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-red-600 animate-pulse" />
                    <span>
                      ESCALATED TO STATE COMMISSIONER & GOVERNOR DESK (SCORE: {inc.escalation_score})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-red-700 font-bold">
                    ACTIVE 48HR TIMER
                  </span>
                </div>
              )}

              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                      {inc.sector}
                    </span>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                      {inc.jurisdiction_name}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(inc.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900 leading-snug">
                    {inc.title}
                  </h3>

                  <p className="text-sm text-slate-600 leading-relaxed">
                    {inc.description}
                  </p>

                  {/* Photo Evidence */}
                  {inc.media_urls && inc.media_urls.length > 0 && (
                    <div className="pt-2">
                      <img
                        src={inc.media_urls[0]}
                        alt="Incident Proof"
                        className="w-full max-w-md h-48 rounded-2xl object-cover border border-slate-200 shadow-2xs"
                      />
                    </div>
                  )}
                </div>

                {/* Right Side Escalation Status Box */}
                <div className="lg:w-80 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                      <span className="font-bold">Escalation Score:</span>
                      <strong className="text-slate-900 font-mono text-sm">
                        {inc.escalation_score} / 25
                      </strong>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isOverThreshold ? 'bg-red-600' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/80 space-y-1.5 text-xs">
                    <div className="text-slate-500">Currently Routed To:</div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-700" />
                      <span>{inc.assigned_official_name || 'Assigned Divisional Desk'}</span>
                    </div>
                  </div>

                  {/* Citizen Verification Vote Buttons */}
                  <div className="pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onVoteIncident(inc.id, true)}
                      className="px-3 py-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-800 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Local (+1.5)</span>
                    </button>

                    <button
                      onClick={() => onVoteIncident(inc.id, false)}
                      className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <ThumbsUp className="w-3.5 h-3.5 text-slate-400" />
                      <span>Verify (+0.5)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log Incident Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">
                  Log Verified Civic Incident
                </h3>
                <p className="text-xs text-slate-500">
                  Strict geographic anchoring to local DPO, PWD engineer, or PHC clinic
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Jurisdiction Anchor *
                </label>
                <select
                  value={formData.jurisdiction_id}
                  onChange={(e) =>
                    setFormData({ ...formData, jurisdiction_id: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                >
                  {jurisdictions
                    .filter((j) => j.tier === 'LGA' || j.tier === 'LCDA' || j.tier === 'WARD')
                    .slice(0, 50)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.name} ({j.tier})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Sector Classification *
                  </label>
                  <select
                    value={formData.sector}
                    onChange={(e) =>
                      setFormData({ ...formData, sector: e.target.value as OfficialSector })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-600"
                  >
                    <option value="SECURITY">Security / Police</option>
                    <option value="INFRASTRUCTURE">Roads / Drainage</option>
                    <option value="HEALTH">Primary Healthcare</option>
                    <option value="ENVIRONMENT">Environment & Waste</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Reporter Name / CDA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ogudu Resident CDA"
                    value={formData.reported_by}
                    onChange={(e) =>
                      setFormData({ ...formData, reported_by: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Incident Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Culvert collapse on Ikosi Road creating hazardous flooding"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Description & Exact Location
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe location, nearest landmark, and danger level..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Photo / Video Proof URL (+10 Score Bonus)
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... or media link"
                  value={formData.media_url}
                  onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={formData.is_local}
                    onChange={(e) =>
                      setFormData({ ...formData, is_local: e.target.checked })
                    }
                    className="accent-emerald-700 w-4 h-4 rounded"
                  />
                  <span>I am a verified resident/worker in this ward (Applies 1.5x Local Weight)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-600">
                  <input
                    type="checkbox"
                    checked={formData.is_emergency}
                    onChange={(e) =>
                      setFormData({ ...formData, is_emergency: e.target.checked })
                    }
                    className="accent-red-600 w-4 h-4 rounded"
                  />
                  <span>Life-threatening or active emergency situation</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-sm transition"
                >
                  Submit & Route
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
