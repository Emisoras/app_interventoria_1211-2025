
// src/components/route-planner.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown, Edit, Loader2, Plus, Save, Trash2, MapIcon, GripVertical, X as XIcon, DollarSign, Wallet, Clock, User, FileDown } from 'lucide-react';
import * as React from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { z } from 'zod';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


import { getTechnicians, getCampuses, saveRoute, getRoutes, deleteRoute, updateRouteStopStatus, type Route, type RouteStopStatus, type Campus, type RouteStop } from '@/app/actions';
import { RouteStopSchema, RouteSchema } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';


const routeFormSchema = RouteSchema.omit({ technicianName: true, createdAt: true, updatedAt: true });

type RouteFormData = z.infer<typeof routeFormSchema>;

type Technician = {
  _id: string;
  username: string;
};

const statusMap: Record<RouteStopStatus, { label: string; color: string }> = {
    pendiente: { label: 'Pendiente', color: 'bg-yellow-500' },
    en_proceso: { label: 'En Proceso', color: 'bg-blue-500' },
    visitada: { label: 'Visitada', color: 'bg-green-500' },
};

const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
};

interface RoutePlannerProps {
    canEdit: boolean;
    userRole: string | null;
    userId: string | null;
}


export function RoutePlanner({ canEdit, userRole, userId }: RoutePlannerProps) {
  const { toast } = useToast();
  const [technicians, setTechnicians] = React.useState<Technician[]>([]);
  const [campuses, setCampuses] = React.useState<Campus[]>([]);
  const [routes, setRoutes] = React.useState<Route[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [editingRoute, setEditingRoute] = React.useState<Route | null>(null);
  const [selectedCampus, setSelectedCampus] = React.useState<string>('');
  const [currentLocation, setCurrentLocation] = React.useState<{lat: number, lon: number} | null>(null);

  const form = useForm<RouteFormData>({
    resolver: zodResolver(routeFormSchema),
    defaultValues: {
      technicianId: '',
      date: undefined,
      stops: [],
      observations: '',
    },
  });

  const { fields, append, remove, move, update } = useFieldArray({
    control: form.control,
    name: "stops",
  });
  
  React.useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          if (error.code === error.PERMISSION_DENIED) {
              toast({
                  variant: 'destructive',
                  title: 'Ubicación denegada',
                  description: 'No se pudo obtener la ubicación actual para el punto de partida.',
              });
          }
        }
      );
    }
  }, [toast]);

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

  const displayedRoutes = React.useMemo(() => {
    if (userRole === 'tecnico_campo' && userId) {
        return routes.filter(route => route.technicianId === userId);
    }
    return routes;
  }, [routes, userRole, userId]);

  const campusMap = React.useMemo(() => {
    return new Map(campuses.map(c => [c._id, c]));
  }, [campuses]);
  
  const handleAddStop = () => {
    if (selectedCampus) {
        const campusExists = fields.some(field => field.campusId === selectedCampus);
        if (campusExists) {
            toast({
                variant: 'destructive',
                title: 'Sede Duplicada',
                description: 'Esta sede ya ha sido añadida a la ruta.',
            });
            return;
        }
        append({ campusId: selectedCampus, status: 'pendiente', costs: [], visitTime: 90 });
        setSelectedCampus('');
    }
  };

  const handleEdit = (route: Route) => {
    setEditingRoute(route);
    form.reset({
      _id: route._id,
      technicianId: route.technicianId,
      date: new Date(route.date),
      stops: (route.stops || []).map(stop => ({
          ...stop,
          visitTime: stop.visitTime ?? 90, // Ensure default value
      })),
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
    const validCampuses = (route.stops || [])
      .map(stop => campusMap.get(stop.campusId))
      .filter((c): c is Campus => !!(c && c.latitude && c.longitude));
  
    if (validCampuses.length === 0) {
      toast({ variant: 'destructive', title: 'Datos insuficientes', description: 'Ninguna de las sedes en esta ruta tiene coordenadas válidas.' });
      return;
    }
  
    const waypoints = validCampuses.map(c => `${c.latitude},${c.longitude}`);
    let url = 'https://www.google.com/maps/dir/';

    if (currentLocation) {
        url += `${currentLocation.lat},${currentLocation.lon}/`;
    }
    
    url += waypoints.join('/');
    
    window.open(url, '_blank');
  };

  const handleChangeStopStatus = async (routeId: string, campusId: string, status: RouteStopStatus) => {
     const result = await updateRouteStopStatus(routeId, campusId, status);
     if (result.success) {
        toast({ title: 'Estado actualizado', description: `La sede ha sido marcada como ${statusMap[status].label}.` });
        fetchData();
     } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
     }
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
    });

    setIsSaving(false);
    if (result.success) {
      toast({ title: `Ruta ${editingRoute ? 'actualizada' : 'creada'} exitosamente.` });
      form.reset({ technicianId: '', date: undefined, stops: [], observations: '' });
      setEditingRoute(null);
      fetchData();
    } else {
      toast({ variant: 'destructive', title: 'Error al guardar la ruta', description: result.error });
    }
  };

  const imageToDataUri = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleGenerateRouteReportPDF = async (route: Route) => {
    setIsExporting(true);
    try {
        const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
        const footerImageUrl = 'https://i.imgur.com/d0mrUFZ.jpeg';

        const [headerImageBase64, footerImageBase64] = await Promise.all([
            imageToDataUri(headerImageUrl),
            imageToDataUri(footerImageUrl),
        ]);
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;
        
        const addHeaderAndFooter = (pageNumber: number, pageCount: number) => {
            doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
            doc.addImage(footerImageBase64, 'JPEG', margin, doc.internal.pageSize.height - 20, contentWidth, 15);
            doc.setFontSize(8);
            doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });
        };
        
        // --- Document Header ---
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('Informe de Ruta de Técnico', pageWidth / 2, 40, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Técnico: ${route.technicianName}`, margin, 55);
        doc.text(`Fecha de Ruta: ${format(new Date(route.date), 'PPP', { locale: es })}`, margin, 62);
        
        let yPos = 75;

        // --- Stops ---
        for (const stop of (route.stops || [])) {
            const campus = campusMap.get(stop.campusId);
            if (!campus) continue;
            
            if (yPos > 240) {
              doc.addPage();
              yPos = 40;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(campus.name, margin, yPos);
            yPos += 7;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Contacto: ${campus.contactName || 'N/A'} - ${campus.contactPhone || 'N/A'}`, margin + 5, yPos);
            yPos += 5;
            doc.text(`Tiempo de Visita Estimado: ${stop.visitTime || 90} minutos`, margin + 5, yPos);
            yPos += 7;

            if (stop.costs && stop.costs.length > 0) {
                (doc as any).autoTable({
                    startY: yPos,
                    head: [['Descripción del Gasto', 'Valor']],
                    body: stop.costs.map(cost => [cost.description, formatCurrency(cost.amount)]),
                    theme: 'striped',
                    headStyles: { fillColor: [63, 81, 181] },
                    margin: { left: margin + 5, right: margin },
                });
                yPos = (doc as any).lastAutoTable.finalY + 10;
            } else {
                doc.text('Sin gastos registrados para esta parada.', margin + 5, yPos);
                yPos += 10;
            }
        }
        
        // --- Totals ---
        if (yPos > 250) {
          doc.addPage();
          yPos = 40;
        }

        const totalCost = (route.stops || []).reduce((total, stop) => total + (stop.costs || []).reduce((stopTotal, cost) => stopTotal + cost.amount, 0), 0);
        const totalTime = (route.stops || []).reduce((total, stop) => total + (stop.visitTime || 0), 0);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen General de la Ruta', margin, yPos);
        yPos += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Tiempo Total Estimado de Visitas: ${totalTime} minutos`, margin + 5, yPos);
        yPos += 5;
        doc.text(`Costo Total de Gastos: ${formatCurrency(totalCost)}`, margin + 5, yPos);

        // --- Add Headers and Footers to all pages ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            addHeaderAndFooter(i, pageCount);
        }

        const fileName = `Informe_Ruta_${route.technicianName.replace(/ /g, '_')}_${format(new Date(route.date), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error("Error exporting PDF:", error);
        toast({
            variant: 'destructive',
            title: 'Error al Exportar PDF',
            description: 'Hubo un problema al generar el informe.',
        });
    } finally {
        setIsExporting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {canEdit && (
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>{editingRoute ? 'Editar Ruta' : 'Asignar Nueva Ruta'}</CardTitle>
              <CardDescription>Seleccione un técnico, fecha y añada las sedes a visitar en orden.</CardDescription>
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
                  
                  <div className="space-y-4">
                     <FormLabel>Puntos de Visita y Gastos</FormLabel>
                     <div className="space-y-2">
                        {fields.map((field, index) => (
                          <StopCard
                            key={field.id}
                            index={index}
                            field={field}
                            remove={remove}
                            campusMap={campusMap}
                            control={form.control}
                          />
                        ))}
                     </div>
                     <div className="flex items-end gap-2">
                        <div className="flex-1">
                            <FormLabel htmlFor="add-campus-select" className="text-xs text-muted-foreground">Añadir Sede</FormLabel>
                            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                                <SelectTrigger id="add-campus-select">
                                    <SelectValue placeholder="Seleccione una sede para añadir" />
                                </SelectTrigger>
                                <SelectContent>
                                    {campuses.map(campus => (
                                        <SelectItem key={campus._id} value={campus._id}>
                                            <span className="font-medium">{campus.name}</span>
                                             {campus.contactName && <span className="text-xs text-muted-foreground ml-2">({campus.contactName} - {campus.contactPhone})</span>}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="button" onClick={handleAddStop} disabled={!selectedCampus}><Plus className="mr-2 h-4 w-4"/> Añadir Punto</Button>
                     </div>
                     <FormField control={form.control} name="stops" render={({ fieldState }) => <FormMessage>{fieldState.error?.message}</FormMessage>} />
                  </div>

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
                        <Button variant="outline" type="button" onClick={() => { setEditingRoute(null); form.reset({ technicianId: '', date: undefined, stops: [], observations: '' }); }}>Cancelar Edición</Button>
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
            <div className="border rounded-md max-h-[800px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Ruta y Detalles</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                  ) : displayedRoutes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center">No hay rutas asignadas.</TableCell></TableRow>
                  ) : (
                    displayedRoutes.map((route) => {
                      const totalCost = (route.stops || []).reduce((total, stop) => {
                          return total + (stop.costs || []).reduce((stopTotal, cost) => stopTotal + cost.amount, 0);
                      }, 0);
                      const totalTime = (route.stops || []).reduce((total, stop) => total + (stop.visitTime || 0), 0);
                      return (
                      <TableRow key={route._id}>
                        <TableCell className="font-medium">{route.technicianName}</TableCell>
                        <TableCell>{format(new Date(route.date), 'PPP', { locale: es })}</TableCell>
                        <TableCell>
                          <ul className="space-y-2">
                            {(route.stops || []).map(stop => {
                                const campus = campusMap.get(stop.campusId);
                                return (
                                <li key={stop.campusId} className="flex items-start justify-between gap-2 border-b last:border-b-0 py-1">
                                   <div className="flex flex-col">
                                       <span className='font-medium'>{campus?.name || 'Sede desconocida'}</span>
                                        {campus?.contactName && (
                                            <div className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/>
                                                <span>{campus.contactName} - {campus.contactPhone}</span>
                                            </div>
                                        )}
                                       <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />
                                          <span>Tiempo Visita: {stop.visitTime ?? 'N/A'} min</span>
                                       </div>
                                       {(stop.costs || []).length > 0 && (
                                           <div className="text-xs text-muted-foreground pl-1">
                                               {stop.costs?.map((cost, i) => (
                                                   <div key={i} className='flex items-center gap-1'><Wallet className="h-3 w-3"/>{cost.description}: {formatCurrency(cost.amount)}</div>
                                               ))}
                                           </div>
                                       )}
                                   </div>
                                   <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                             <Badge variant="secondary" className={cn("cursor-pointer", statusMap[stop.status].color, 'text-white')}>
                                                {statusMap[stop.status].label}
                                             </Badge>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            {Object.entries(statusMap).map(([key, {label}]) => (
                                                <DropdownMenuItem 
                                                    key={key} 
                                                    disabled={stop.status === key || (!canEdit && userRole !== 'tecnico_campo')}
                                                    onClick={() => handleChangeStopStatus(route._id!, stop.campusId, key as RouteStopStatus)}
                                                >
                                                    {label}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                   </DropdownMenu>
                                </li>
                            )})}
                          </ul>
                            <div className="font-bold text-right mt-2 pt-2 border-t flex flex-col items-end">
                                <span>Total Gastos: {formatCurrency(totalCost)}</span>
                                <span>Tiempo Visitas: {totalTime} min</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <ChevronsUpDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleOpenGoogleMaps(route)}>
                                        <MapIcon className="mr-2 h-4 w-4"/> Ver en Google Maps
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleGenerateRouteReportPDF(route)} disabled={isExporting}>
                                        <FileDown className="mr-2 h-4 w-4"/> Generar Informe
                                    </DropdownMenuItem>
                                    {canEdit && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => handleEdit(route)}>
                                                <Edit className="mr-2 h-4 w-4"/> Editar Ruta
                                            </DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4"/> Eliminar Ruta
                                                    </DropdownMenuItem>
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
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )})
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

// Sub-component for managing a single stop in the form
interface StopCardProps {
    index: number;
    field: RouteStop & {id: string};
    remove: (index: number) => void;
    campusMap: Map<string, Campus>;
    control: any;
}

function StopCard({ index, field, remove, campusMap, control }: StopCardProps) {
  const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({
    control,
    name: `stops.${index}.costs`
  });

  const [newCost, setNewCost] = React.useState({ description: '', amount: '' });
  const campus = campusMap.get(field.campusId);

  const handleAddCost = () => {
    if (newCost.description && newCost.amount) {
        appendCost({ description: newCost.description, amount: parseFloat(newCost.amount) });
        setNewCost({ description: '', amount: '' });
    }
  };

  return (
    <Card className="bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between p-3">
            <div className="flex items-center gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                <div className="flex flex-col">
                    <p className="font-medium">{campus?.name || 'Sede desconocida'}</p>
                    <p className="text-xs text-muted-foreground">{campus?.municipality}</p>
                     {campus?.contactName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3"/>{campus.contactName} - {campus.contactPhone}</p>
                    )}
                </div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(index)}>
                <XIcon className="h-4 w-4 text-destructive" />
            </Button>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
            <Controller
                control={control}
                name={`stops.${index}.visitTime`}
                render={({ field }) => (
                    <div className="space-y-1">
                        <Label htmlFor={field.name} className="text-xs">Tiempo de Visita (minutos)</Label>
                        <Input
                            id={field.name}
                            type="number"
                            placeholder="Ej. 90"
                            className="h-9"
                            {...field}
                        />
                    </div>
                )}
            />
             <div className="space-y-2">
                <Label className="text-xs">Gastos de la Parada</Label>
                {costFields.map((costField, costIndex) => (
                    <div key={costField.id} className="flex items-center gap-2">
                       <Controller
                           control={control}
                           name={`stops.${index}.costs.${costIndex}.description`}
                           render={({ field }) => <Input {...field} placeholder="Descripción" className="h-8" />}
                       />
                        <Controller
                           control={control}
                           name={`stops.${index}.costs.${costIndex}.amount`}
                           render={({ field }) => <Input type="number" {...field} placeholder="Valor" className="h-8" onChange={e => field.onChange(parseFloat(e.target.value))} />}
                       />
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeCost(costIndex)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
                 <div className="flex items-end gap-2">
                     <div className="flex-1">
                         <Label className="text-xs text-muted-foreground">Nuevo Gasto</Label>
                         <div className="flex gap-2">
                            <Input placeholder="Descripción" value={newCost.description} onChange={e => setNewCost({...newCost, description: e.target.value})} className="h-9"/>
                            <Input placeholder="Valor" type="number" value={newCost.amount} onChange={e => setNewCost({...newCost, amount: e.target.value})} className="h-9"/>
                         </div>
                     </div>
                     <Button type="button" size="sm" onClick={handleAddCost}>Añadir</Button>
                 </div>
             </div>
        </CardContent>
    </Card>
  )
}
