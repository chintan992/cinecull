import { usePhotoStore, selectSelectedPhoto } from '../../store/usePhotoStore';
import { PanelSection } from '../ui/PanelSection';
import { ScoreOverview } from '../inspector/ScoreOverview';
import { FocusMetrics } from '../inspector/FocusMetrics';
import { ExposureMetrics } from '../inspector/ExposureMetrics';
import { AestheticMetrics } from '../inspector/AestheticMetrics';
import { FaceDetails } from '../inspector/FaceDetails';
import { ExifMetadata } from '../inspector/ExifMetadata';
import { ScanSearch } from 'lucide-react';

export function RightPanel() {
  const photo = usePhotoStore(selectSelectedPhoto);

  if (!photo) {
    return (
      <aside className="w-64 bg-chrome-900 border-l border-chrome-800/50 flex flex-col items-center justify-center shrink-0">
        <div className="text-center p-8">
          <div className="w-12 h-12 rounded-xl bg-chrome-850 border border-chrome-800/50 flex items-center justify-center mx-auto mb-4">
            <ScanSearch size={20} className="text-chrome-600" />
          </div>
          <p className="text-xs text-chrome-400 leading-relaxed">
            Select a photo to inspect its metrics and details.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-chrome-900 border-l border-chrome-800/50 flex flex-col shrink-0 overflow-y-auto">
      <div className="px-4 py-3 border-b border-chrome-800/50">
        <span className="text-[10px] font-bold uppercase tracking-widest text-chrome-400">
          Inspector
        </span>
      </div>

      <ScoreOverview photo={photo} />

      <PanelSection title="Focus">
        <FocusMetrics focus={photo.focus} />
      </PanelSection>

      <PanelSection title="Exposure">
        <ExposureMetrics exposure={photo.exposure} />
      </PanelSection>

      <PanelSection title="Aesthetics">
        <AestheticMetrics aesthetics={photo.aesthetics} />
      </PanelSection>

      <PanelSection title="Subjects" defaultOpen={photo.faces_detected > 0}>
        <FaceDetails faces={photo.faces} facesDetected={photo.faces_detected} />
      </PanelSection>

      <PanelSection title="EXIF Data" defaultOpen={false}>
        <ExifMetadata metadata={photo.metadata} />
      </PanelSection>
    </aside>
  );
}
