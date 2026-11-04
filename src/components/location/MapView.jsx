import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { locationService } from '../../services/locationService';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const validCoordinates = (candidate) => {
  if (
    !candidate
    || candidate.latitude === null
    || candidate.latitude === undefined
    || candidate.longitude === null
    || candidate.longitude === undefined
  ) return null;

  const latitude = Number(candidate.latitude);
  const longitude = Number(candidate.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    ? { latitude, longitude }
    : null;
};

const markerIcon = L.divIcon({
  className: 'map-view__marker-icon',
  html: '<span aria-hidden="true"></span>',
  iconSize: [44, 44],
  iconAnchor: [22, 42],
});

export function MapView({
  center = locationService.getDefaultMapCenter(),
  pin = center,
  onPinChange,
  markers = [],
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const pinMarkerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const dragRequestRef = useRef(0);
  const onPinChangeRef = useRef(onPinChange);
  const skipNextCenterPanRef = useRef(false);
  const centerRef = useRef(center);
  const pinRef = useRef(pin);
  const [mapError, setMapError] = useState('');
  const markerSignature = JSON.stringify(
    markers.map((marker) => [marker.latitude, marker.longitude, marker.label || '']),
  );
  const centerCoordinates = validCoordinates(center) || locationService.getDefaultMapCenter();
  const pinCoordinates = validCoordinates(pin) || centerCoordinates;
  const centerLatitude = centerCoordinates.latitude;
  const centerLongitude = centerCoordinates.longitude;
  const pinLatitude = pinCoordinates.latitude;
  const pinLongitude = pinCoordinates.longitude;

  useEffect(() => {
    onPinChangeRef.current = onPinChange;
    centerRef.current = { latitude: centerLatitude, longitude: centerLongitude };
    pinRef.current = { latitude: pinLatitude, longitude: pinLongitude };
  }, [
    centerLatitude,
    centerLongitude,
    onPinChange,
    pinLatitude,
    pinLongitude,
  ]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    let map;
    let resizeTimer;
    let errorTimer;
    let resizeObserver;
    const invalidateSize = () => map?.invalidateSize({ pan: false });
    try {
      const initialCenter = validCoordinates(centerRef.current) || locationService.getDefaultMapCenter();
      const initialPin = validCoordinates(pinRef.current) || initialCenter;
      map = L.map(containerRef.current, {
        center: [initialCenter.latitude, initialCenter.longitude],
        zoom: 14,
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      const tileLayer = L.tileLayer(TILE_URL, {
        attribution: TILE_ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      tileLayer.on('tileerror', () => {
        setMapError('Map tiles could not be loaded. Check your connection; you can still adjust the pin.');
      });
      tileLayer.on('tileload', () => setMapError(''));

      const marker = L.marker([initialPin.latitude, initialPin.longitude], {
        draggable: Boolean(onPinChangeRef.current),
        keyboard: true,
        title: 'Drag to adjust the address pin',
        icon: markerIcon,
      }).addTo(map);
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        const dragRequest = ++dragRequestRef.current;
        const restorePin = () => {
          if (dragRequest !== dragRequestRef.current) return;
          const previousPin = validCoordinates(pinRef.current);
          if (previousPin) marker.setLatLng([previousPin.latitude, previousPin.longitude]);
          skipNextCenterPanRef.current = false;
        };
        skipNextCenterPanRef.current = true;
        const result = onPinChangeRef.current?.({ latitude: position.lat, longitude: position.lng });
        if (result && typeof result.then === 'function') {
          result.then((accepted) => {
            if (accepted !== true) restorePin();
          }).catch((error) => {
            restorePin();
            console.error('Unable to update the dragged map pin.', error);
          });
        } else if (result !== true) {
          restorePin();
        }
      });

      mapRef.current = map;
      pinMarkerRef.current = marker;
      markersLayerRef.current = L.layerGroup().addTo(map);
      resizeTimer = window.setTimeout(invalidateSize, 0);
      window.addEventListener('resize', invalidateSize, { passive: true });
      window.addEventListener('orientationchange', invalidateSize, { passive: true });
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(invalidateSize);
        resizeObserver.observe(containerRef.current);
      }
    } catch (error) {
      console.error('Unable to initialize the Leaflet map.', error);
      errorTimer = window.setTimeout(() => {
        setMapError('The map could not be initialized. You can still enter your address manually.');
      }, 0);
      map?.remove();
    }

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(errorTimer);
      window.removeEventListener('resize', invalidateSize);
      window.removeEventListener('orientationchange', invalidateSize);
      resizeObserver?.disconnect();
      map?.remove();
      mapRef.current = null;
      pinMarkerRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    onPinChangeRef.current = onPinChange;
  }, [onPinChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (skipNextCenterPanRef.current) {
      skipNextCenterPanRef.current = false;
      return;
    }
    map.panTo([centerLatitude, centerLongitude], { animate: false });
  }, [centerLatitude, centerLongitude]);

  useEffect(() => {
    const pinMarker = pinMarkerRef.current;
    if (!pinMarker) return;
    pinMarker.setLatLng([pinLatitude, pinLongitude]);
    pinMarker.dragging?.[onPinChangeRef.current ? 'enable' : 'disable']();
  }, [onPinChange, pinLatitude, pinLongitude]);

  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.forEach((marker) => {
      const coordinates = validCoordinates(marker);
      if (!coordinates) return;
      L.marker([coordinates.latitude, coordinates.longitude], {
        icon: markerIcon,
        keyboard: false,
        interactive: false,
        title: marker.label || '',
      }).addTo(layer);
    });
  }, [markerSignature, markers]);

  return (
    <div className="map-view">
      <div
        ref={containerRef}
        className="map-view__canvas"
        role="region"
        aria-label="Interactive address map"
        aria-roledescription="map"
      />
      {mapError ? <p className="map-view__message" role="status">{mapError}</p> : null}
      <span className="map-view__caption">Drag the pin to adjust your location</span>
    </div>
  );
}

export default MapView;
