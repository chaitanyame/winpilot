import { useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Sun } from 'lucide-react';

type OSDType = 'volume' | 'brightness' | 'mute';

interface OSDData {
  type: OSDType;
  value: number;
  label?: string;
}

const SEGMENT_COUNT = 16;

export function OSDOverlay() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<OSDData | null>(null);

  const handleUpdate = useCallback((raw: { type: string; value: number; label?: string }) => {
    setData(raw as OSDData);
    setVisible(true);
  }, []);

  const handleHide = useCallback(() => {
    setVisible(false);
  }, []);

  useEffect(() => {
    // Listen for OSD update and hide events from the main process via preload
    const cleanupUpdate = window.electronAPI.onOSDUpdate(handleUpdate);
    const cleanupHide = window.electronAPI.onOSDHide(handleHide);

    return () => {
      cleanupUpdate();
      cleanupHide();
    };
  }, [handleUpdate, handleHide]);

  // Derive display properties from data
  const type = data?.type ?? 'volume';
  const value = data?.value ?? 0;
  const isMuted = type === 'mute';
  const clampedValue = Math.max(0, Math.min(100, value));
  const filledSegments = isMuted ? 0 : Math.round((clampedValue / 100) * SEGMENT_COUNT);

  // Choose the label to display
  const label = data?.label
    ? data.label
    : isMuted
      ? (value === 1 ? 'Muted' : 'Unmuted')
      : `${clampedValue}%`;

  // Choose the icon based on type
  const IconComponent = type === 'brightness'
    ? Sun
    : isMuted
      ? VolumeX
      : Volume2;

  return (
    <>
      <style>{`
        .osd-container {
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          user-select: none;
          pointer-events: none;
        }

        .osd-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 14px;
          width: 160px;
          padding: 24px 20px 20px;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 20px;
          color: #ffffff;
          opacity: 0;
          transform: scale(0.85);
          transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .osd-card.osd-visible {
          opacity: 1;
          transform: scale(1);
        }

        .osd-icon {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .osd-bar {
          display: flex;
          gap: 3px;
          width: 100%;
          justify-content: center;
        }

        .osd-segment {
          width: 6px;
          height: 6px;
          border-radius: 1.5px;
          background: rgba(255, 255, 255, 0.2);
          transition: background 0.15s ease;
        }

        .osd-segment.osd-segment-filled {
          background: #ffffff;
        }

        .osd-label {
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.5px;
          text-align: center;
          white-space: nowrap;
        }
      `}</style>

      <div className="osd-container">
        <div className={`osd-card ${visible ? 'osd-visible' : ''}`}>
          {/* Icon */}
          <div className="osd-icon">
            <IconComponent size={48} strokeWidth={1.5} color="#ffffff" />
          </div>

          {/* Progress bar (hidden for mute type) */}
          {!isMuted && (
            <div className="osd-bar">
              {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
                <div
                  key={i}
                  className={`osd-segment ${i < filledSegments ? 'osd-segment-filled' : ''}`}
                />
              ))}
            </div>
          )}

          {/* Label */}
          <div className="osd-label">{label}</div>
        </div>
      </div>
    </>
  );
}
