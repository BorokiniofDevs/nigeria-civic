// components/OfficialsDirectory.tsx — Government officials directory
// (federal + Lagos State pilot tiers).
// Read-only civic directory: office ≠ holder; every record shows its source
// and information state. Seed records are source-backed, never verified.
'use client';
import { useMemo, useState } from 'react';
import { useCivic } from '@/state/CivicContext';
import {
  directory,
  listTiers,
  searchOfficials,
  tenureAsOf,
  tierLabel,
  type OfficeArm,
  type OfficeTier,
  type OfficeWithHolder,
} from '@/lib/civic/officialService';

const ARM_LABEL: Record<OfficeArm, string> = {
  executive: 'Executive',
  legislative: 'Legislative',
  judiciary: 'Judiciary',
  traditional: 'Traditional',
  other: 'Other',
};

const ARM_ORDER: OfficeArm[] = ['executive', 'legislative', 'judiciary', 'traditional', 'other'];

function formatDate(iso: string | null): string {
  if (!iso) return 'not stated';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function OfficialRow({ item }: { item: OfficeWithHolder }) {
  const { office, holder } = item;
  return (
    <article className="off-row">
      {holder?.headshotUrl && (
        <figure className="off-photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={holder.headshotUrl} alt={`Portrait of ${holder.personName}`} loading="lazy" />
          <figcaption>
            {holder.headshotCaption && <span>{holder.headshotCaption}. </span>}
            <span>Photo: {holder.headshotCredit} / Wikimedia Commons ({holder.headshotLicense})</span>
            {holder.headshotSourceUrl && (
              <>
                {' — '}
                <a href={holder.headshotSourceUrl} target="_blank" rel="noreferrer">source file</a>
              </>
            )}
          </figcaption>
        </figure>
      )}
      <div className="off-main">
        <h4>{office.title}</h4>
        {holder ? (
          <>
            <div className="off-name">{holder.personName}</div>
            <div className="off-meta">
              <span className="istate istate-source">Source-backed · pending verification</span>
              <span className="off-dot" aria-hidden="true">·</span>
              <span>{tenureAsOf(holder)}</span>
            </div>
            <div className="off-meta">
              {holder.partyAffiliation && <span>Party: {holder.partyAffiliation}</span>}
              {holder.partyAffiliation && office.constitutionalBasis && <span className="off-dot" aria-hidden="true">·</span>}
              {office.constitutionalBasis && <span>{office.constitutionalBasis}</span>}
            </div>
            {holder.bioSummary && (
              <p className="off-bio">
                {holder.bioSummary}{' '}
                {holder.bioSourceUrl && (
                  <a className="t-sub" href={holder.bioSourceUrl} target="_blank" rel="noreferrer">
                    (bio source)
                  </a>
                )}
              </p>
            )}
            {holder.notes && <p className="off-note">{holder.notes}</p>}
            <div className="off-src">
              <span className="t-sub">Source: </span>
              {holder.sourceUrl ? (
                <a href={holder.sourceUrl} target="_blank" rel="noreferrer">{holder.sourceLabel}</a>
              ) : (
                <span>{holder.sourceLabel}</span>
              )}
            </div>
          </>
        ) : (
          <p className="off-note">No holder record loaded for this office. Nothing is invented to fill the gap.</p>
        )}
      </div>
    </article>
  );
}

export default function OfficialsDirectory() {
  const { setOfficialsOpen } = useCivic();
  const [tier, setTier] = useState<OfficeTier>('federal');
  const [query, setQuery] = useState('');
  const tiers = useMemo(() => listTiers(), []);
  const rows = useMemo(
    () => (query.trim() ? searchOfficials(query, tier) : directory(tier)),
    [query, tier],
  );
  const arms = useMemo(
    () =>
      ARM_ORDER.map((arm) => ({
        arm,
        items: rows.filter((r) => r.office.arm === arm),
      })).filter((g) => g.items.length > 0),
    [rows],
  );

  return (
    <div className="overlay" role="dialog" aria-label="Government officials directory">
      <div className="sheet sheet-wide">
        <div className="sheet-head">
          <div>
            <h3>Government officials directory</h3>
            <p className="t-sub">
              {tierLabel(tier)} tier · {rows.length} offices. Every name below was read from a
              named public source and is <strong>source-backed, pending verification</strong> —
              the directory records what sources say, not verified fact. No photographs,
              biographies, or remuneration are shown until sourced records exist for them.
            </p>
          </div>
          <button className="btn-ghost" onClick={() => setOfficialsOpen(false)}>Close</button>
        </div>

        <div className="off-tiers" role="tablist" aria-label="Government tier">
          {tiers.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tier}
              className={t === tier ? 'off-tier on' : 'off-tier'}
              onClick={() => { setTier(t); setQuery(''); }}
            >
              {tierLabel(t)}
            </button>
          ))}
        </div>

        <div className="off-bar">
          <label className="fld inline">
            <span>Search</span>
            <input
              type="search"
              placeholder="Name or office…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <span className="t-sub">Lagos State is the pilot state tier — other states, then LGA and ward tiers, open next.</span>
        </div>

        {arms.map(({ arm, items }) => (
          <section key={arm} className="off-arm">
            <h5 className="off-arm-h">{ARM_LABEL[arm]}</h5>
            {items.map((item) => (
              <OfficialRow key={item.office.id} item={item} />
            ))}
          </section>
        ))}
        {rows.length === 0 && (
          <p className="empty">No offices match “{query}”. Nothing else is loaded at this tier.</p>
        )}

        <p className="t-sub off-foot">
          Records checked against sources on 29 Sept 2026. Office-holders change — treat every
          entry as “as of the source date” and report discrepancies through the citizen reporting
          flow.
        </p>
      </div>
    </div>
  );
}
