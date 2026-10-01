import React, { useState } from 'react';
import {
  ShieldCheck,
  Coins,
  Building,
  CheckCircle2,
  Camera,
  MapPin,
  Clock,
  ExternalLink,
  PlusCircle,
  FileCheck,
  AlertCircle,
  X,
  Award,
} from 'lucide-react';
import { BudgetProject } from '../types/civic';

interface OpenBudgetTrackerProps {
  projects: BudgetProject[];
  onSubmitProof: (
    projectId: string,
    proof: {
      photo_url: string;
      caption: string;
      geotag: string;
      uploaded_by: string;
    },
  ) => void;
}

export const OpenBudgetTracker: React.FC<OpenBudgetTrackerProps> = ({
  projects,
  onSubmitProof,
}) => {
  const [selectedProject, setSelectedProject] = useState<BudgetProject | null>(
    projects[0] || null,
  );
  const [showProofModal, setShowProofModal] = useState(false);

  // Form State
  const [proofData, setProofData] = useState({
    photo_url: '',
    caption: '',
    geotag: '',
    uploaded_by: '',
  });

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !proofData.caption) return;

    onSubmitProof(selectedProject.id, {
      photo_url:
        proofData.photo_url ||
        'https://images.unsplash.com/photo-1541888946425-d0fbb186c5f3?w=600&fit=crop&q=80',
      caption: proofData.caption,
      geotag: proofData.geotag || 'Lagos State Geo-Audit',
      uploaded_by: proofData.uploaded_by || 'Citizen Auditor',
    });

    setShowProofModal(false);
    setProofData({
      photo_url: '',
      caption: '',
      geotag: '',
      uploaded_by: '',
    });
  };

  const totalDisbursed = projects.reduce((acc, p) => acc + (p.disbursed_amount_ngn || 0), 0);

  return (
    <div className="space-y-8 bg-white min-h-screen">
      {/* Executive Header */}
      <div className="bg-slate-50/70 border border-slate-200/90 rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            Financial Transparency & Open Treasury
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Capital Project Allocations & Citizen Verification
          </h2>
          <p className="text-slate-600 text-sm mt-1 max-w-2xl leading-relaxed">
            Every naira disbursed from public accounts mapped to real-world physical projects.
            Projects are not certified complete until citizen auditors submit on-ground photographic evidence.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-semibold block uppercase">
              Total Disbursed Monitored
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {formatNaira(totalDisbursed)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Project List (Left) */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider px-1">
            Audited Public Projects ({projects.length})
          </h3>

          <div className="space-y-3">
            {projects.map((proj) => {
              const isSelected = selectedProject?.id === proj.id;
              const isVerified = proj.status === 'CITIZEN_VERIFIED_COMPLETE';
              const year = proj.start_date ? new Date(proj.start_date).getFullYear() : '2025/2026';

              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProject(proj)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'bg-white border-emerald-600 ring-2 ring-emerald-600/15'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isVerified
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      }`}
                    >
                      {isVerified ? 'Citizen Verified' : 'Under Execution'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      FY {year}
                    </span>
                  </div>

                  <h4 className="font-extrabold text-slate-900 text-base mt-2">
                    {proj.title}
                  </h4>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>Disbursed:</span>
                    <strong className="font-mono text-slate-900 text-sm">
                      {formatNaira(proj.disbursed_amount_ngn)}
                    </strong>
                  </div>

                  {/* Completion Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Progress</span>
                      <span className="font-bold text-slate-800">{proj.completion_percentage}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${proj.completion_percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Project Deep Dossier (Right) */}
        {selectedProject && (
          <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                    {selectedProject.sector}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Ref: {selectedProject.id}
                  </span>
                </div>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-2">
                  {selectedProject.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{selectedProject.jurisdiction_name}</span>
                </p>
              </div>

              <button
                onClick={() => setShowProofModal(true)}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition shrink-0"
              >
                <Camera className="w-4 h-4" />
                <span>Submit Citizen Proof</span>
              </button>
            </div>

            {/* Financial Overview Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-semibold block">Total Allocated</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 block">
                  {formatNaira(selectedProject.allocated_amount_ngn)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                <span className="text-xs text-slate-500 font-semibold block">Total Disbursed</span>
                <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono mt-1 block">
                  {formatNaira(selectedProject.disbursed_amount_ngn)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 col-span-2 sm:col-span-1">
                <span className="text-xs text-slate-500 font-semibold block">Auditor Verification</span>
                <span className="text-lg sm:text-xl font-black text-slate-900 font-mono mt-1 block">
                  {selectedProject.citizen_proofs.length} Proofs
                </span>
              </div>
            </div>

            {/* Contractor & Ministry Info */}
            <div className="space-y-3 bg-slate-50/60 rounded-2xl p-5 border border-slate-200/80 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold">Awarded Contractor:</span>
                <strong className="text-slate-900">{selectedProject.contractor_name}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold">Supervising Ministry:</span>
                <strong className="text-slate-900">{selectedProject.sector} Ministry / Board</strong>
              </div>
            </div>

            {/* Citizen Proof Gallery */}
            <div>
              <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-700" />
                <span>Citizen On-Ground Photologs ({selectedProject.citizen_proofs.length})</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedProject.citizen_proofs.map((proof) => (
                  <div
                    key={proof.id}
                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs"
                  >
                    <img
                      src={proof.photo_url}
                      alt={proof.caption}
                      className="w-full h-40 object-cover"
                    />
                    <div className="p-4 space-y-1">
                      <p className="text-xs font-bold text-slate-900">{proof.caption}</p>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span>{proof.uploaded_by}</span>
                        <span className="text-emerald-700 font-semibold">Verified Ground Proof</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Proof Submission Modal */}
      {showProofModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowProofModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-extrabold text-slate-900 mb-1">
              Submit Citizen Audit Photo Proof
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              Upload physical proof to verify progress on: <strong>{selectedProject?.title}</strong>
            </p>

            <form onSubmit={handleProofSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Photo URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/... or uploaded photo link"
                  value={proofData.photo_url}
                  onChange={(e) => setProofData({ ...proofData, photo_url: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Audit Observation / Caption *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Describe the current on-ground physical state of this project..."
                  value={proofData.caption}
                  onChange={(e) => setProofData({ ...proofData, caption: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Your Name / Auditor ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. Engr. Bamidele (Civic Auditor)"
                  value={proofData.uploaded_by}
                  onChange={(e) => setProofData({ ...proofData, uploaded_by: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 focus:outline-hidden focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowProofModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs shadow-sm"
                >
                  Publish Audit Proof
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
