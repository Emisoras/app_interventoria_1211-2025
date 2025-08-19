
// src/components/service-monitoring.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown, Edit, Loader2, Plus, Save, Search, Trash2, X, Download, User } from 'lucide-react';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Image from 'next/image';
import SignatureCanvas from 'react-signature-canvas';


import {
    deleteServiceMonitoringReport,
    getCampuses,
    getServiceMonitoringReports,
    getUserById,
    saveServiceMonitoringReport,
    type Campus,
    type ServiceMonitoringReport,
} from '@/app/actions';
import { ServiceMonitoringReportSchema } from '@/lib/schemas';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Separator } from './ui/separator';

type ReportFormData = z.infer<typeof ServiceMonitoringReportSchema>;

const statusMap = {
    no_iniciada: { label: 'No Iniciada', color: 'bg-gray-400' },
    en_progreso: { label: 'En Progreso', color: 'bg-yellow-500' },
    finalizada: { label: 'Finalizada', color: 'bg-blue-500' },
    operativo: { label: 'Operativo', color: 'bg-green-500' },
    con_problemas: { label: 'Con Problemas', color: 'bg-red-500' },
    inoperativo: { label: 'Inoperativo', color: 'bg-destructive' },
};

const satisfactionMap = {
    si: 'Sí',
    no: 'No',
    excelente: 'Excelente',
    buena: 'Buena',
    mala: 'Mala'
}

export function ServiceMonitoring({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [reports, setReports] = React.useState<ServiceMonitoringReport[]>([]);
  const [campuses, setCampuses] = React.useState<Campus[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [editingReport, setEditingReport] = React.useState<ServiceMonitoringReport | null>(null);
  const [openCampusesPopover, setOpenCampusesPopover] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const [contactInfo, setContactInfo] = React.useState({ name: '', phone: '' });
  const [isExporting, setIsExporting] = React.useState(false);
  const [signature, setSignature] = React.useState<string | null>(null);


  const form = useForm<ReportFormData>({
    resolver: zodResolver(ServiceMonitoringReportSchema),
    defaultValues: {
        reportDate: new Date(),
        campusId: '',
        campusName: '',
        reporterId: '',
        reporterName: '',
        installationStatus: 'no_iniciada',
        serviceStatus: 'no_iniciada',
        observations: '',
        hasComputers: undefined,
        goodComputers: 0,
        badComputers: 0,
        hasComputersObservation: '',
        wifiPasswordGiven: undefined,
        wifiPasswordGivenObservation: '',
        installerAttention: undefined,
        installerAttentionObservation: '',
        serviceExperience: undefined,
        serviceExperienceObservation: '',
    },
  });

  const fetchReportsAndCampuses = React.useCallback(async () => {
    setLoading(true);
    const [reportsData, campusesData] = await Promise.all([
        getServiceMonitoringReports(),
        getCampuses(),
    ]);
    setReports(reportsData);
    setCampuses(campusesData);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchReportsAndCampuses();
  }, [fetchReportsAndCampuses]);
  
  React.useEffect(() => {
      const userId = localStorage.getItem('userId');
      if (userId && !form.getValues('reporterId')) {
          getUserById(userId).then(user => {
              if (user) {
                  form.setValue('reporterId', user._id);
                  form.setValue('reporterName', user.username);
              }
          });
      }
  }, [form]);
  
  const selectedCampusId = form.watch('campusId');
  React.useEffect(() => {
    if (selectedCampusId) {
        const campus = campuses.find(c => c._id === selectedCampusId);
        if (campus) {
            setContactInfo({ name: campus.contactName || 'N/A', phone: campus.contactPhone || 'N/A' });
            form.setValue('campusName', campus.name);
        }
    } else {
        setContactInfo({ name: '', phone: '' });
    }
  }, [selectedCampusId, campuses, form]);

  const hasComputersValue = form.watch('hasComputers');


  const handleEdit = (report: ServiceMonitoringReport) => {
    setEditingReport(report);
    form.reset({
        ...report,
        reportDate: new Date(report.reportDate),
        goodComputers: report.goodComputers || 0,
        badComputers: report.badComputers || 0,
        hasComputersObservation: report.hasComputersObservation || '',
        wifiPasswordGivenObservation: report.wifiPasswordGivenObservation || '',
        installerAttentionObservation: report.installerAttentionObservation || '',
        serviceExperienceObservation: report.serviceExperienceObservation || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const handleDelete = async (id: string) => {
    const result = await deleteServiceMonitoringReport(id);
    if(result.success) {
      toast({ title: 'Reporte eliminado' });
      fetchReportsAndCampuses();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  }

  const cancelEdit = () => {
    const currentReporterId = form.getValues('reporterId');
    const currentReporterName = form.getValues('reporterName');
    setEditingReport(null);
    form.reset({
        reportDate: new Date(),
        campusId: '',
        campusName: '',
        installationStatus: 'no_iniciada',
        serviceStatus: 'no_iniciada',
        observations: '',
        reporterId: currentReporterId,
        reporterName: currentReporterName,
        hasComputers: undefined,
        goodComputers: 0,
        badComputers: 0,
        hasComputersObservation: '',
        wifiPasswordGiven: undefined,
        wifiPasswordGivenObservation: '',
        installerAttention: undefined,
        installerAttentionObservation: '',
        serviceExperience: undefined,
        serviceExperienceObservation: '',
    });
  };

  const onSubmit = async (data: ReportFormData) => {
    setIsSaving(true);
    const result = await saveServiceMonitoringReport(data);
    setIsSaving(false);
    if (result.success) {
      toast({ title: `Reporte ${editingReport ? 'actualizado' : 'guardado'} correctamente.` });
      cancelEdit();
      fetchReportsAndCampuses();
    } else {
      toast({ variant: 'destructive', title: 'Error al guardar', description: result.error });
    }
  };
  
  const campusMap = React.useMemo(() => new Map(campuses.map(c => [c._id, c])), [campuses]);
  
  const filteredReports = React.useMemo(() => {
    const lowercasedFilter = searchTerm.toLowerCase();
    if (!lowercasedFilter) return reports;
    return reports.filter(report => {
        const campusName = campusMap.get(report.campusId)?.name || report.campusName;
        return campusName.toLowerCase().includes(lowercasedFilter);
    });
  }, [reports, searchTerm, campusMap]);
  
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

  const handleGenerateDeliveryNotePDF = async () => {
    if (!searchTerm.trim()) {
        toast({ variant: 'destructive', title: 'Destino no especificado', description: 'Por favor, busque un destino específico para generar el acta.' });
        return;
    }

    const itemsForNote = reports.filter(item => {
        const campusName = campusMap.get(item.campusId)?.name || item.campusName;
        return campusName.toLowerCase() === searchTerm.toLowerCase();
    }).sort((a,b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

    if (itemsForNote.length === 0) {
        toast({ variant: 'destructive', title: 'No hay reportes', description: `No se encontraron reportes para la sede "${searchTerm}".` });
        return;
    }
    
    setIsExporting(true);

    try {
        const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
        const [headerImageBase64] = await Promise.all([imageToDataUri(headerImageUrl)]);
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 14;
        let yPos = 50;
        
        doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ACTA DE SEGUIMIENTO DE SERVICIO', pageWidth / 2, 40, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        doc.text(`Fecha de Generación: ${format(new Date(), 'PPP', { locale: es })}`, margin, yPos);
        yPos += 7;
        doc.text(`Sede/Junta: ${searchTerm}`, margin, yPos);
        yPos += 10;
        
        itemsForNote.forEach((item) => {
            const tableBody: (string | { content: string, colSpan: number, styles: any })[][] = [];

            const addRow = (label: string, value: string | undefined) => {
                if (value) {
                    tableBody.push([
                        { content: label, styles: { fontStyle: 'bold' } },
                        { content: value, styles: {} }
                    ]);
                }
            };
            
            const addObservationRow = (label: string, value: string | undefined) => {
                if(value) {
                    tableBody.push([
                        { content: label, styles: { fontStyle: 'bold', cellPadding: {top: 1, left: 10} } },
                        { content: value, styles: {} }
                    ])
                }
            }
            
            addRow('Estado Instalación', statusMap[item.installationStatus].label);
            addRow('Estado Servicio', statusMap[item.serviceStatus].label);

            let hasComputersText = "No";
            if (item.hasComputers === 'si') {
                hasComputersText = `Sí (Buenos: ${item.goodComputers || 0}, Malos: ${item.badComputers || 0})`;
            }
            addRow('¿Cuenta con Computadores?', hasComputersText);
            addObservationRow('Obs. Computadores', item.hasComputersObservation);

            addRow('¿Entregaron Contraseña WIFI?', satisfactionMap[item.wifiPasswordGiven as keyof typeof satisfactionMap] || 'No especificado');
            addObservationRow('Obs. Contraseña', item.wifiPasswordGivenObservation);

            addRow('Atención de Instaladores', satisfactionMap[item.installerAttention as keyof typeof satisfactionMap] || 'No especificado');
            addObservationRow('Obs. Atención', item.installerAttentionObservation);
            
            addRow('Experiencia con el Servicio', satisfactionMap[item.serviceExperience as keyof typeof satisfactionMap] || 'No especificado');
            addObservationRow('Obs. Experiencia', item.serviceExperienceObservation);

            addRow('Observaciones Generales', item.observations);

            if (yPos > pageHeight - 100) { // Check space before drawing table
                doc.addPage();
                doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
                yPos = 40;
            }

            (doc as any).autoTable({
                head: [[{ content: `Reporte del ${format(new Date(item.reportDate), 'PPP', { locale: es })}`, colSpan: 2, styles: { halign: 'center', fillColor: [33, 150, 243] } }]],
                body: tableBody,
                startY: yPos,
                theme: 'grid',
                columnStyles: { 0: { cellWidth: 70 } },
            });
            
            yPos = (doc as any).lastAutoTable.finalY + 10;
        });


        if (yPos > pageHeight - 60) {
            doc.addPage();
            doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
            yPos = 40;
        }

        const signatureBlockWidth = (pageWidth - margin * 3) / 2;
        
        const addSignatureBlock = (title: string, x: number, y: number, signatureImage?: string | null) => {
            if (signatureImage && title === 'Firma Interventoría (Recibe)') {
                doc.addImage(signatureImage, 'PNG', x, y - 20, 50, 20);
            }
            doc.setLineWidth(0.2);
            doc.line(x, y, x + signatureBlockWidth, y);
            doc.text(title, x, y + 5);
        }
        
        addSignatureBlock('Firma Interventoría', margin, yPos, signature);
        addSignatureBlock('Firma Responsable Sede (Recibe a Satisfacción)', margin + signatureBlockWidth + margin, yPos);
        

        const fileName = `ACTA_SEGUIMIENTO_${searchTerm.replace(/ /g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        toast({ title: '¡Acta Generada!', description: `El PDF del acta de seguimiento para ${searchTerm} ha sido descargado.` });

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ variant: 'destructive', title: 'Error al Exportar', description: 'No se pudo generar el acta en PDF.' });
    } finally {
        setIsExporting(false);
    }
  };


  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>{editingReport ? 'Editar Reporte' : 'Nuevo Reporte de Seguimiento'}</CardTitle>
            <CardDescription>Registre el estado de la instalación y del servicio para una sede.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="campusId"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Sede / Junta de Internet</FormLabel>
                      <Popover open={openCampusesPopover} onOpenChange={setOpenCampusesPopover}>
                        <PopoverTrigger asChild disabled={isReadOnly}>
                          <FormControl>
                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                              {field.value ? campuses.find(c => c._id === field.value)?.name : "Seleccione una sede"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput placeholder="Buscar sede..." />
                            <CommandList>
                              <CommandEmpty>No se encontró la sede.</CommandEmpty>
                              <CommandGroup>
                                {campuses.map(campus => (
                                  <CommandItem value={campus._id} key={campus._id} onSelect={() => { form.setValue("campusId", campus._id); setOpenCampusesPopover(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", campus._id === field.value ? "opacity-100" : "opacity-0")} />
                                    {campus.name}
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
                 {selectedCampusId && (
                    <Card className="bg-muted/50 p-4">
                        <p className="text-sm font-medium">Contacto: <span className="font-normal">{contactInfo.name}</span></p>
                        <p className="text-sm font-medium">Teléfono: <span className="font-normal">{contactInfo.phone}</span></p>
                    </Card>
                 )}
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="installationStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Instalación</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                {Object.entries(statusMap)
                                    .filter(([key]) => ['no_iniciada', 'en_progreso', 'finalizada', 'con_problemas'].includes(key))
                                    .map(([key, { label }]) => (
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
                      name="serviceStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Servicio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                           <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                {Object.entries(statusMap)
                                    .filter(([key]) => ['operativo', 'con_problemas', 'inoperativo', 'no_iniciada'].includes(key))
                                    .map(([key, { label }]) => (
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
                  name="reportDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha del Reporte</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")} disabled={isReadOnly}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP', { locale: es }) : <span>Seleccione una fecha</span>}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={date => date > new Date()} initialFocus locale={es} /></PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="reporterName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reportado por</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Separator/>
                <div className="space-y-4 pt-4">
                    <h3 className="text-md font-medium">Checklist de Satisfacción</h3>

                    <Card className="p-4 bg-background">
                        <FormField
                            control={form.control}
                            name="hasComputers"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>¿La Institución Educativa Cuenta con Computadores?</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    value={String(field.value)}
                                    className="flex space-x-4"
                                    disabled={isReadOnly}
                                    >
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl><RadioGroupItem value="si" /></FormControl>
                                        <FormLabel className="font-normal">Sí</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl><RadioGroupItem value="no" /></FormControl>
                                        <FormLabel className="font-normal">No</FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        {hasComputersValue === 'si' && (
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <FormField control={form.control} name="goodComputers" render={({ field }) => (
                                    <FormItem><FormLabel>Buenos</FormLabel><FormControl><Input type="number" {...field} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                                )}/>
                                <FormField control={form.control} name="badComputers" render={({ field }) => (
                                    <FormItem><FormLabel>Malos</FormLabel><FormControl><Input type="number" {...field} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                                )}/>
                            </div>
                        )}
                         <FormField control={form.control} name="hasComputersObservation" render={({ field }) => (
                            <FormItem className="pt-2"><FormLabel className="text-xs text-muted-foreground">Observación</FormLabel><FormControl><Textarea {...field} rows={2} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                        )}/>
                    </Card>

                     <Card className="p-4 bg-background">
                        <FormField
                            control={form.control}
                            name="wifiPasswordGiven"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>¿Le entregaron la Contraseña del WIFI?</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={String(field.value)} className="flex space-x-4" disabled={isReadOnly}>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="si" /></FormControl><FormLabel className="font-normal">Sí</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField control={form.control} name="wifiPasswordGivenObservation" render={({ field }) => (
                            <FormItem className="pt-2"><FormLabel className="text-xs text-muted-foreground">Observación</FormLabel><FormControl><Textarea {...field} rows={2} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                        )}/>
                    </Card>
                    
                    <Card className="p-4 bg-background">
                        <FormField
                            control={form.control}
                            name="installerAttention"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>¿Cómo Fue la Atención de los Instaladores?</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} value={String(field.value)} className="flex space-x-4" disabled={isReadOnly}>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="excelente" /></FormControl><FormLabel className="font-normal">Excelente</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="buena" /></FormControl><FormLabel className="font-normal">Buena</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="mala" /></FormControl><FormLabel className="font-normal">Mala</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField control={form.control} name="installerAttentionObservation" render={({ field }) => (
                            <FormItem className="pt-2"><FormLabel className="text-xs text-muted-foreground">Observación</FormLabel><FormControl><Textarea {...field} rows={2} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                        )}/>
                    </Card>

                    <Card className="p-4 bg-background">
                        <FormField
                            control={form.control}
                            name="serviceExperience"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>¿Cómo Ha sido la Experiencia con el Servicio Instalado?</FormLabel>
                                <FormControl>
                                     <RadioGroup onValueChange={field.onChange} value={String(field.value)} className="flex space-x-4" disabled={isReadOnly}>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="excelente" /></FormControl><FormLabel className="font-normal">Excelente</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="buena" /></FormControl><FormLabel className="font-normal">Buena</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="mala" /></FormControl><FormLabel className="font-normal">Mala</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField control={form.control} name="serviceExperienceObservation" render={({ field }) => (
                            <FormItem className="pt-2"><FormLabel className="text-xs text-muted-foreground">Observación</FormLabel><FormControl><Textarea {...field} rows={2} disabled={isReadOnly}/></FormControl><FormMessage /></FormItem>
                        )}/>
                    </Card>
                </div>
                 <FormField
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones Generales</FormLabel>
                      <FormControl><Textarea placeholder="Describa el estado, problemas encontrados, soluciones aplicadas, etc." {...field} rows={5} disabled={isReadOnly}/></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!isReadOnly && (
                  <div className="flex items-center gap-2 pt-4">
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingReport ? 'Actualizar Reporte' : 'Guardar Reporte'}
                    </Button>
                    {editingReport && <Button type="button" variant="outline" onClick={cancelEdit}><X className="mr-2 h-4 w-4" />Cancelar</Button>}
                  </div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle>Historial de Seguimiento</CardTitle>
                    <CardDescription>Lista de todos los reportes de seguimiento guardados.</CardDescription>
                </div>
                 <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por sede..."
                            className="pl-9 w-full sm:w-64"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {!isReadOnly && (
                        <Button onClick={handleGenerateDeliveryNotePDF} disabled={isExporting || !searchTerm.trim()}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                            Generar Acta
                        </Button>
                    )}
                 </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sede</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado Instalación</TableHead>
                    <TableHead>Estado Servicio</TableHead>
                    <TableHead>Reportado por</TableHead>
                    {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-8 w-8 animate-spin" /></TableCell></TableRow>
                  ) : filteredReports.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">
                        {searchTerm ? `No se encontraron reportes para "${searchTerm}"` : 'No hay reportes de seguimiento.'}
                    </TableCell></TableRow>
                  ) : (
                    filteredReports.map(report => (
                      <TableRow key={report._id}>
                        <TableCell className="font-medium">{campusMap.get(report.campusId)?.name || report.campusName}</TableCell>
                        <TableCell>{format(new Date(report.reportDate), 'PPP', { locale: es })}</TableCell>
                        <TableCell><Badge className={cn('text-white', statusMap[report.installationStatus].color)}>{statusMap[report.installationStatus].label}</Badge></TableCell>
                        <TableCell><Badge className={cn('text-white', statusMap[report.serviceStatus].color)}>{statusMap[report.serviceStatus].label}</Badge></TableCell>
                        <TableCell>{report.reporterName}</TableCell>
                        {!isReadOnly && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(report)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>¿Está seguro?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer y eliminará el reporte permanentemente.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(report._id!)} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction></AlertDialogFooter>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
