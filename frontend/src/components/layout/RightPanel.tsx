import { usePhotoStore, selectSelectedPhoto } from '../../store/usePhotoStore';
import { PanelSection } from '../ui/PanelSection';
import { ScoreOverview } from '../inspector/ScoreOverview';
import { FocusMetrics } from '../inspector/FocusMetrics';
import { ExposureMetrics } from '../inspector/ExposureMetrics';
import { AestheticMetrics } from '../inspector/AestheticMetrics';
import { FaceDetails } from '../inspector/FaceDetails';
import { ExifMetadata } from '../inspector/ExifMetadata';
import { Info } from 'lucide-react';

export function RightPanel() {
  const photo = usePhotoStore(selectSelectedPhoto);

  if (!photo) {
    return (
      <aside className="w-64 bg-chrome-900 border-l border-chrome-800 flex flex-col items-center justify-center shrink-0">
        <div className="text-center p-6">
          <Info size={24} className="text-chrome-600 mx-auto mb-3" />
          <p className="text-[10px] text-chrome-500 leading-relaxed">
            Select a photo to inspect its sharpness, exposure, and aesthetic metrics.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-chrome-900 border-l border-chrome-800 flex flex-col shrink-0 overflow-y-auto">
      <div className="px-3 py-2.5 border-b border-chrome-800">
        <span className="text-[9px] font-bold uppercase tracking-widest text-chrome-400 font-mono">
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
