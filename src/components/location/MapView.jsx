import { useRef } from 'react';
import { locationService } from '../../services/locationService';

export function MapView({ center = locationService.getDefaultMapCenter(), pin = center, onPinChange, markers = [] }) {
  const mapRef = useRef(null);
  const normalizedPin = {
    x: Math.min(92, Math.max(8, 50 + ((pin.longitude - center.longitude) * 950))),
    y: Math.min(86, Math.max(14, 52 - ((pin.latitude - center.latitude) * 950))),
  };

  const updatePin = (event) => {
    if (!onPinChange || event.target.closest('.map-view__pin')) return;
    const bounds = mapRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    onPinChange({
      latitude: center.latitude + ((0.52 - y) * 0.012),
      longitude: center.longitude + ((x - 0.5) * 0.012),
    });
  };

  const handlePinDrag = (event) => {
    if (!onPinChange) return;
    const bounds = mapRef.current.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    onPinChange({
      latitude: center.latitude + ((0.52 - y) * 0.012),
      longitude: center.longitude + ((x - 0.5) * 0.012),
    });
  };

  return (
    <div className="map-view" ref={mapRef} onPointerUp={updatePin} aria-label="Map preview">
      <svg className="map-view__art" viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated neighborhood map">
        <rect width="640" height="240" fill="#eaf0e8" />
        <path d="M-20 62 L180 138 L325 40 L670 153 M30 280 L198 100 L335 270 L493 -10 M-30 192 L254 18 L680 80" fill="none" stroke="#fff" strokeWidth="17" />
        <path d="M-20 62 L180 138 L325 40 L670 153 M30 280 L198 100 L335 270 L493 -10 M-30 192 L254 18 L680 80" fill="none" stroke="#d7d1c5" strokeWidth="2" />
        <path d="M70 18h90v54H70z M360 95h112v76H360z M230 155h76v48h-76z M520 20h70v48h-70z" fill="#dce8d9" />
        <path d="M0 224h640" stroke="#b9dbe1" strokeWidth="22" />
        {markers.map((marker) => <circle key={`${marker.latitude}-${marker.longitude}`} cx="72%" cy="35%" r="7" fill="#1f5c4a" stroke="#fff" strokeWidth="3" />)}
        <circle
          className="map-view__pin"
          cx={normalizedPin.x * 6.4}
          cy={normalizedPin.y * 2.4}
          r="9"
          fill="#b8481a"
          stroke="#fff"
          strokeWidth="4"
          tabIndex="0"
          role="button"
          aria-label="Drag to adjust delivery pin"
          onPointerDown={(event) => event.currentTarget.setPointerCapture(event.pointerId)}
          onPointerUp={handlePinDrag}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') onPinChange?.({ latitude: pin.latitude + 0.0002, longitude: pin.longitude });
            if (event.key === 'ArrowDown') onPinChange?.({ latitude: pin.latitude - 0.0002, longitude: pin.longitude });
            if (event.key === 'ArrowLeft') onPinChange?.({ latitude: pin.latitude, longitude: pin.longitude - 0.0002 });
            if (event.key === 'ArrowRight') onPinChange?.({ latitude: pin.latitude, longitude: pin.longitude + 0.0002 });
          }}
        />
      </svg>
      <span className="map-view__caption">Drag the pin to fine-tune your location</span>
    </div>
  );
}

export default MapView;
