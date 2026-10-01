'use client';
// SearchBox — grouped geographic search over loaded jurisdictions.
// Never invents results: no record → honest empty state.
import { useEffect, useRef } from 'react';
import { useCivic } from '@/state/CivicContext';

export default function SearchBox() {
  const { searchQuery, setSearchQuery, searchGroups, selectSearchResult } = useCivic();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [setSearchQuery]);

  const showResults = searchQuery.trim().length >= 2;

  return (
    <div className="search" ref={wrapRef}>
      <input
        className="search__input"
        type="search"
        role="combobox"
        aria-expanded={showResults}
        aria-controls="civic-search-results"
        aria-label="Search jurisdictions and records"
        placeholder="Search states, LGAs, wards, records…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setSearchQuery('');
          if (e.key === 'Enter' && searchGroups.length && searchGroups[0].items.length) {
            selectSearchResult(searchGroups[0].items[0].entityId);
          }
        }}
      />
      {showResults && (
        <div className="search__results" id="civic-search-results" role="listbox">
          {searchGroups.length === 0 ? (
            <div className="search__empty">
              No results. Search covers loaded jurisdictions only — nothing is guessed.
            </div>
          ) : (
            searchGroups.map((g) => (
              <div key={g.group}>
                <div className="search__group">{g.group}</div>
                {g.items.map((item) => (
                  <button
                    key={item.entityId}
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="search__item"
                    onClick={() => selectSearchResult(item.entityId)}
                  >
                    <span className="search__name">{item.name}</span>
                    <span className="search__ctx">{item.context}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
