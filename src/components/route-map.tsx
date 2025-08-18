// src/components/route-map.tsx
'use client';

import { getRoutes, getCampuses, type Route, type Campus } from '@/app/actions';
import React, { useEffect, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MapDisplay } from './map-display';

interface RouteMapProps {
    userRole: string | null;
    userId: string | null;
}

export function RouteMap({ userRole, userId }: RouteMapProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [routeData, campusData] = await Promise.all([getRoutes(), getCampuses()]);
      setRoutes(routeData);
      setCampuses(campusData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const activeRoutes = useMemo(() => {
    let filteredRoutes = routes;
    if (userRole === 'tecnico_campo' && userId) {
        filteredRoutes = routes.filter(route => route.technicianId === userId);
    }
    
    return filteredRoutes.filter(route => 
      route.stops && route.stops.some(stop => stop.status !== 'visitada')
    );
  }, [routes, userRole, userId]);
  
  if (loading) {
    return (
      <Card>
        <CardHeader>
           <CardTitle>Mapa de Rutas Activas</CardTitle>
           <CardDescription>Visualización de todas las rutas en curso. Las rutas completadas no se muestran.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="ml-4">Cargando datos de rutas...</p>
            </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mapa de Rutas Activas</CardTitle>
        <CardDescription>Visualización de las rutas en curso. Las rutas completadas no se muestran.</CardDescription>
      </CardHeader>
      <CardContent>
        {activeRoutes.length > 0 ? (
          <MapDisplay activeRoutes={activeRoutes} campuses={campuses} />
        ) : (
          <div className="h-96 w-full bg-muted rounded-lg flex items-center justify-center">
            <p>No hay rutas activas para mostrar en el mapa.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
