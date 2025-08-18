// src/components/map-display.tsx
'use client';

import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import "leaflet-defaulticon-compatibility";

import L from 'leaflet';
import React, { useEffect, useMemo, useRef } from 'react';
import type { Route, Campus, RouteStopStatus } from '@/app/actions';
import { cn } from '@/lib/utils';

const routeColors = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1', '#A133FF',
  '#33FFA1', '#FFC300', '#DAF7A6', '#C70039', '#900C3F'
];

const statusMap: Record<RouteStopStatus, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-500' },
    en_proceso: { label: 'En Proceso', color: 'bg-blue-500' },
    visitada: { label: 'Visitada', color: 'bg-green-500' },
};

interface MapDisplayProps {
    activeRoutes: Route[];
    campuses: Campus[];
}

export function MapDisplay({ activeRoutes, campuses }: MapDisplayProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup>(new L.LayerGroup());

  const campusMap = useMemo(() => {
    return new Map(campuses.map(c => [c._id, c]));
  }, [campuses]);
  
  const centerPoint = useMemo(() => {
    for (const route of activeRoutes) {
      for (const stop of route.stops || []) {
        const campus = campusMap.get(stop.campusId);
        if (campus?.latitude && campus?.longitude) {
          return [campus.latitude, campus.longitude] as [number, number];
        }
      }
    }
    return [7.9139, -72.5078] as [number, number]; // Default to Cúcuta
  }, [activeRoutes, campusMap]);

  useEffect(() => {
    // Initialize map only if it hasn't been initialized yet
    if (mapRef.current && !leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current).setView(centerPoint, 10);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMapRef.current);
        
        layersRef.current.addTo(leafletMapRef.current);
    }
    
    // Cleanup function to run when the component unmounts
    return () => {
        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
        }
    };
  }, [centerPoint]); 
  
  useEffect(() => {
      if (!leafletMapRef.current) return;
      
      // Clear previous routes and markers
      layersRef.current.clearLayers();

      activeRoutes.forEach((route, index) => {
        const path = (route.stops || [])
            .map(stop => campusMap.get(stop.campusId))
            .filter((c): c is Campus => !!(c && c.latitude && c.longitude))
            .map(c => [c.latitude!, c.longitude!] as [number, number]);
        
        const color = routeColors[index % routeColors.length];

        if (path.length > 0) {
            L.polyline(path, { color }).addTo(layersRef.current);
        }

        (route.stops || []).forEach(stop => {
            const campus = campusMap.get(stop.campusId);
            if (!campus || !campus.latitude || !campus.longitude) return;
            const stopStatus = stop.status || 'pendiente';
            
            const popupContent = `
                <div class="font-bold">${campus.name}</div>
                <p>Técnico: ${route.technicianName}</p>
                <span class="px-2 py-1 text-xs rounded-full text-white ${statusMap[stopStatus].color}">
                    ${statusMap[stopStatus].label}
                </span>
            `;

            L.marker([campus.latitude, campus.longitude])
                .bindPopup(popupContent)
                .addTo(layersRef.current);
        });
      });

  }, [activeRoutes, campusMap, campuses]);


  return (
    <div ref={mapRef} className="h-96 w-full rounded-lg overflow-hidden" />
  );
}
