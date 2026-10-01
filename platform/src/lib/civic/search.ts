// lib/civic/search.ts — Grouped geographic search over the civic store.
// Searches loaded jurisdictions only. Never invents results: no record →
// honest empty state. Result caps keep it readable.
import type { CivicEntity, EntityKind, SearchGroup, SearchItem } from './types';

const KIND_LABEL: Record<string, string> = {
  country: 'Country', state: 'State', senatorial_district: 'Senatorial district',
  lga: 'LGA', lcda: 'LCDA', ward: 'Ward', community: 'Community', street: 'Street / locality',
  facility: 'Facility', project: 'Project', institution: 'Institution',
  report: 'Citizen report', official: 'Official', road: 'Road',
};

function contextFor(e: CivicEntity, byId: (id: string) => CivicEntity | undefined): string {
  const parts: string[] = [];
  let cur = e.parentId ? byId(e.parentId) : undefined;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? byId(cur.parentId) : undefined;
  }
  const kind = KIND_LABEL[e.kind] ?? e.kind;
  return parts.length ? `${kind} · ${parts.join(' › ')}` : kind;
}

export function searchEntities(
  query: string,
  all: CivicEntity[],
  byId: (id: string) => CivicEntity | undefined,
  limitPerGroup = 8,
): SearchGroup[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const match = (e: CivicEntity) => e.name.toLowerCase().includes(q);

  const jurisdictions = all.filter(
    (e) => match(e) &&
      ['country', 'state', 'lga', 'lcda', 'ward', 'community', 'street'].includes(e.kind),
  );

  const toItem = (e: CivicEntity): SearchItem => ({
    entityId: e.id, name: e.name, kind: e.kind as EntityKind, context: contextFor(e, byId),
  });

  const groups: SearchGroup[] = [];
  if (jurisdictions.length) {
    groups.push({
      group: 'Jurisdictions',
      items: jurisdictions.slice(0, limitPerGroup).map(toItem),
    });
  }
  return groups;
}

export { KIND_LABEL };
