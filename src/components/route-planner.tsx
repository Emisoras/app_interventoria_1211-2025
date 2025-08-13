// src/components/route-planner.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown, Edit, Loader2, Plus, Save, Trash2, MapIcon } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { getTechnicians, getCampuses, saveRoute, getRoutes, deleteRoute, type Route } from '@/app/actions';
import type { Campus } from '@/lib/schemas';
import { RouteSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

const routeFormSchema = RouteSchema.omit({ technicianName: true, status: true, createdAt: true, updatedAt: true });

type RouteFormData = z.infer<typeof routeFormSchema>;

type Technician = {
  _id: string;
  username: string;
};

const statusMap: Record<Route['status'], { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-500' },
    en_curso: { label: 'En Curso', color: 'bg-blue-500' },
    completada: { label: 'Completada', color: 'bg-green-500' },
    cancelada: { label: 'Cancelada', color: 'bg-red-500' },
};


export function RoutePlanner({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [technicians, setTechnicians] = React.useState<Technician[]>([]);
  const [campuses, setCampuses] = React.useState<Campus[]>([]);
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingRoute, setEditingRoute] = React.useState<Route | null>(null);

  const form = useForm<RouteFormData>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: {
      technicianId: '',
      date: undefined,
      campusIds: [],
      observations: '',
    },
  });

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    const [techData, campusData, routeData] = await Promise.all([
      getTechnicians(),
      getCampuses(),
      getRoutes(),
    ]);
    setTechnicians(techData);
    setCampuses(campusData);
    setRoutes(routeData);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const campusMap = React.useMemo(() => {
    return new Map(campuses.map(c => [c._id, c]));
  }, [campuses]);

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    form.reset({
      _id: route._id,
      technicianId: route.technicianId,
      date: new Date(route.date),
      campusIds: route.campusIds,
      observations: route.observations,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleDelete = async (id: string) => {
    const result = await deleteRoute(id);
    if (result.success) {
      toast({ title: 'Ruta Eliminada' });
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }

  const handleOpenGoogleMaps = (route: Route) => {
    const validCampuses = route.campusIds
      .map(id => campusMap.get(id))
      .filter((c): c is Campus => !!(c && c.latitude && c.longitude));
    
    if (validCampuses.length === 0) {
        toast({variant: 'destructive', title: 'Datos insuficientes', description: 'Ninguna de las sedes en esta ruta tiene coordenadas válidas.'});
        return;
    }

    const formatLocation = (campus: Campus) => `${campus.latitude},${campus.longitude}`;
    
    let url = `https://www.google.com/maps/dir/?api=1`;

    const destination = validCampuses[validCampuses.length - 1];
    const waypoints = validCampuses.slice(0, -1);
        
    url += `&destination=${formatLocation(destination)}`;
    
    if (waypoints.length > 0) {
      url += `&waypoints=${waypoints.map(formatLocation).join('|')}`;
    }
    
    window.open(url, '_blank');
  };

  const onSubmit = async (data: RouteFormData) => {
    setIsSaving(true);
    const technician = technicians.find(t => t._id === data.technicianId);
    if (!technician) {
        toast({ variant: 'destructive', title: 'Error', description: 'Técnico no encontrado.' });
        setIsSaving(false);
        return;
    }

    const result = await saveRoute({
      ...data,
      technicianName: technician.username,
      status: editingRoute?.status || 'pendiente',
    });

    setIsSaving(false);
    if (result.success) {
      toast({ title: `Ruta ${editingRoute ? 'actualizada' : 'creada'} exitosamente.` });
      form.reset({ technicianId: '', date: undefined, campusIds: [], observations: '' });
      setEditingRoute(null);
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error al guardar la ruta', description: result.error });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {canEdit && (
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{editingRoute ? 'Editar Ruta' : 'Asignar Nueva Ruta'}</CardTitle>
              <CardDescription>Seleccione un técnico, fecha y las sedes a visitar.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                   <FormField
                        control={form.control}
                        name="technicianId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Técnico de Campo</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                    {field.value ? technicians.find(t => t._id === field.value)?.username : "Seleccione un técnico"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Buscar técnico..." />
                                    <CommandList>
                                        <CommandEmpty>No se encontraron técnicos.</CommandEmpty>
                                        <CommandGroup>
                                            {technicians.map((tech) => (
                                            <CommandItem value={tech.username} key={tech._id} onSelect={() => form.setValue("technicianId", tech._id)}>
                                                <Check className={cn("mr-2 h-4 w-4", tech._id === field.value ? "opacity-100" : "opacity-0")} />
                                                {tech.username}
                                            </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Fecha de la Ruta</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Seleccione una fecha</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} /></PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="campusIds"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Sedes a Visitar</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant="outline" role="combobox" className="w-full justify-between">
                                <span className="truncate">
                                    {field.value?.length > 0 ? `${field.value.length} sede(s) seleccionada(s)` : "Seleccione las sedes"}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar sede..." />
                                <ScrollArea className="h-72">
                                <CommandList>
                                    <CommandEmpty>No se encontró la sede.</CommandEmpty>
                                    <CommandGroup>
                                        {campuses.map((campus) => (
                                        <CommandItem key={campus._id} value={campus.name} onSelect={() => {
                                            const selected = field.value || [];
                                            const isSelected = selected.includes(campus._id);
                                            const newSelection = isSelected ? selected.filter(id => id !== campus._id) : [...selected, campus._id];
                                            field.onChange(newSelection);
                                        }}>
                                            <Check className={cn("mr-2 h-4 w-4", (field.value || []).includes(campus._id) ? "opacity-100" : "opacity-0")} />
                                            {campus.name}
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                                </ScrollArea>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observaciones (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Instrucciones especiales para el técnico..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingRoute ? 'Actualizar Ruta' : 'Guardar Ruta'}
                    </Button>
                    {editingRoute && (
                        <Button variant="outline" type="button" onClick={() => { setEditingRoute(null); form.reset({ technicianId: '', date: undefined, campusIds: [], observations: '' }); }}>Cancelar Edición</Button>
                    )}
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      )}
      <div className={canEdit ? "lg:col-span-2" : "lg:col-span-3"}>
        <Card>
          <CardHeader>
            <CardTitle>Rutas Asignadas</CardTitle>
            <CardDescription>Lista de todas las rutas programadas para los técnicos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Sedes Asignadas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : routes.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">No hay rutas asignadas.</TableCell></TableRow>
                  ) : (
                    routes.map((route) => (
                      <TableRow key={route._id}>
                        <TableCell className="font-medium">{route.technicianName}</TableCell>
                        <TableCell>{format(new Date(route.date), 'PPP', { locale: es })}</TableCell>
                        <TableCell>
                          <ul className="list-disc pl-5">
                            {route.campusIds.map(id => <li key={id}>{campusMap.get(id)?.name || 'Sede desconocida'}</li>)}
                          </ul>
                        </TableCell>
                        <TableCell>
                            <Badge className={cn('text-white', statusMap[route.status].color)}>
                                {statusMap[route.status].label}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                             <Button variant="ghost" size="icon" title="Abrir en Google Maps" onClick={() => handleOpenGoogleMaps(route)}>
                                 <MapIcon className="h-4 w-4"/>
                            </Button>
                            {canEdit && (
                            <>
                                <Button variant="ghost" size="icon" title="Editar Ruta" onClick={() => handleEdit(route)}>
                                    <Edit className="h-4 w-4"/>
                                </Button>
                                <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" title="Eliminar Ruta" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción eliminará la ruta permanentemente.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(route._id!)} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            </>
                            )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
