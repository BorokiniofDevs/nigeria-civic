// Change-detection seam. Results are evidence ("detected change"), never
// conclusions ("project completed"). The stub reports unavailability honestly.
import type {
  ChangeDetectionResult, ChangeDetector, ImageryObservation,
} from './types';

export class StubChangeDetector implements ChangeDetector {
  id = 'stub-none';
  async analyze(
    before: ImageryObservation,
    after: ImageryObservation,
  ): Promise<ChangeDetectionResult> {
    return {
      id: `stub-cd-${Date.now()}`,
      aoiId: 'unknown',
      beforeObservationId: before.id,
      afterObservationId: after.id,
      status: 'unavailable',
      detections: [],
      note: 'No change-detection model is wired up in this build. Detections will appear here as evidence-only "detected change" records once a model is integrated.',
    };
  }
}
