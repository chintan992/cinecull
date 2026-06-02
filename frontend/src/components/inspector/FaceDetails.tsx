import { Eye, EyeOff } from 'lucide-react';
import type { FaceData } from '../../types/photo';

export function FaceDetails({ faces, facesDetected }: { faces: FaceData[]; facesDetected: number }) {
  if (facesDetected === 0) {
    return (
      <p className="text-[9px] text-chrome-500 italic font-mono">No human subjects detected.</p>
    );
  }

  return (
    <div className="space-y-2.5">
      {faces.map((face) => (
        <div key={face.face_index} className="p-2.5 bg-chrome-850 rounded-md border border-chrome-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-chrome-300 font-mono">
              Subject #{face.face_index + 1}
            </span>
            <span className="flex items-center gap-1 text-[9px] font-medium">
              {face.eyes_closed ? (
                <><EyeOff size={10} className="text-reject-400" /><span className="text-reject-400">Closed</span></>
              ) : (
                <><Eye size={10} className="text-keep-400" /><span className="text-keep-400">Open</span></>
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] font-mono text-chrome-500">
            <div>Eye: <span className="text-chrome-300">{Math.round(face.eye_score)}%</span></div>
            <div>EAR: <span className="text-chrome-300">{(face.ear_smoothed ?? face.ear).toFixed(3)}</span></div>
            <div>Smile: <span className="text-chrome-300">{Math.round(face.smile_score)}%</span></div>
            <div>Pose: <span className="text-chrome-300">{Math.round(face.pose_score)}%</span></div>
            <div className="col-span-2">
              Y/P/R: <span className="text-chrome-300">{face.pose.yaw.toFixed(1)}° / {face.pose.pitch.toFixed(1)}° / {face.pose.roll.toFixed(1)}°</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
