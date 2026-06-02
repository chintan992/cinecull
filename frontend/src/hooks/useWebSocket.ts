import { useEffect, useRef } from 'react';
import type { WSMessage } from '../types/photo';
import { usePhotoStore } from '../store/usePhotoStore';
import { useUIStore } from '../store/useUIStore';

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setConnected = useUIStore((s) => s.setConnected);
  const setPhotos = usePhotoStore((s) => s.setPhotos);
  const updatePhoto = usePhotoStore((s) => s.updatePhoto);
  const setWatchDir = useUIStore((s) => s.setWatchDir);
  const setCullingMode = useUIStore((s) => s.setCullingMode);
  const addToast = useUIStore((s) => s.addToast);

  useEffect(() => {
    if (window.location.protocol === 'file:') return;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onclose = () => {
        setConnected(false);
        reconnectRef.current = setTimeout(connect, 3000);
      };

      ws.onmessage = (event) => {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'INIT':
            if (msg.watch_dir) setWatchDir(msg.watch_dir);
            if (msg.culling_mode) setCullingMode(msg.culling_mode);
            if (msg.photos) setPhotos(msg.photos);
            break;

          case 'PHOTO_DETECTED':
            addToast({ message: `Importing: ${msg.filename}`, type: 'info' });
            break;

          case 'PHOTO_ANALYZED':
            if (msg.data) {
              updatePhoto(msg.data);
              addToast({
                message: `Scored ${msg.data.filename} (${Math.round(msg.data.overall_score)}%)`,
                type: 'success',
              });
            }
            break;

          case 'LIST_UPDATED':
            if (msg.photos) setPhotos(msg.photos);
            break;

          case 'RECOMMENDATION_UPDATED':
            if (msg.filepath && msg.recommendation) {
              usePhotoStore.getState().updateRecommendation(msg.filepath, msg.recommendation);
            }
            break;
        }
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectRef.current);
    };
  }, []);
}
