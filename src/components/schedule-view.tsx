// src/components/schedule-view.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { addDays, differenceInDays, format, startOfDay, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, CalendarIcon, Edit, Loader2, Plus, Save, Trash2, X, Check, Flame, Download, Upload } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Layer, Rectangle, Polygon } from 'recharts';
import { z } from 'zod';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Papa from 'papaparse';


import { deleteScheduleTask, getScheduleTasks, saveScheduleTask, bulkSaveScheduleTasks, type ScheduleTask, ScheduleTaskStatus, ScheduleTaskPriority } from '@/app/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';


const taskSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(['por_iniciar', 'iniciada', 'en_ejecucion', 'pausada', 'ejecutada']),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']).optional(),
  justification: z.string().optional(),
  assignedTo: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  dependencies: z.array(z.string()).optional(),
  observations: z.string().optional(),
}).refine(data => {
    // If it's a group header (no dates), it's valid.
    if (!data.startDate && !data.endDate) return true;
    
    // If it's a milestone (same start/end date or just start date) we handle it, but for schema let's ensure if one exists, the other does for duration tasks
    if (data.startDate && !data.endDate) return true;
    if (!data.startDate && data.endDate) return false;
    
    if (data.startDate && data.endDate) return data.endDate >= data.startDate;
    
    return true;
}, {
    message: 'La fecha de finalización debe ser posterior o igual a la de inicio.',
    path: ['endDate'],
}).refine(data => !(data.status === 'pausada' && (!data.justification || data.justification.trim() === '')), {
    message: 'La justificación es requerida si el estado es "Pausada".',
    path: ['justification'],
});

type TaskFormData = z.infer<typeof taskSchema>;

const statusMap: Record<ScheduleTaskStatus, { label: string; color: string; fill: string }> = {
  por_iniciar: { label: 'Por Iniciar', color: 'bg-gray-500', fill: 'hsl(var(--muted-foreground))' },
  iniciada: { label: 'Iniciada', color: 'bg-blue-500', fill: 'hsl(var(--primary))' },
  en_ejecucion: { label: 'En Ejecución', color: 'bg-yellow-500', fill: 'hsl(var(--chart-4))' },
  pausada: { label: 'Pausada', color: 'bg-orange-500', fill: 'hsl(var(--chart-5))' },
  ejecutada: { label: 'Ejecutada', color: 'bg-green-500', fill: 'hsl(var(--chart-2))' },
};

const priorityMap: Record<ScheduleTaskPriority, { label: string; color: string }> = {
    baja: { label: 'Baja', color: 'bg-green-500' },
    media: { label: 'Media', color: 'bg-yellow-500' },
    alta: { label: 'Alta', color: 'bg-orange-500' },
    urgente: { label: 'Urgente', color: 'bg-red-500' },
};


interface CustomBarProps {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: any;
  isCritical: boolean;
}

const MilestoneShape = ({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) => {
  const halfSize = size / 2;
  const points = [
    { x: x, y: y - halfSize }, // Top
    { x: x + halfSize, y: y }, // Right
    { x: x, y: y + halfSize }, // Bottom
    { x: x - halfSize, y: y }, // Left
  ].map(p => `${p.x},${p.y}`).join(' ');

  return <Polygon points={points} fill={fill} />;
};


const CustomBar = (props: CustomBarProps) => {
    const { x, y, width, height, payload, isCritical } = props;
    const progress = payload.status === 'ejecutada' ? 100 : payload.progress || 0;
    
    // Check if it's a milestone (duration is 0 or 1 day)
    const isMilestone = !payload.endDate || differenceInDays(new Date(payload.endDate), new Date(payload.startDate)) <= 0;
    if (isMilestone) {
        return <MilestoneShape x={x + width / 2} y={y + height / 2} size={height * 0.8} fill={statusMap[payload.status].fill} />;
    }
    
    const progressWidth = (width * progress) / 100;

    const baseFillColor = 'hsl(var(--primary) / 0.2)';
    let progressFillColor = statusMap[payload.status].fill;
    
    return (
        <Layer>
            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                fill={baseFillColor}
                radius={[5, 5, 5, 5]}
                stroke={isCritical ? 'hsl(var(--destructive))' : 'none'}
                strokeWidth={1.5}
            />
            <Rectangle
                x={x}
                y={y}
                width={progressWidth}
                height={height}
                fill={progressFillColor}
                radius={[5, 5, 5, 5]}
            />
        </Layer>
    );
};

const DependencyLine = ({from, to}: {from: any, to: any}) => {
    if (!from || !to) return null;

    const fromX = from.x + from.width;
    const fromY = from.y + from.height / 2;
    const toX = to.x;
    const toY = to.y + to.height / 2;

    const midPointX = fromX + 15;

    const path = `M ${fromX} ${fromY} L ${midPointX} ${fromY} L ${midPointX} ${toY} L ${toX} ${toY}`;
    
    return (
        <>
            <path d={path} stroke="hsl(var(--primary))" fill="none" strokeWidth={1.5} />
            <polygon points={`${toX-5},${toY-4} ${toX},${toY} ${toX-5},${toY+4}`} fill="hsl(var(--primary))" />
        </>
    );
};


export function ScheduleView({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [tasks, setTasks] = React.useState<ScheduleTask[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = React.useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<ScheduleTask | null>(null);
  const barRefs = React.useRef<Map<string, any>>(new Map());
  const [criticalPath, setCriticalPath] = React.useState<string[]>([]);

  const fetchTasks = React.useCallback(async () => {
    setLoading(true);
    const data = await getScheduleTasks();
    setTasks(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  React.useEffect(() => {
    if (tasks.length > 0) {
        const taskNodes = tasks.filter(task => task.startDate && task.endDate);
        if (taskNodes.length === 0) {
            setCriticalPath([]);
            return;
        }

        const nodes: { [key: string]: any } = {};
        taskNodes.forEach(task => {
            nodes[task._id!] = {
                ...task,
                duration: differenceInDays(new Date(task.endDate!), new Date(task.startDate!)) + 1,
                es: 0, // Earliest Start
                ef: 0, // Earliest Finish
                ls: Infinity, // Latest Start
                lf: Infinity, // Latest Finish
                slack: 0,
                successors: [],
            };
        });

        taskNodes.forEach(task => {
            if (task.dependencies) {
                task.dependencies.forEach(depId => {
                    if (nodes[depId]) {
                        nodes[depId].successors.push(task._id!);
                    }
                });
            }
        });

        // Forward pass
        Object.values(nodes).forEach(node => {
            if (!node.dependencies || node.dependencies.length === 0) {
                node.ef = node.duration;
            }
        });

        let changed = true;
        while(changed) {
            changed = false;
            Object.values(nodes).forEach(node => {
                if (node.dependencies && node.dependencies.length > 0) {
                    const maxEF = Math.max(...node.dependencies.map((depId: string) => nodes[depId]?.ef || 0));
                    if (maxEF > node.es) {
                        node.es = maxEF;
                        const newEF = node.es + node.duration;
                        if (newEF !== node.ef) {
                            node.ef = newEF;
                            changed = true;
                        }
                    }
                }
            });
        }
        
        const projectEndDate = Math.max(...Object.values(nodes).map(n => n.ef));

        // Backward pass
        Object.values(nodes).forEach(node => {
            if (node.successors.length === 0) {
                node.lf = projectEndDate;
                node.ls = node.lf - node.duration;
            }
        });

        changed = true;
        const taskIds = Object.keys(nodes);
        for(let i = 0; i < taskIds.length * 2; i++) { // Run enough times to propagate
            taskIds.reverse().forEach(id => {
                 const node = nodes[id];
                 if(node.successors.length > 0) {
                    const minLS = Math.min(...node.successors.map((succId: string) => nodes[succId].ls));
                    node.lf = minLS;
                    node.ls = node.lf - node.duration;
                 }
            });
        }

        const critical: string[] = [];
        Object.values(nodes).forEach(node => {
            node.slack = node.lf - node.ef;
            if (node.slack <= 0) {
                critical.push(node._id!);
            }
        });

        setCriticalPath(critical);
    }
}, [tasks]);


  const handleOpenDialog = (task: ScheduleTask | null = null) => {
    setEditingTask(task);
    setIsTaskDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteScheduleTask(id);
    if (result.success) {
      toast({ title: '¡Tarea Eliminada!', description: 'La tarea ha sido eliminada del cronograma.' });
      fetchTasks();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };
  
  const handleExportCSV = () => {
    if (tasks.length === 0) {
        toast({ variant: 'destructive', title: 'No hay tareas', description: 'No hay tareas para exportar.'});
        return;
    }

    const headers = ["ID", "Nombre", "Fecha de Inicio", "Fecha de Fin", "Duración (días)", "Estado", "Progreso (%)", "Asignado a", "Dependencias", "Observaciones"];
    const csvRows = [headers.join(',')];

    const taskMap = new Map(tasks.map(t => [t._id, t.name]));

    for (const task of tasks) {
        const isGroupHeader = !task.startDate && !task.endDate;
        const duration = task.startDate && task.endDate ? differenceInDays(new Date(task.endDate), new Date(task.startDate)) + 1 : 0;
        
        const values = [
            task._id,
            `"${task.name.replace(/"/g, '""')}"`,
            task.startDate ? format(new Date(task.startDate), 'yyyy-MM-dd') : '',
            task.endDate ? format(new Date(task.endDate), 'yyyy-MM-dd') : '',
            isGroupHeader ? '' : duration,
            isGroupHeader ? 'Fase' : statusMap[task.status].label,
            isGroupHeader ? '' : task.progress || 0,
            `"${task.assignedTo || ''}"`,
            `"${(task.dependencies || []).map(depId => taskMap.get(depId) || depId).join(', ')}"`,
            `"${(task.observations || '').replace(/"/g, '""')}"`
        ];
        csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `cronograma_proyecto_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    toast({ title: '¡Exportado!', description: 'El cronograma se ha exportado a CSV.'});
  };

  const handleExportPDF = () => {
    if (tasks.length === 0) {
      toast({ variant: 'destructive', title: 'No hay tareas', description: 'No hay tareas para exportar.' });
      return;
    }
  
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Cronograma de Actividades del Proyecto', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Fecha de exportación: ${format(new Date(), 'PPP', { locale: es })}`, 14, 29);

    const tableColumn = ["Tarea", "Fecha Inicio", "Fecha Fin", "Duración", "Estado", "Progreso"];
    const tableRows: any[][] = [];

    tasks.forEach(task => {
        const isGroupHeader = !task.startDate && !task.endDate;
        
        if (isGroupHeader) {
            // Add a separator or a differently styled row for group headers
            tableRows.push([{ content: task.name, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [230, 230, 230] } }]);
        } else {
            const duration = task.startDate && task.endDate ? `${differenceInDays(new Date(task.endDate), new Date(task.startDate)) + 1} días` : 'Hito';
            const taskData = [
                task.name,
                task.startDate ? format(new Date(task.startDate), 'dd/MM/yy') : 'N/A',
                task.endDate ? format(new Date(task.endDate), 'dd/MM/yy') : 'N/A',
                duration,
                statusMap[task.status].label,
                `${task.status === 'ejecutada' ? 100 : task.progress || 0}%`,
            ];
            tableRows.push(taskData);
        }
    });

    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] },
    });
    
    const fileName = `cronograma_proyecto_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
    toast({ title: '¡Exportado!', description: 'El cronograma se ha exportado a PDF.'});
  };

  const chartData = React.useMemo(() => {
    return tasks
      .filter(task => task.startDate) // Only include tasks with a start date
      .map((task) => {
          const startDate = startOfDay(new Date(task.startDate!));
          // For milestones, endDate might be null, so we use startDate
          const endDate = startOfDay(new Date(task.endDate || task.startDate!));
          
          return {
            ...task,
            range: [startDate.getTime(), endDate.getTime()],
          };
      });
  }, [tasks]);
  
  const domain: [number, number] = React.useMemo(() => {
      const taskNodes = tasks.filter(task => task.startDate);
      if (taskNodes.length === 0) {
        const today = new Date();
        return [addDays(today, -30).getTime(), addDays(today, 30).getTime()];
      }
      const startDates = taskNodes.map(t => new Date(t.startDate!).getTime());
      const endDates = taskNodes.map(t => new Date(t.endDate || t.startDate!).getTime());
      return [Math.min(...startDates), Math.max(...endDates)];
  }, [tasks]);


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>Diagrama de Gantt</CardTitle>
                <CardDescription>Visualización de la línea de tiempo de las tareas del proyecto.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                {!isReadOnly && (
                    <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Importar CSV
                    </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleExportCSV}>Exportar a CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportPDF}>Exportar a PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {!isReadOnly && (
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" />
                        Añadir Tarea
                    </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[400px] w-full">
            {loading ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            ) : (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        barCategoryGap="35%"
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                        <XAxis 
                          type="number" 
                          domain={domain} 
                          tickFormatter={(time) => format(new Date(time), 'dd/MM/yy')}
                          scale="time"
                          tickCount={8}
                          />
                        <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                        <Tooltip
                            contentStyle={{
                                background: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))'
                            }}
                            labelStyle={{ color: 'hsl(var(--foreground))' }}
                            formatter={(value: any, name: string, props: any) => {
                                if (name === 'range') {
                                    const duration = differenceInDays(new Date(value[1]), new Date(value[0]));
                                    if(duration <= 0) return `Hito: ${format(new Date(value[0]), 'PPP', { locale: es })}`;
                                    return `${format(new Date(value[0]), 'PPP', { locale: es })} - ${format(new Date(value[1]), 'PPP', { locale: es })}`;
                                }
                                if (name === 'progress') {
                                    return `${value}%`;
                                }
                                return value;
                            }}
                        />
                        <ReferenceLine 
                            x={new Date().getTime()} 
                            stroke="hsl(var(--destructive))" 
                            strokeWidth={2}
                            label={{ value: 'Hoy', position: 'top', fill: 'hsl(var(--destructive))' }}
                        />
                        <Bar dataKey="range" name="range" radius={[5, 5, 5, 5]}>
                          {chartData.map((entry, index) => (
                             <Rectangle 
                                key={`bar-${index}`} 
                                {...(entry as any)}
                                fill={statusMap[entry.status].fill}
                                shape={<CustomBar isCritical={criticalPath.includes(entry._id!)} payload={entry} x={0} y={0} width={0} height={0}/>}
                                ref={(el) => barRefs.current.set(entry._id!, el)}
                              />
                          ))}
                        </Bar>
                         <Layer>
                            {chartData.map(task => 
                                task.dependencies?.map(depId => {
                                    const fromTaskRef = barRefs.current.get(depId);
                                    const toTaskRef = barRefs.current.get(task._id!);
                                    return <DependencyLine key={`${depId}-${task._id}`} from={fromTaskRef} to={toTaskRef} />
                                })
                            )}
                        </Layer>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Tareas</CardTitle>
          <CardDescription>Detalle de todas las actividades del cronograma.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre de la Tarea</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Fechas</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center">No hay tareas en el cronograma.</TableCell></TableRow>
                ) : (
                  tasks.map(task => {
                    const isGroupHeader = !task.startDate && !task.endDate;
                    const duration = task.startDate && task.endDate ? differenceInDays(new Date(task.endDate), new Date(task.startDate)) + 1 : 0;
                    const isDueSoon = duration > 0 && task.endDate && differenceInDays(new Date(task.endDate), new Date()) <= 10 && task.status !== 'ejecutada';
                    const isCritical = criticalPath.includes(task._id!);
                    
                    if (isGroupHeader) {
                      return (
                         <TableRow key={task._id} className="bg-muted/60 hover:bg-muted/60">
                            <TableCell colSpan={isReadOnly ? 7 : 8} className="font-bold">
                                {task.name}
                            </TableCell>
                         </TableRow>
                      )
                    }

                    return (
                        <TableRow key={task._id} className={cn(isDueSoon && 'bg-destructive/10')}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                {isCritical && 
                                <TooltipProvider>
                                    <UiTooltip>
                                        <TooltipTrigger asChild>
                                            <Flame className="h-4 w-4 text-red-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Esta tarea es parte de la Ruta Crítica.</p>
                                        </TooltipContent>
                                    </UiTooltip>
                                </TooltipProvider>
                                }
                                <span>{task.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {task.priority ? (
                                <Badge className={cn('text-white', priorityMap[task.priority].color)}>
                                    {priorityMap[task.priority].label}
                                </Badge>
                            ) : (
                                <span className="text-muted-foreground">-</span>
                            )}
                        </TableCell>
                        <TableCell>{task.assignedTo || '-'}</TableCell>
                        <TableCell>
                            {task.startDate ? `${format(new Date(task.startDate), 'PPP', { locale: es })} ${task.endDate ? ' - ' + format(new Date(task.endDate), 'PPP', { locale: es }) : ''}` : 'N/A'}
                        </TableCell>
                        <TableCell>{duration > 0 ? `${duration} día${duration > 1 ? 's' : ''}` : 'Hito'}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-white', statusMap[task.status].color)}>
                            {statusMap[task.status].label}
                          </Badge>
                          {isDueSoon && (
                             <TooltipProvider>
                                <UiTooltip>
                                    <TooltipTrigger asChild>
                                        <AlertTriangle className="h-4 w-4 ml-2 text-destructive inline-block" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Esta tarea vence pronto.</p>
                                    </TooltipContent>
                                </UiTooltip>
                             </TooltipProvider>
                          )}
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <Progress value={task.status === 'ejecutada' ? 100 : task.progress || 0} className="w-24" />
                                <span className="text-xs text-muted-foreground">{task.status === 'ejecutada' ? 100 : task.progress || 0}%</span>
                            </div>
                        </TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(task)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                               <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                               </AlertDialogTrigger>
                               <AlertDialogContent>
                                   <AlertDialogHeader>
                                       <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                       <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará la tarea permanentemente.</AlertDialogDescription>
                                   </AlertDialogHeader>
                                   <AlertDialogFooter>
                                       <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                       <AlertDialogAction onClick={() => handleDelete(task._id!)} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction>
                                   </AlertDialogFooter>
                               </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TaskDialog 
        isOpen={isTaskDialogOpen} 
        setIsOpen={setIsTaskDialogOpen} 
        editingTask={editingTask}
        onTaskSaved={fetchTasks}
        tasks={tasks}
      />
      <BulkUploadDialog
        isOpen={isBulkUploadOpen}
        setIsOpen={setIsBulkUploadOpen}
        onTasksUploaded={fetchTasks}
      />
    </div>
  );
}

// Separate component for the dialog to manage its state cleanly
interface TaskDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    editingTask: ScheduleTask | null;
    onTaskSaved: () => void;
    tasks: ScheduleTask[];
}

function TaskDialog({ isOpen, setIsOpen, editingTask, onTaskSaved, tasks }: TaskDialogProps) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = React.useState(false);
    
    const form = useForm<TaskFormData>({
        resolver: zodResolver(taskSchema),
    });
    
    const status = form.watch('status');
    const isHeader = !form.watch('startDate') && !form.watch('endDate');

    React.useEffect(() => {
        if (isOpen) {
            form.reset(editingTask ? {
                ...editingTask,
                startDate: editingTask.startDate ? new Date(editingTask.startDate) : undefined,
                endDate: editingTask.endDate ? new Date(editingTask.endDate) : undefined,
                progress: editingTask.progress || 0,
                dependencies: editingTask.dependencies || [],
                priority: editingTask.priority || 'media',
                assignedTo: editingTask.assignedTo || '',
                observations: editingTask.observations || '',
            } : {
                name: '',
                startDate: new Date(),
                endDate: addDays(new Date(), 7),
                status: 'por_iniciar',
                justification: '',
                assignedTo: '',
                progress: 0,
                dependencies: [],
                priority: 'media',
                observations: '',
            });
        }
    }, [isOpen, editingTask, form]);

    const onSubmit = async (data: TaskFormData) => {
        setIsSaving(true);
        const result = await saveScheduleTask(data);
        setIsSaving(false);

        if (result.success) {
            toast({ title: '¡Éxito!', description: `Tarea ${editingTask ? 'actualizada' : 'creada'} correctamente.` });
            onTaskSaved();
            setIsOpen(false);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
    };

    const dependencyOptions = tasks.filter(task => task._id !== editingTask?._id && task.startDate);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingTask ? 'Editar Tarea' : 'Nueva Tarea'}</DialogTitle>
                    <DialogDescription>
                        Complete los detalles de la tarea. Para crear un encabezado de fase, deje las fechas en blanco.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-6 pl-1 -mr-6 -ml-1">
                    <Form {...form}>
                        <form id="task-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Nombre de la Tarea o Fase</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="startDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Fecha de Inicio</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>(Opcional)</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button></FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={es} />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="endDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Fecha de Fin</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl><Button variant="outline" className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}>
                                                        {field.value ? format(field.value, 'PPP', { locale: es }) : <span>(Opcional)</span>}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button></FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < (form.getValues('startDate') || new Date(0))} initialFocus locale={es}/>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                           {!isHeader && (
                             <>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Estado</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Seleccione un estado" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                    {Object.entries(statusMap).map(([key, { label }]) => (
                                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                                    ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="priority"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Prioridad</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Seleccione una prioridad" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                    {Object.entries(priorityMap).map(([key, { label }]) => (
                                                        <SelectItem key={key} value={key}>{label}</SelectItem>
                                                    ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="assignedTo"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Asignado a (Responsable)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Nombre del responsable" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="progress"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Porcentaje de Avance (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="0" max="100" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="dependencies"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Dependencias</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}
                                                    >
                                                    <span className="truncate">
                                                        {field.value?.length 
                                                            ? `${field.value.length} tarea(s) seleccionada(s)`
                                                            : "Seleccionar dependencias"}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar tareas..." />
                                                        <CommandList>
                                                        <CommandEmpty>No se encontraron tareas.</CommandEmpty>
                                                        <CommandGroup>
                                                            {dependencyOptions.map((option) => (
                                                            <CommandItem
                                                                key={option._id}
                                                                value={option._id}
                                                                onSelect={(currentValue) => {
                                                                    const selected = field.value || [];
                                                                    const isSelected = selected.includes(option._id!);
                                                                    const newSelection = isSelected 
                                                                        ? selected.filter(id => id !== option._id)
                                                                        : [...selected, option._id!];
                                                                    field.onChange(newSelection);
                                                                }}
                                                            >
                                                                <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    (field.value || []).includes(option._id!) ? "opacity-100" : "opacity-0"
                                                                )}
                                                                />
                                                                {option.name}
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
                                    name="observations"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Observaciones</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Añada notas, comentarios o detalles sobre la tarea..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                {status === 'pausada' && (
                                    <FormField
                                        control={form.control}
                                        name="justification"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Justificación de Pausa</FormLabel>
                                                <FormControl>
                                                    <Textarea placeholder="Describa el motivo de la pausa..." {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                )}
                             </>
                           )}
                        </form>
                    </Form>
                </div>
                <DialogFooter className="pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="submit" form="task-form" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


interface BulkUploadDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onTasksUploaded: () => void;
}

const CSV_HEADERS_ES = ["name", "startDate", "endDate", "status", "priority", "assignedTo", "progress", "dependencies", "observations"];

function BulkUploadDialog({ isOpen, setIsOpen, onTasksUploaded }: BulkUploadDialogProps) {
    const { toast } = useToast();
    const [isUploading, setIsUploading] = React.useState(false);
    const [parsedData, setParsedData] = React.useState<ScheduleTask[]>([]);
    const [fileName, setFileName] = React.useState('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setFileName(file.name);
            Papa.parse<any>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const validData = results.data.map((row: any) => {
                        const startDate = row.startDate ? parse(row.startDate, 'yyyy-MM-dd', new Date()) : undefined;
                        const endDate = row.endDate ? parse(row.endDate, 'yyyy-MM-dd', new Date()) : undefined;
                        
                        return {
                            name: row.name || '',
                            startDate: startDate && !isNaN(startDate.getTime()) ? startDate : undefined,
                            endDate: endDate && !isNaN(endDate.getTime()) ? endDate : undefined,
                            status: Object.keys(statusMap).includes(row.status) ? row.status : 'por_iniciar',
                            priority: Object.keys(priorityMap).includes(row.priority) ? row.priority : 'media',
                            assignedTo: row.assignedTo || '',
                            progress: parseInt(row.progress, 10) || 0,
                            dependencies: row.dependencies ? row.dependencies.split(',').map((d: string) => d.trim()) : [],
                            observations: row.observations || '',
                        };
                    }).filter(item => item.name);
                    setParsedData(validData);
                },
                error: (error) => {
                    toast({ variant: 'destructive', title: 'Error al leer el archivo', description: error.message });
                    setParsedData([]);
                }
            });
        }
    };
    
    const handleUpload = async () => {
        if (parsedData.length === 0) {
            toast({ variant: 'destructive', title: 'No hay datos', description: 'No se encontraron datos válidos en el archivo para importar.' });
            return;
        }

        setIsUploading(true);
        const result = await bulkSaveScheduleTasks(parsedData);
        setIsUploading(false);

        if (result.success) {
            toast({
                title: '¡Importación Exitosa!',
                description: `${result.insertedCount} tareas han sido agregadas al cronograma.`,
            });
            onTasksUploaded();
            setIsOpen(false);
            resetState();
        } else {
            toast({ variant: 'destructive', title: 'Error en la Importación', description: result.error });
        }
    };

    const resetState = () => {
        setParsedData([]);
        setFileName('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) resetState(); setIsOpen(open); }}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Importación Masiva de Tareas</DialogTitle>
                    <DialogDescription>
                        Suba un archivo CSV. Las columnas deben ser: {CSV_HEADERS_ES.join(', ')}. Las fechas deben estar en formato AAAA-MM-DD.
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[70vh] overflow-y-auto pr-6 pl-1 -mr-6 -ml-1">
                    <div className="py-4 space-y-4">
                        <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} />
                        {fileName && <p className="text-sm text-muted-foreground">Archivo seleccionado: {fileName}</p>}
                        
                        {parsedData.length > 0 && (
                            <div className="max-h-96 overflow-y-auto border rounded-md">
                                <h3 className="text-lg font-medium p-4">Vista Previa de Datos a Importar ({parsedData.length} filas)</h3>
                                <Table>
                                    <TableHeader><TableRow>{CSV_HEADERS_ES.map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
                                    <TableBody>
                                        {parsedData.slice(0, 10).map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell>{item.startDate ? format(item.startDate, 'yyyy-MM-dd') : ''}</TableCell>
                                                <TableCell>{item.endDate ? format(item.endDate, 'yyyy-MM-dd') : ''}</TableCell>
                                                <TableCell>{item.status}</TableCell>
                                                <TableCell>{item.priority}</TableCell>
                                                <TableCell>{item.assignedTo}</TableCell>
                                                <TableCell>{item.progress}</TableCell>
                                                <TableCell>{item.dependencies?.join(', ')}</TableCell>
                                                <TableCell>{item.observations}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                    <Button type="button" onClick={handleUpload} disabled={isUploading || parsedData.length === 0}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Confirmar e Importar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
