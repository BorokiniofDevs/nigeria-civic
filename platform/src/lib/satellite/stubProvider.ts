// Stub satellite provider for architecture validation.
// Serves Esri World Imagery as a clearly-labelled stand-in behind the
// SatelliteProvider interface. It is HONEST about what it does not know:
// acquisition dates are null and the UI must say so explicitly.
import type {
  AreaOfInterest, HistoricalObservation, ImageryCatalog,
  ImageryObservation, SatelliteProvider,
} from './types';

const ESRI_TEMPLATE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

class StubCatalog implements ImageryCatalog {
  async getLatest(_aoi: AreaOfInterest): Promise<ImageryObservation | null> {
    return {
      id: 'stub-obs-latest',
      providerId: 'stub-esri',
      acquisitionDate: null, // stub does not know the capture date — UI must say so
      cloudCoverPct: null,
      resolutionM: null,
      tileTemplate: ESRI_TEMPLATE,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics (stub layer)',
      note: 'Stub integration: acquisition date not supplied by this layer.',
    };
  }

  async getHistory(_aoi: AreaOfInterest): Promise<HistoricalObservation[]> {
    const latest = await this.getLatest(_aoi);
    if (!latest) return [];
    return [{ year: 2026, observations: [latest] }];
  }
}

export class StubSatelliteProvider implements SatelliteProvider {
  id = 'stub-esri';
  name = 'Stub provider — Esri World Imagery basemap';
  kind = 'stub' as const;
  catalog(): ImageryCatalog { return new StubCatalog(); }
}
