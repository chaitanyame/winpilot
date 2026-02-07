// OSD (On-Screen Display) Overlay Component
// Shows visual feedback for volume, brightness, and mute changes

import { useState, useEffect } from 'react';
import { Volume2, VolumeX, Sun } from 'lucide-react';

interface OSDData {
  type: 'volume' | 'brightness' | 'mute';
  value: number;
  label?: string;
}

export function OSDOverlay() {
  const [data, setData] = useState<OSDData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleUpdate = (_: unknown, osdData: { type: string; value: number; label?: string }) => {
      setData(osdData as OSDData);
      setVisible(true);
    };

    const handleHide = () => {
      setVisible(false);
    };

    window.electronAPI?.onOSDUpdate?.(handleUpdate);
    window.electronAPI?.onOSDHide?.(handleHide);

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  if (!data) return null;

  const getIcon = () => {
    switch (data.type) {
      case 'volume': return <Volume2 size={48} />;
      case 'mute': return <VolumeX size={48} />;
      case 'brightness': return <Sun size={48} />;
    }
  };

  const getLabel = () => {
    if (data.label) return data.label;
    switch (data.type) {
      case 'volume': return `Volume: ${data.value}%`;
      case 'brightness': return `Brightness: ${data.value}%`;
      case 'mute': return data.value ? 'Muted' : 'Unmuted';
    }
  };

  const segments = 16;
  const filledSegments = Math.round((data.value / 100) * segments);

  return (
    <div className={`osd-container ${visible ? 'osd-visible' : 'osd-hidden'}`}>
      <div className="osd-content">
        <div className="osd-icon">{getIcon()}</div>

        {data.type !== 'mute' && (
          <div className="osd-bar">
            {Array.from({ length: segments }, (_, i) => (
              <div
                key={i}
                className={`osd-segment ${i < filledSegments ? 'filled' : ''}`}
              />
            ))}
          </div>
        )}

        <div className="osd-label">{getLabel()}</div>
      </div>
    </div>
  );
}
