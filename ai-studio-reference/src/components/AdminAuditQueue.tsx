import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Database,
  Search,
  Sparkles,
  Check,
  X,
  FileSearch,
} from 'lucide-react';
import { ProfileUpdateRequest, OfficialProfile, Jurisdiction } from '../types/civic';

interface AdminAuditQueueProps {
  updateRequests: ProfileUpdateRequest[];
  officials: OfficialProfile[];
  jurisdictions: Jurisdiction[];
  onActionRequest: (requestId: string, action: 'APPROVE' | 'REJECT') => void;
  onTriggerSync: (profileId: string, position: string, jurName?: string) => Promise<void>;
}

export const AdminAuditQueue: React.FC<AdminAuditQueueProps> = ({
  updateRequests,
  officials,
  jurisdictions,
  onActionRequest,
  onTriggerSync,
}) => {
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('state_lagos');
  const [targetPosition, setTargetPosition] = useState('Commissioner of Police');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const pendingRequests = updateRequests.filter((r) => r.status === 'PENDING');
  const pastRequests = updateRequests.filter((r) => r.status !== 'PENDING');

  const handleManualSyncTrigger = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const jur = jurisdictions.find((j) => j.id === selectedJurisdiction);
      const matchingOfficial = officials.find(
        (o) =>
          o.jurisdiction_id === selectedJurisdiction &&
          o.position_title.toLowerCase().includes(targetPosition.toLowerCase()),
      );

      await onTriggerSync(
        matchingOfficial?.id || 'off_lagos_cp',
        targetPosition,
        jur?.name || 'Lagos State',
      );

      setSyncFeedback(
        `Gemini background search worker executed live query for ${targetPosition} in ${
          jur?.name || 'Nigeria'
        } and queued record for audit.`,
      );
    } catch (err: any) {
      setSyncFeedback(`Error triggering sync: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8 bg-white min-h-screen">
      {/* Overview & Live Trigger Banner */}
      <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              Automated Data Sync Worker
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Staging & Admin Audit Queue
            </h2>
            <p className="text-slate-600 text-sm mt-1 max-w-3xl leading-relaxed">
              Server-side background worker queries Gemini with Google Search grounding across official .gov.ng
              domains and verified gazettes. Changes are quarantined in staging until approved with 1-click publishing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2 rounded-xl font-bold font-mono">
              {pendingRequests.length} Pending Audit
            </span>
          </div>
        </div>

        {/* Dynamic Query Trigger Controls */}
        <div className="mt-8 p-5 bg-white border border-slate-200 rounded-2xl space-y-4 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>Launch Live Google Search Grounding Probe</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Target Jurisdiction
              </label>
              <select
                value={selectedJurisdiction}
                onChange={(e) => setSelectedJurisdiction(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-900 focus:outline-hidden focus:border-emerald-600"
              >
                {jurisdictions
                  .filter((j) => j.tier === 'STATE' || j.tier === 'LGA')
                  .slice(0, 40)
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({j.tier})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
                Target Official Role
              </label>
              <input
                type="text"
                value={targetPosition}
                onChange={(e) => setTargetPosition(e.target.value)}
                placeholder="e.g. Commissioner of Police, DPO, PWD Engineer"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleManualSyncTrigger}
                disabled={isSyncing}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Querying Google Grounding...' : 'Dispatch Live Probe'}</span>
              </button>
            </div>
          </div>

          {syncFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
              {syncFeedback}
            </div>
          )}
        </div>
      </div>

      {/* Audit Review Queue */}
      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <span>Staged Profile Update Requests</span>
          <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
            {pendingRequests.length} Waiting
          </span>
        </h3>

        {pendingRequests.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 border border-slate-200 rounded-3xl text-slate-500 text-sm">
            <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
            Audit queue clear. All staged profiles verified and published.
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="bg-white border-2 border-amber-300 rounded-3xl p-6 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      STAGED UPDATE
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      Confidence: {req.confidence_score}%
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-bold text-slate-500 line-through">
                      {req.existing_data?.full_name || 'Incumbent'}
                    </span>
                    <ArrowRight className="w-4 h-4 text-emerald-700" />
                    <span className="text-base font-black text-slate-900">
                      {req.proposed_data.full_name}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">{req.source_snippet}</p>

                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span>Source: {req.proposed_data.citation_source}</span>
                    {req.citation_url && (
                      <a
                        href={req.citation_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Inspect Gazette</span>
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => onActionRequest(req.id, 'APPROVE')}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve & Publish</span>
                  </button>

                  <button
                    onClick={() => onActionRequest(req.id, 'REJECT')}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
