import React from 'react';
import { FIGURE_HEIGHT, FIGURE_TOP, FIGURE_WIDTH_OF_HEIGHT, type BodyGuide } from '@/lib/body-guide';

interface BodyGuideOverlayProps {
  /** The outline for this patient (see buildBodyGuide). */
  guide: BodyGuide;
  /** The person fits the outline. */
  aligned: boolean;
  /** 0 to 1: how long they have held the position. */
  progress: number;
}

/** A standing body outline drawn over the camera image. Turns green when the person fits. */
export const BodyGuideOverlay: React.FC<BodyGuideOverlayProps> = ({ guide, aligned, progress }) => {
  const stroke = aligned ? '#22c55e' : 'rgba(255,255,255,0.9)';
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '50%',
        top: `${FIGURE_TOP * 100}%`,
        height: `${FIGURE_HEIGHT * 100}%`,
        aspectRatio: `${FIGURE_WIDTH_OF_HEIGHT}`,
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        filter: aligned ? 'drop-shadow(0 0 8px rgba(34,197,94,0.8))' : 'drop-shadow(0 0 3px rgba(0,0,0,0.6))',
        transition: 'filter 0.2s ease',
      }}
    >
      <svg viewBox="0 0 100 200" width="100%" height="100%" fill="none" overflow="visible">
        <g
          stroke={stroke}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={aligned ? undefined : '4 3'}
          fill={aligned ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}
          style={{ transition: 'all 0.2s ease' }}
        >
          <ellipse cx={guide.head.cx} cy={guide.head.cy} rx={guide.head.rx} ry={guide.head.ry} />
          <path d={guide.path} />
        </g>
        {/* Hold-still progress, drawn as a bar under the feet */}
        {aligned && (
          <g>
            <rect x="20" y="199" width="60" height="1.6" rx="0.8" fill="rgba(255,255,255,0.35)" />
            <rect x="20" y="199" width={60 * Math.min(1, progress)} height="1.6" rx="0.8" fill="#22c55e" />
          </g>
        )}
      </svg>
    </div>
  );
};
