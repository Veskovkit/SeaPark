import { useEffect, useRef, useState } from 'react';
import InstrumentBar from './components/InstrumentBar';
import AlertBanner from './components/AlertBanner';
import SidePanel from './components/SidePanel';
import HelmMap from './components/HelmMap';
import ZoneInfoPanel from './components/ZoneInfoPanel';
import ReportModal from './components/ReportModal';
import { useSignalK } from './hooks/useSignalK';
import { useZoneEngine } from './hooks/useZoneEngine';
import { useReports } from './hooks/useReports';
import { playAlert } from './lib/audio';

export default function App() {
  const { position, sog, cog, connected, lastUpdate, usingBridge } =
    useSignalK();
  const { activeZone } = useZoneEngine(position);
  const { reports } = useReports();

  const [selectedZone, setSelectedZone] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const prevZoneType = useRef(null);
  const [zoneCheckCount, setZoneCheckCount] = useState(0);

  /* eslint-disable react-hooks/set-state-in-effect -- session counter synced to position stream */
  useEffect(() => {
    if (!position) return;
    setZoneCheckCount((n) => n + 1);
  }, [position]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!activeZone) {
      prevZoneType.current = null;
      return;
    }
    const type = activeZone.properties.type;
    if (type !== prevZoneType.current) {
      prevZoneType.current = type;
      if (type === 'danger') playAlert('danger');
      if (type === 'restricted') playAlert('warning');
    }
  }, [activeZone]);

  const showAlert =
    activeZone &&
    (activeZone.properties.type === 'danger' ||
      activeZone.properties.type === 'restricted');

  return (
    <div className="helm-app">
      <InstrumentBar
        sog={sog}
        cog={cog}
        position={position}
        connected={connected}
        lastUpdate={lastUpdate}
        usingBridge={usingBridge}
      />

      {showAlert && (
        <AlertBanner
          zone={activeZone.properties}
          onReport={() => position && setReportOpen(true)}
          onViewSpecies={() => setSelectedZone(activeZone)}
        />
      )}

      <div className="helm-main">
        <SidePanel
          reports={reports}
          connected={connected}
          lastUpdate={lastUpdate}
          usingBridge={usingBridge}
          zoneCheckCount={zoneCheckCount}
        />

        <div className="helm-map-wrap">
          <HelmMap
            position={position}
            cog={cog}
            sog={sog}
            onZoneClick={setSelectedZone}
            onMapRightClick={() => position && setReportOpen(true)}
          />
        </div>

        {selectedZone && (
          <ZoneInfoPanel
            zone={selectedZone}
            reports={reports}
            onClose={() => setSelectedZone(null)}
          />
        )}
      </div>

      {reportOpen && position && (
        <ReportModal
          position={position}
          activeZone={activeZone}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
