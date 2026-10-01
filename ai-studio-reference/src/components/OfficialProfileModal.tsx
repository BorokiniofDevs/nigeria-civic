import React from 'react';
import {
  X,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  ExternalLink,
  MapPin,
  Building,
  RefreshCw,
} from 'lucide-react';
import { OfficialProfile } from '../types/civic';

interface OfficialProfileModalProps {
  official: OfficialProfile | null;
  onClose: () => void;
  onTriggerSync: (profileId: string, position: string) => void;
}

export const OfficialProfileModal: React.FC<OfficialProfileModalProps> = ({
  official,
  onClose,
  onTriggerSync,
}) => {
  if (!official) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 sm:p-8 text-slate-900 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <img
            src={official.photo_url}
            alt={official.full_name}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-600 shadow-xs shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                {official.sector}
              </span>
              {official.is_verified && (
                <span className="text-xs text-emerald-800 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Verified Public Servant</span>
                </span>
              )}
            </div>

            <h3 className="text-xl font-extrabold text-slate-900 mt-1 leading-tight">
              {official.full_name}
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              {official.position_title}
            </p>
            {official.rank && (
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                Rank: {official.rank}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-3 text-xs bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">Public Desk Phone:</span>
            <a
              href={`tel:${official.public_phone}`}
              className="font-mono font-bold text-emerald-800 hover:underline flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-700" />
              <span>{official.public_phone}</span>
            </a>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 font-semibold">Official Email:</span>
            <a
              href={`mailto:${official.public_email}`}
              className="font-mono text-slate-800 hover:underline flex items-center gap-1.5 truncate max-w-[220px]"
            >
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{official.public_email}</span>
            </a>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
            <span className="text-slate-500 font-semibold">Jurisdiction Unit:</span>
            <span className="text-slate-800 font-bold">
              {official.jurisdiction_name || 'Federal'}
            </span>
          </div>

          {official.office_address && (
            <div className="flex items-start justify-between pt-1">
              <span className="text-slate-500 font-semibold shrink-0">Official Secretariat:</span>
              <span className="text-slate-800 text-right ml-4">
                {official.office_address}
              </span>
            </div>
          )}
        </div>

        {/* Verification & Source */}
        <div className="mt-4 p-4 rounded-2xl bg-white border border-slate-200/80 text-xs space-y-2">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Accreditation Source
          </div>
          <p className="text-slate-700 text-xs leading-relaxed">
            {official.citation_source}
          </p>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-100">
          <button
            onClick={() => onTriggerSync(official.id, official.position_title)}
            className="flex items-center gap-1.5 text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-700" />
            <span>Launch Google Sync Probe</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
