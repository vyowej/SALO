import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './DeliveryTrackingMap.css';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function validPoint(point) {
  if (!point || point.latitude === null || point.latitude === undefined
    || point.longitude === null || point.longitude === undefined) return null;

  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

function markerIcon(type) {
  return L.divIcon({
    className: 'delivery-map__icon',
    html: `<span class="delivery-map__marker delivery-map__marker--${type}" aria-hidden="true"></span>`,
    iconSize: [48, 48],
    iconAnchor: [24, 44],
  });
}

function TrackingMapCanvas({ riderPoint, destinationPoint, className }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const riderMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);
  const initialPointRef = useRef(riderPoint || destinationPoint);
  const [tileError, setTileError] = useState('');
  const riderLatitude = riderPoint?.latitude ?? null;
  const riderLongitude = riderPoint?.longitude ?? null;
  const destinationLatitude = destinationPoint?.latitude ?? null;
  const destinationLongitude = destinationPoint?.longitude ?? null;

  useEffect(() => {
    if (!canvasRef.current || !initialPointRef.current) return undefined;

    const initialPoint = initialPointRef.current;
    const map = L.map(canvasRef.current, {
      center: [initialPoint.latitude, initialPoint.longitude],
      zoom: 14,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });
    const tiles = L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);
    tiles.on('tileerror', () => setTileError('Map tiles are unavailable. Live coordinates may still be current.'));
    tiles.on('tileload', () => setTileError(''));

    mapRef.current = map;
    const resize = () => map.invalidateSize({ pan: false });
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(resize);
    resizeObserver?.observe(canvasRef.current);
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
      map.remove();
      mapRef.current = null;
      riderMarkerRef.current = null;
      destinationMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const rider = riderLatitude === null
      ? null
      : { latitude: riderLatitude, longitude: riderLongitude };
    const destination = destinationLatitude === null
      ? null
      : { latitude: destinationLatitude, longitude: destinationLongitude };
    const syncMarker = (markerRef, point, type, title) => {
      if (!point) {
        markerRef.current?.remove();
        markerRef.current = null;
        return;
      }

      if (!markerRef.current) {
        markerRef.current = L.marker([point.latitude, point.longitude], {
          icon: markerIcon(type),
          keyboard: false,
          title,
        }).addTo(map);
        markerRef.current.bindTooltip(title);
        return;
      }

      markerRef.current.setLatLng([point.latitude, point.longitude]);
    };

    syncMarker(riderMarkerRef, rider, 'rider', 'Rider location');
    syncMarker(destinationMarkerRef, destination, 'destination', 'Delivery destination');

    const points = [rider, destination].filter(Boolean);
    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((point) => [point.latitude, point.longitude])),
        { padding: [40, 40], maxZoom: 15 },
      );
    } else if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
    }
  }, [riderLatitude, riderLongitude, destinationLatitude, destinationLongitude]);

  return (
    <div className={`delivery-map ${className}`.trim()}>
      <div
        ref={canvasRef}
        className="delivery-map__canvas"
        role="region"
        aria-label="Delivery tracking map"
        aria-roledescription="map"
      />
      {tileError ? <p className="delivery-map__message" role="status">{tileError}</p> : null}
      <div className="delivery-map__legend" aria-label="Map markers">
        {riderPoint ? <span><i className="delivery-map__legend-marker delivery-map__legend-marker--rider" />Rider</span> : null}
        {destinationPoint ? <span><i className="delivery-map__legend-marker delivery-map__legend-marker--destination" />Destination</span> : null}
      </div>
    </div>
  );
}

export default function DeliveryTrackingMap({ rider, destination, className = '' }) {
  const riderPoint = validPoint(rider);
  const destinationPoint = validPoint(destination);

  if (!riderPoint && !destinationPoint) {
    return <p className={`delivery-map__message ${className}`.trim()} role="status">Map coordinates are unavailable.</p>;
  }

  return (
    <TrackingMapCanvas
      riderPoint={riderPoint}
      destinationPoint={destinationPoint}
      className={className}
    />
  );
}
