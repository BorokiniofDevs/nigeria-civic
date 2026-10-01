import { CivicProvider } from '@/state/CivicContext';
import SiteHeader from '@/components/SiteHeader';
import Breadcrumb from '@/components/Breadcrumb';
import LayerRail from '@/components/LayerRail';
import CivicMap from '@/components/CivicMap';
import InfoPanel from '@/components/InfoPanel';
import ProvenanceDrawer from '@/components/ProvenanceDrawer';
import Phase3Overlays from '@/components/Phase3Overlays';

export default function Home() {
  return (
    <CivicProvider>
      <SiteHeader />
      <Breadcrumb />
      <main>
        <LayerRail />
        <CivicMap />
        <InfoPanel />
      </main>
      <ProvenanceDrawer />
      <Phase3Overlays />
    </CivicProvider>
  );
}
