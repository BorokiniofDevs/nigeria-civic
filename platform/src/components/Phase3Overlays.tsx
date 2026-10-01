// components/Phase3Overlays.tsx — client wrapper for the Phase 3 overlays
// plus the officials directory. Kept separate so app/page.tsx stays a
// server component.
'use client';
import { useCivic } from '@/state/CivicContext';
import ReportFlow from '@/components/ReportFlow';
import ModerationConsole from '@/components/ModerationConsole';
import OfficialsDirectory from '@/components/OfficialsDirectory';
import StreetViewPanel from '@/components/StreetViewPanel';
import ProjectsPanel from '@/components/ProjectsPanel';

export default function Phase3Overlays() {
  const { reportFlowOpen, moderatorOpen, officialsOpen, streetViewOpen, projectsOpen } = useCivic();
  return (
    <>
      {reportFlowOpen && <ReportFlow />}
      {moderatorOpen && <ModerationConsole />}
      {officialsOpen && <OfficialsDirectory />}
      {streetViewOpen && <StreetViewPanel />}
      {projectsOpen && <ProjectsPanel />}
    </>
  );
}
