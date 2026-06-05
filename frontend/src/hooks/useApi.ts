import { useEffect } from 'react';
import { api } from '../lib/api';
import { usePhotoStore } from '../store/usePhotoStore';
import { useUIStore } from '../store/useUIStore';

export function useApi() {
  const setPhotos = usePhotoStore((s) => s.setPhotos);
  const selectPhoto = usePhotoStore((s) => s.selectPhoto);
  const setWatchDir = useUIStore((s) => s.setWatchDir);
  const setCullingMode = useUIStore((s) => s.setCullingMode);
  const setEngine = useUIStore((s) => s.setEngine);
  const setAnalysisPaused = useUIStore((s) => s.setAnalysisPaused);
  const setAnalysisQueueLen = useUIStore((s) => s.setAnalysisQueueLen);

  useEffect(() => {
    async function init() {
      try {
        const [photos, config, engine] = await Promise.all([
          api.getPhotos(),
          api.getConfig(),
          api.getEngine(),
        ]);

        setPhotos(photos);
        setWatchDir(config.watch_dir);
        setCullingMode(config.culling_mode);
        setEngine(engine.engine, engine.has_yolo);
        if (config.analysis_paused !== undefined) setAnalysisPaused(config.analysis_paused);
        if (config.analysis_queue_len !== undefined) setAnalysisQueueLen(config.analysis_queue_len);

        if (photos.length > 0) {
          selectPhoto(photos[0].filepath);
        }
      } catch (err) {
        console.error('Failed to initialize:', err);
      }
    }

    init();
  }, []);
}
