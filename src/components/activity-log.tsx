// src/components/activity-log.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { CalendarIcon, Download, Eraser, Loader2, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import SignatureCanvas from 'react-signature-canvas';
import { z } from 'zod';

import {
  getUserById,
  getDailyActivities,
  saveDailyActivity,
  deleteDailyActivity,
  generateActivityReportIntro,
  type DailyActivity,
} from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';

const activitySchema = z.object({
  _id: z.string().optional(),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres.'),
});

type ActivityFormData = z.infer<typeof activitySchema>;

export function ActivityLog({ isViewer }: { isViewer: boolean }) {
  const { toast } = useToast();
  const router = useRouter();

  const [activities, setActivities] = React.useState<DailyActivity[]>([]);
  const [selectedActivities, setSelectedActivities] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [userId, setUserId] = React.useState<string | null>(null);
  const [userName, setUserName] = React.useState<string>('');

  const sigCanvas = React.useRef<SignatureCanvas>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [signature, setSignature] = React.useState<string | null>(null);

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      date: undefined,
      description: '',
    },
  });

  const fetchActivities = React.useCallback(async (id: string) => {
    setIsLoading(true);
    const data = await getDailyActivities(id);
    setActivities(data);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        setUserId(storedUserId);
        const fetchUserAndActivities = async () => {
            const userData = await getUserById(storedUserId);
            if (userData) {
                setUserName(userData.username);
            }
            await fetchActivities(storedUserId);
        };
        fetchUserAndActivities();
    } else {
        router.push('/login');
    }
  }, [router, fetchActivities]);
    
  React.useEffect(() => {
    if (!form.getValues('date')) {
        form.setValue('date', new Date());
    }
  }, [form]);


  const onSubmit = async (data: ActivityFormData) => {
    if (!userId || !userName) return;

    setIsSaving(true);
    const activityToSave = {
      ...data,
      inspectorId: userId,
      inspectorName: userName,
    };

    const result = await saveDailyActivity(activityToSave);
    setIsSaving(false);

    if (result.success) {
      toast({
        title: '¡Actividad Guardada!',
        description: 'Tu actividad ha sido registrada correctamente.',
      });
      form.reset({ date: new Date(), description: '' });
      if (userId) fetchActivities(userId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Guardar',
        description: result.error || 'No se pudo guardar la actividad.',
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const result = await deleteDailyActivity(id);
    if (result.success) {
      toast({
        title: '¡Actividad Eliminada!',
      });
      setSelectedActivities(prev => prev.filter(selectedId => selectedId !== id));
      if (userId) fetchActivities(userId);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error al Eliminar',
        description: result.error,
      });
    }
    setDeletingId(null);
  };
  
  const handleSelectActivity = (id: string) => {
    setSelectedActivities(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedActivities.length === activities.length) {
      setSelectedActivities([]);
    } else {
      setSelectedActivities(activities.map(a => a._id!));
    }
  };


  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSignature(null);
  }

  const handleSignatureEnd = () => {
    if (sigCanvas.current) {
        setSignature(sigCanvas.current.toDataURL());
    }
  }

  const handleSignatureUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUri = loadEvent.target?.result as string;
        setSignature(dataUri);
      };
      reader.readAsDataURL(file);
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

  const handleExportPDF = async () => {
    if (selectedActivities.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Ninguna Actividad Seleccionada',
        description: 'Por favor, seleccione al menos una actividad para generar el informe.',
      });
      return;
    }

    setIsExporting(true);
    try {
        const activitiesToReport = activities.filter(a => selectedActivities.includes(a._id!));
        const activitiesPayload = activitiesToReport.map(a => ({ date: format(new Date(a.date), 'yyyy-MM-dd'), description: a.description }));
        
        toast({ title: 'Generando Introducción...', description: 'La IA está preparando un resumen de las actividades seleccionadas.'});
        const introText = await generateActivityReportIntro({ inspectorName: userName, activities: activitiesPayload });
        
        const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
        const footerImageUrl = 'https://i.imgur.com/d0mrUFZ.jpeg';

        const [headerImageBase64, footerImageBase64] = await Promise.all([
            imageToDataUri(headerImageUrl),
            imageToDataUri(footerImageUrl)
        ]);
        
        const doc = new jsPDF();
        
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;
        const contentWidth = pageWidth - margin * 2;
        
        const footerImage = new window.Image();
        footerImage.src = footerImageBase64;
        await new Promise(resolve => {
            footerImage.onload = resolve;
        });

        const addHeaderAndFooter = () => {
            const pageCount = doc.internal.getNumberOfPages();
            const now = new Date();
            const formattedDateTime = format(now, "PPP p", { locale: es });
            
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
                const footerHeight = 20;
                const imageRatio = footerImage.width / footerImage.height;
                const scaledWidth = footerHeight * imageRatio;
                const xOffset = (pageWidth - scaledWidth) / 2;
                doc.addImage(footerImageBase64, 'JPEG', xOffset, pageHeight - footerHeight, scaledWidth, footerHeight);

                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                const pageNumText = `Página ${i} de ${pageCount}`;
                const dateTimeText = formattedDateTime;
                const pageNumTextWidth = doc.getStringUnitWidth(pageNumText) * doc.getFontSize() / doc.internal.scaleFactor;
                const dateTimeTextWidth = doc.getStringUnitWidth(dateTimeText) * doc.getFontSize() / doc.internal.scaleFactor;
                
                doc.text(pageNumText, pageWidth - pageNumTextWidth - margin, pageHeight - 15);
                doc.text(dateTimeText, pageWidth - dateTimeTextWidth - margin, pageHeight - 10);
            }
        };
        
        let yPos = 35; 
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(`San José de Cúcuta, ${format(new Date(), 'PPP', { locale: es })}`, margin, yPos);
        yPos += 14;

        doc.setFont('helvetica', 'bold');
        doc.text('Mario Enrique Gallardo Orjuela', margin, yPos);
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text('Director Técnico', margin, yPos);
        yPos += 5;
        doc.text('Convenio interadministrativo 1211-2025', margin, yPos);
        yPos += 14;
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Informe de Actividades Interventoría', pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const projectTitle = 'Implementación de Infraestructura Tecnológica para el Fortalecimiento de la Conectividad, Servicios TIC y Apropiación Digital en los Hogares, Comunidades de Conectividad e Instituciones Educativas de la Región del Catatumbo y Área Metropolitana de Cúcuta del Departamento de Norte de Santander.';
        const splitProjectTitle = doc.splitTextToSize(projectTitle, contentWidth);
        doc.text(splitProjectTitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += (splitProjectTitle.length * 5) + 5;

        doc.setFont('helvetica', 'normal');
        doc.text('Convenio Interadministrativo: 1211-2025', margin, yPos);
        yPos += 5;

        const dates = activitiesToReport.map(a => new Date(a.date));
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        const dateRangeString = activitiesToReport.length > 0
            ? `del ${format(minDate, 'PPP', { locale: es })} al ${format(maxDate, 'PPP', { locale: es })}`
            : 'N/A';
        doc.text(`Periodo de seguimiento: ${dateRangeString}`, margin, yPos);
        yPos += 5;

        doc.text(`Interventor: ${userName}`, margin, yPos);
        yPos += 10;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Introducción', margin, yPos);
        yPos += 6;
        doc.setFont('helvetica', 'normal');
        const splitIntro = doc.splitTextToSize(introText, contentWidth);
        doc.text(splitIntro, margin, yPos);
        yPos += (splitIntro.length * 5) + 10;
        
        const tableColumn = ["Fecha", "Descripción de la Actividad"];
        const tableRows: string[][] = activitiesToReport.map(act => [
            format(new Date(act.date), 'yyyy-MM-dd'),
            act.description
        ]);

        (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: yPos,
          styles: { fontSize: 10 },
          headStyles: { fillColor: [33, 150, 243] },
          margin: { top: 35, bottom: 25 },
          didDrawPage: addHeaderAndFooter
        });

        yPos = (doc as any).lastAutoTable.finalY + 20;

        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 35;
        }

        if (signature) {
            doc.addImage(signature, 'PNG', margin, yPos, 60, 30);
        }
        
        yPos += 35;
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, margin + 70, yPos);
        yPos += 5;
        doc.setFontSize(10);
        doc.text(`Firma de ${userName}`, margin, yPos);
        yPos += 5;
        doc.text('Interventor', margin, yPos);

        doc.setPage(1);
        doc.setFillColor(255,255,255);
        doc.rect(0,0,pageWidth,30,'F');
        doc.rect(0,pageHeight - 20,pageWidth,20,'F');

        addHeaderAndFooter();

        const fileName = `Informe_Actividades_${userName.replace(/ /g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        toast({ title: '¡Informe Generado!', description: 'El PDF se ha descargado correctamente.' });

    } catch(error) {
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
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Actividad</CardTitle>
            <CardDescription>Añade una nueva entrada a tu bitácora diaria.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de la Actividad</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                              disabled={isViewer}
                            >
                              {field.value ? (
                                format(new Date(field.value), 'PPP', { locale: es })
                              ) : (
                                <span>Seleccione una fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date() || isViewer}
                            initialFocus
                            locale={es}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe la actividad realizada..."
                          rows={6}
                          {...field}
                          disabled={isViewer}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isViewer && (
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Actividad
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Historial de Actividades</CardTitle>
            <CardDescription>Seleccione las actividades que desea incluir en el informe.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-12">
                       <Checkbox
                        checked={selectedActivities.length === activities.length && activities.length > 0}
                        onCheckedChange={handleSelectAll}
                        aria-label="Seleccionar todo"
                        disabled={isViewer || activities.length === 0}
                       />
                     </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    {!isViewer && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        Cargando actividades...
                      </TableCell>
                    </TableRow>
                  ) : activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24">
                        No hay actividades registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    activities.map((activity) => (
                      <TableRow key={activity._id}>
                        <TableCell>
                          <Checkbox
                           checked={selectedActivities.includes(activity._id!)}
                           onCheckedChange={() => handleSelectActivity(activity._id!)}
                           aria-label={`Seleccionar actividad ${activity._id}`}
                           disabled={isViewer}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(new Date(activity.date), 'PPP', { locale: es })}
                        </TableCell>
                        <TableCell className="whitespace-pre-wrap">{activity.description}</TableCell>
                        {!isViewer && (
                          <TableCell className="text-right">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-destructive hover:text-destructive"
                                      disabled={deletingId === activity._id}
                                    >
                                      {deletingId === activity._id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará la actividad permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(activity._id!)} className="bg-destructive hover:bg-destructive/90">
                                      Sí, eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="mt-6 space-y-4">
                <Label>Firma del Interventor para Reporte</Label>
                <div className="relative w-full h-40 border rounded-md bg-white flex items-center justify-center">
                {signature ? (
                    <Image src={signature} alt="Firma" layout="fill" objectFit="contain" />
                ) : (
                    <SignatureCanvas
                    ref={sigCanvas}
                    penColor="black"
                    canvasProps={{ className: 'w-full h-full' }}
                    onEnd={handleSignatureEnd}
                    disabled={isViewer}
                    />
                )}
                </div>
                {!isViewer && (
                <div className="flex justify-end gap-2">
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleSignatureUpload}
                        className="hidden"
                    />
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        Subir Firma
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearSignature}>
                        <Eraser className="mr-2 h-4 w-4" />
                        Limpiar Firma
                    </Button>
                </div>
                )}
          </div>
          </CardContent>
          <CardFooter className="flex justify-end pt-6 border-t">
            <Button onClick={handleExportPDF} disabled={isExporting || selectedActivities.length === 0}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generar Informe con IA
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
