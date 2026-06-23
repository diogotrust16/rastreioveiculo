import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LivePosition } from '@workspace/api-client-react/src/generated/api.schemas';
import { useSocket } from '@/hooks/use-socket';
import { useQueryClient } from '@tanstack/react-query';
import { getGetLivePositionsQueryKey } from '@workspace/api-client-react';

// Fix Leaflet's default icon path issues
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: iconRetina,
  iconUrl: icon,
  shadowUrl: iconShadow,
});

// Custom icon for vehicles
const createVehicleIcon = (status: string) => L.divIcon({
  className: 'custom-vehicle-icon',
  html: `<div class="w-4 h-4 rounded-full border-2 border-background shadow-[0_0_10px_rgba(0,0,0,0.5)] ${status === 'ONLINE' ? 'bg-primary' : 'bg-muted-foreground'}"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8]
});

interface LiveMapProps {
  positions: LivePosition[];
}

export default function LiveMap({ positions }: LiveMapProps) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    const handlePositionUpdate = (newPos: LivePosition) => {
      queryClient.setQueryData<LivePosition[]>(getGetLivePositionsQueryKey(), (old = []) => {
        const index = old.findIndex(p => p.vehicleId === newPos.vehicleId);
        if (index >= 0) {
          const updated = [...old];
          updated[index] = newPos;
          return updated;
        }
        return [...old, newPos];
      });
    };

    socket.on('vehicle:position', handlePositionUpdate);
    return () => {
      socket.off('vehicle:position', handlePositionUpdate);
    };
  }, [socket, queryClient]);

  // Default center (could be calculated from positions)
  const center: [number, number] = positions.length > 0 
    ? [positions[0].latitude, positions[0].longitude] 
    : [39.8283, -98.5795]; // US center

  return (
    <div className="absolute inset-0 z-0">
      <MapContainer 
        center={center} 
        zoom={positions.length > 0 ? 10 : 4} 
        style={{ height: '100%', width: '100%', background: 'hsl(var(--background))' }}
        className="dark-map"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
        />
        {positions.map((pos) => (
          <Marker 
            key={pos.vehicleId} 
            position={[pos.latitude, pos.longitude]}
            icon={createVehicleIcon(pos.status)}
          >
            <Popup className="dark-popup">
              <div className="p-1">
                <div className="font-bold text-sm mb-1">{pos.plate}</div>
                <div className="text-xs text-muted-foreground">{pos.model}</div>
                <div className="text-xs mt-2 font-mono">Spd: {pos.speed} km/h</div>
                <div className="text-xs font-mono">Ign: {pos.ignition ? 'ON' : 'OFF'}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <style>{`
        .leaflet-container {
          background-color: hsl(var(--background)) !important;
        }
        .dark-popup .leaflet-popup-content-wrapper {
          background-color: hsl(var(--card));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
        }
        .dark-popup .leaflet-popup-tip {
          background-color: hsl(var(--card));
          border: 1px solid hsl(var(--border));
        }
      `}</style>
    </div>
  );
}
