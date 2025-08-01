// src/components/checklist-form.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { AlertCircle, CalendarIcon, Camera, Check, ChevronsUpDown, Download, Edit, Eraser, Loader2, Plus, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { useForm } from 'react-hook-form';
import SignatureCanvas from 'react-signature-canvas';
import { z } from 'zod';

import type { ComplianceCheckOutput } from '@/ai/flows/compliance-check';
import { getChecklistById, getUserById, runComplianceCheck, saveChecklist, getChecklistTemplate, ChecklistQuestion } from '@/app/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { campusData } from '@/lib/campus-data';
import { contractorsData } from '@/lib/contractors-data';
import { institutionsData } from '@/lib/institutions-data';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const formSchema = z.object({
  _id: z.string().optional(),
  contractorName: z.string().min(1, 'El nombre es requerido.'),
  institutionName: z.string(),
  campusName: z.string().min(1, 'El nombre de la sede es requerido.'),
  siteType: z.string({ required_error: 'El tipo de sitio es requerido.' }),
  municipality: z.string().min(1, 'El municipio es requerido.'),
  date: z.date({ required_error: 'La fecha es requerida.' }),
  inspectorName: z.string().min(1, 'El nombre del interventor es requerido.'),
}).refine(data => {
    if (data.siteType === 'Junta de Internet') {
        return true;
    }
    return data.institutionName.length > 0;
}, {
    message: 'El nombre de la institución es requerido.',
    path: ['institutionName'],
});


type ContractorFormData = z.infer<typeof formSchema>;

type ComplianceStatus = 'cumple' | 'no_cumple' | 'parcial' | 'na';

interface ChecklistItem extends ChecklistQuestion {
  observation: string;
  photoDataUri: string | null;
  status: ComplianceStatus;
}


interface ChecklistFormProps {
    isViewer: boolean;
    checklistType: 'viabilidad-educativa' | 'viabilidad-junta';
    formTitle: string;
}

export function ChecklistForm({ isViewer, checklistType, formTitle }: ChecklistFormProps) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [checklistItems, setChecklistItems] = React.useState<ChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = React.useState(true);

  const initialFormState = {
    contractorName: '',
    institutionName: '',
    campusName: '',
    municipality: '',
    date: new Date(),
    siteType: checklistType === 'viabilidad-educativa' ? 'Institución Educativa' : 'Junta de Internet',
    inspectorName: '',
    _id: undefined,
  };
  
  const [aiFeedback, setAiFeedback] = React.useState<ComplianceCheckOutput['itemsNeedingMoreEvidence']>([]);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const sigCanvas = React.useRef<SignatureCanvas>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [signature, setSignature] = React.useState<string | null>(null);

  const [contractors, setContractors] = React.useState(contractorsData);
  const [openContractorsPopover, setOpenContractorsPopover] = React.useState(false);
  const [isManageContractorsOpen, setIsManageContractorsOpen] = React.useState(false);
  const [newContractorName, setNewContractorName] = React.useState('');
  const [editingContractor, setEditingContractor] = React.useState<{ id: number; name: string } | null>(null);

  const [institutions, setInstitutions] = React.useState(institutionsData);
  const [openInstitutionsPopover, setOpenInstitutionsPopover] = React.useState(false);
  const [isManageInstitutionsOpen, setIsManageInstitutionsOpen] = React.useState(false);
  const [newInstitutionName, setNewInstitutionName] = React.useState('');
  const [editingInstitution, setEditingInstitution] = React.useState<{ id: number; name: string } | null>(null);

  const [campuses, setCampuses] = React.useState(campusData);
  const [openCampusesPopover, setOpenCampusesPopover] = React.useState(false);
  const [isManageCampusesOpen, setIsManageCampusesOpen] = React.useState(false);
  const [newCampus, setNewCampus] = React.useState({ name: '', institutionName: '', municipality: ''});
  const [editingCampus, setEditingCampus] = React.useState<{ id: number; name: string; institutionName: string; municipality: string; } | null>(null);

  const form = useForm<ContractorFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialFormState,
  });
  
  const getViabilityReportDefaultContent = (formData: ContractorFormData) => {
    const institutionText = checklistType === 'viabilidad-educativa' ? `la ${formData.institutionName}, ` : '';
    const siteText = checklistType === 'viabilidad-educativa' ? `${formData.campusName}` : `la Junta de Internet ${formData.campusName}`;

    return {
      antecedentes: `Dentro del marco de ejecución del Convenio Interadministrativo No. 1211-2025, y conforme a las funciones asignadas a la interventoría técnica, se realizó la revisión del Estudio de Campo para ${institutionText}${siteText} con el fin de realizar la aprobación del mismo. Durante esta revisión se identificaron aspectos que requieren análisis técnico, los cuales se detallan a continuación.`,
      analisis: `Con base en la revisión documental, se evidenció lo siguiente:\n• El contratista realizo a satisfacción el Estudio de Campo para ${institutionText}${siteText} cumpliendo los Ítems 1.7 del Anexo Técnico.`,
      conclusion: `• Se concluye que se aprueba por parte de Interventoría el Estudio de Campo para ${institutionText}${siteText} cumpliendo los Ítems 1.7 del Anexo Técnico con concepto de viabilidad positivo por lo cual se puede proceder con la Fase de Instalación.`
    };
  };

  const [viabilityAntecedentes, setViabilityAntecedentes] = React.useState('');
  const [viabilityAnalisis, setViabilityAnalisis] = React.useState('');
  const [viabilityConclusion, setViabilityConclusion] = React.useState('');


  React.useEffect(() => {
    setIsClient(true);
    const checklistId = searchParams.get('id');

    const loadData = async () => {
        setChecklistLoading(true);

        if (checklistId) {
            const savedData = await getChecklistById(checklistId);
            if (savedData) {
                const formData = { ...savedData, date: new Date(savedData.date) };
                form.reset(formData);
                // The saved items already contain all necessary data (id, title, desc, obs, etc.)
                setChecklistItems(savedData.items); 
                if (savedData.signature) {
                    setSignature(savedData.signature);
                }

                const defaults = getViabilityReportDefaultContent(formData);
                setViabilityAntecedentes(savedData.viabilityAntecedentes || defaults.antecedentes);
                setViabilityAnalisis(savedData.viabilityAnalisis || defaults.analisis);
                setViabilityConclusion(savedData.viabilityConclusion || defaults.conclusion);
            }
        } else {
            // This is a new form, so we load the template questions
            const templateQuestions = await getChecklistTemplate(checklistType);
            const items = templateQuestions.map(q => ({...q, observation: '', photoDataUri: null, status: 'na' as ComplianceStatus}));
            setChecklistItems(items);

            const userId = localStorage.getItem('userId');
            const defaults = getViabilityReportDefaultContent(form.getValues());
            setViabilityAntecedentes(defaults.antecedentes);
            setViabilityAnalisis(defaults.analisis);
            setViabilityConclusion(defaults.conclusion);
            if (userId) {
                const userData = await getUserById(userId);
                if (userData && userData.username) {
                    form.setValue('inspectorName', userData.username);
                }
            }
        }
        setChecklistLoading(false);
    };
    
    loadData();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, checklistType]);

  React.useEffect(() => {
    const subscription = form.watch((value) => {
      const defaults = getViabilityReportDefaultContent(value as ContractorFormData);
      setViabilityAntecedentes(defaults.antecedentes);
      setViabilityAnalisis(defaults.analisis);
      setViabilityConclusion(defaults.conclusion);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch, checklistType]);

  const handleObservationChange = (itemId: string, value: string) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, observation: value } : item))
    );
  };
  
  const handleStatusChange = (itemId: string, value: ComplianceStatus) => {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, status: value } : item))
    );
  };

  const handlePhotoChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUri = loadEvent.target?.result as string;
        setChecklistItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, photoDataUri: dataUri } : item))
        );
      };
      reader.readAsDataURL(file);
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

  const handleAddContractor = () => {
    if (newContractorName.trim()) {
      setContractors([
        ...contractors,
        { id: contractors.length + 1, name: newContractorName.trim() },
      ]);
      setNewContractorName('');
    }
  };

  const handleDeleteContractor = (id: number) => {
    setContractors(contractors.filter((contractor) => contractor.id !== id));
  };

  const handleUpdateContractor = () => {
    if (editingContractor) {
      setContractors(
        contractors.map((contractor) =>
          contractor.id === editingContractor.id ? { ...contractor, name: editingContractor.name.trim() } : contractor
        )
      );
      setEditingContractor(null);
    }
  };
  
  const handleAddInstitution = () => {
    if (newInstitutionName.trim()) {
      setInstitutions([
        ...institutions,
        { id: institutions.length + 1, name: newInstitutionName.trim() },
      ]);
      setNewInstitutionName('');
    }
  };

  const handleDeleteInstitution = (id: number) => {
    setInstitutions(institutions.filter((inst) => inst.id !== id));
  };

  const handleUpdateInstitution = () => {
    if (editingInstitution) {
      setInstitutions(
        institutions.map((inst) =>
          inst.id === editingInstitution.id ? { ...inst, name: editingInstitution.name.trim() } : inst
        )
      );
      setEditingInstitution(null);
    }
  };
  
  const handleAddCampus = () => {
    if (newCampus.name.trim()) {
      const newId = campuses.length > 0 ? Math.max(...campuses.map(c => c.id)) + 1 : 1;
      setCampuses([
        ...campuses,
        { id: newId, ...newCampus },
      ]);
      setNewCampus({ name: '', institutionName: '', municipality: '' });
    }
  };

  const handleDeleteCampus = (id: number) => {
    setCampuses(campuses.filter((campus) => campus.id !== id));
  };

  const handleUpdateCampus = () => {
    if (editingCampus) {
      setCampuses(
        campuses.map((campus) =>
          campus.id === editingCampus.id ? { ...editingCampus, name: editingCampus.name.trim() } : campus
        )
      );
      setEditingCampus(null);
    }
  };

  const handleVerifyCompliance = async () => {
    setIsChecking(true);
    setAiFeedback([]);
    const checklistName = checklistType === 'viabilidad-educativa' ? 'Check Institución Educativa' : 'Check Junta de Internet';
    const result = await runComplianceCheck({
      checklistName: checklistName,
      checklistItems: checklistItems.map((item, index) => ({
        itemNumber: index + 1,
        itemDescription: `${item.title}: ${item.description}`,
        observation: item.observation,
        photoDataUri: item.photoDataUri || undefined,
      })),
    });
    if (result && result.itemsNeedingMoreEvidence) {
        const feedbackMap = new Map(result.itemsNeedingMoreEvidence.map(f => [f.itemNumber, f.reason]));
        const updatedFeedback = checklistItems
            .map((item, index) => ({ item, index }))
            .filter(({ index }) => feedbackMap.has(index + 1))
            .map(({ item, index }) => ({
                itemNumber: index + 1,
                reason: feedbackMap.get(index + 1)!,
                itemId: item.id,
            }));
        setAiFeedback(updatedFeedback as any);
    }
    setIsChecking(false);
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

 const handleExportViabilityPDF = async () => {
    setIsExporting(true);
    try {
      const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
      const footerImageUrl = 'https://i.imgur.com/d0mrUFZ.jpeg';

      const [headerImageBase64, footerImageBase64] = await Promise.all([
        imageToDataUri(headerImageUrl),
        imageToDataUri(footerImageUrl),
      ]);

      const contractorInfo = form.getValues();
      const doc = new jsPDF();

      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;

      const footerImage = new window.Image();
      footerImage.src = footerImageBase64;
      await new Promise((resolve) => {
        footerImage.onload = resolve;
      });

      const addHeaderAndFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        const now = new Date();
        const formattedDateTime = format(now, 'PPP p', { locale: es });

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
      doc.text('CONCEPTO TÉCNICO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const projectText = `Proyecto: Implementación de Infraestructura Tecnológica para el Fortalecimiento de la Conectividad, Servicios TIC y Apropiación Digital en los Hogares, Comunidades de Conectividad e Instituciones Educativas de la Región del Catatumbo y Área Metropolitana de Cúcuta del Departamento de Norte de Santander`;
      const splitProjectText = doc.splitTextToSize(projectText, contentWidth);
      doc.text(splitProjectText, margin, yPos);
      yPos += (splitProjectText.length * 5) + 2;
      doc.text(`Contratista: ${contractorInfo.contractorName}`, margin, yPos);
      yPos += 5;
      doc.text(`Interventor: ${contractorInfo.inspectorName}`, margin, yPos);
      yPos += 5;

      doc.setLineWidth(0.5);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;

      const addSection = (title: string, content: string) => {
          if (yPos > pageHeight - 40) {
              doc.addPage();
              yPos = 35;
          }
          doc.setFont('helvetica', 'bold');
          doc.text(title, margin, yPos);
          yPos += 6;
          doc.setFont('helvetica', 'normal');
          const splitContent = doc.splitTextToSize(content, contentWidth);
          doc.text(splitContent, margin, yPos);
          yPos += (splitContent.length * 5) + 5;
          doc.setLineWidth(0.2); // Thinner line
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 5;
      };

      addSection('1. Antecedentes', viabilityAntecedentes);
      addSection('2. Análisis Técnico', viabilityAnalisis);
      addSection('3. Conclusión Técnica', viabilityConclusion);


      yPos += 15;

      if (yPos > pageHeight - 60) {
        doc.addPage();
        yPos = 35;
      }

      if (signature) {
        doc.addImage(signature, 'PNG', margin, yPos, 60, 30);
        yPos += 35;
      }

      doc.setFont('helvetica', 'normal');
      doc.text(`${contractorInfo.inspectorName}.`, margin, yPos);
      yPos += 5;
      doc.text('Profesional Técnico.', margin, yPos);
      yPos += 5;

      const now = new Date();
      const formattedDate = format(now, 'PPP', { locale: es });
      const formattedTime = format(now, 'p', { locale: es });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const signatureText = `Firmado digitalmente por ${contractorInfo.inspectorName} el ${formattedDate} a las ${formattedTime}. La integridad de este documento está asegurada.`;
      const splitSignatureText = doc.splitTextToSize(signatureText, contentWidth);
      doc.text(splitSignatureText, margin, yPos);

      addHeaderAndFooter();
      const campusName = contractorInfo.campusName?.replace(/ /g, '_') || 'SedeEducativa';
      const dateStr = format(contractorInfo.date, 'yyyy-MM-dd');
      const fileName = `Concepto_Viabilidad_${campusName}_${dateStr}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error exporting Viability PDF:', error);
      toast({
        variant: 'destructive',
        title: 'Error al Exportar PDF de Viabilidad',
        description:
          'No se pudieron cargar las imágenes o hubo un error al generar el documento.',
      });
    } finally {
      setIsExporting(false);
    }
  };


  const handleSaveToDB = async () => {
    const contractorInfo = form.getValues();
    const isFormValid = await form.trigger();
    if (!isFormValid) {
       toast({
        variant: 'destructive',
        title: 'Formulario Incompleto',
        description: 'Por favor, complete toda la información del proyecto antes de guardar.',
      });
      return;
    }

    setIsSaving(true);
    
    try {
        const dataToSave = {
          ...contractorInfo,
          items: checklistItems,
          signature,
          viabilityAntecedentes,
          viabilityAnalisis,
          viabilityConclusion,
        };

        const result = await saveChecklist(dataToSave);

        if (result.success) {
          toast({
            title: '¡Guardado!',
            description: 'El checklist ha sido guardado en la base de datos.',
          });
          await handleExportPDF(); // Export first PDF
          await handleExportViabilityPDF(); // Export second PDF

          if (!form.getValues()._id) {
             const userId = localStorage.getItem('userId');
             if (userId) {
                const userData = await getUserById(userId);
                if (userData && userData.username) {
                    form.reset({...initialFormState, inspectorName: userData.username});
                } else {
                    form.reset(initialFormState);
                }
             } else {
                 form.reset(initialFormState);
             }
            const newItems = await getChecklistTemplate(checklistType);
            setChecklistItems(newItems.map(q => ({...q, observation: '', photoDataUri: null, status: 'na'})));
             clearSignature();
             router.replace(checklistType === 'viabilidad-educativa' ? '/form/viabilidad-educativa' : '/form/viabilidad-junta', undefined);
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Error al Guardar',
            description: result.error || 'Ocurrió un error inesperado. Por favor, intente de nuevo.',
          });
        }
    } catch(error) {
         toast({
            variant: 'destructive',
            title: 'Error de Conexión',
            description: 'No se pudo conectar a la base de datos. Verifique la configuración en el archivo .env',
          });
    } finally {
        setIsSaving(false);
    }
  };

  const handleExportCSV = () => {
    const contractorInfo = form.getValues();
    let csvContent = "data:text/csv;charset=utf-8,";
    
    csvContent += "IMPLEMENTACIÓN DE INFRAESTRUCTURA TECNOLÓGICA PARA EL FORTALECIMIENTO DE LA CONECTIVIDAD, SERVICIOS TIC Y APROPIACIÓN DIGITAL EN LOS HOGARES,COMUNIDADES DE CONECTIVIDAD E INSTITUCIONES EDUCATIVAS DE LA REGIÓN DEL CATATUMBO Y ÁREA METROPOLITANA DE CÚCUTA DEL DEPARTAMENTO DE NORTE DE SANTANDER.\n";
    csvContent += "Convenio Interadministrativo 1211-2025\n\n";
    csvContent += `Contratista,${contractorInfo.contractorName}\n`;
    if (checklistType === 'viabilidad-educativa') {
      csvContent += `Institución Educativa,${contractorInfo.institutionName}\n`;
    }
    const campusLabel = checklistType === 'viabilidad-junta' ? 'Junta de Internet – Comunidad de Conectividad' : 'Sede Educativa';
    csvContent += `${campusLabel},${contractorInfo.campusName}\n`;
    csvContent += `Tipo de Sitio,${contractorInfo.siteType}\n`;
    csvContent += `Municipio,${contractorInfo.municipality}\n`;
    csvContent += `Fecha,${format(contractorInfo.date, 'PPP', { locale: es })}\n`;
    csvContent += `Interventor,${contractorInfo.inspectorName}\n\n`;

    csvContent += "ID Item,Título,Descripción,Estado,Observación\n";

    checklistItems.forEach(item => {
        const row = [item.id, item.title, `"${item.description}"`, item.status, `"${item.observation.replace(/"/g, '""')}"`].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const siteType = contractorInfo.siteType?.replace(/ /g, '_') || 'TipoSitio';
    const campusName = contractorInfo.campusName?.replace(/ /g, '_') || 'SedeEducativa';
    const fileName = `Aprobación_Interventoria_${siteType}_${campusName}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
        const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
        const footerImageUrl = 'https://i.imgur.com/d0mrUFZ.jpeg';

        const [headerImageBase64, footerImageBase64] = await Promise.all([
            imageToDataUri(headerImageUrl),
            imageToDataUri(footerImageUrl)
        ]);
        
        const contractorInfo = form.getValues();
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
        
        let yPos = 32; 

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const title = 'IMPLEMENTACIÓN DE INFRAESTRUCTURA TECNOLÓGICA PARA EL FORTALECIMIENTO DE LA CONECTIVIDAD, SERVICIOS TIC Y APROPIACIÓN DIGITAL EN LOS HOGARES,COMUNIDADES DE CONECTIVIDAD E INSTITUCIONES EDUCATIVAS DE LA REGIÓN DEL CATATUMBO Y ÁREA METROPOLITANA DE CÚCUTA DEL DEPARTAMENTO DE NORTE DE SANTANDER.';
        const splitTitle = doc.splitTextToSize(title, contentWidth);
        doc.text(splitTitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += (splitTitle.length * 4) + 6; 
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        const subtitle = 'Convenio Interadministrativo 1211-2025';
        doc.text(subtitle, pageWidth / 2, yPos, { align: 'center' });
        yPos += 10;
        
        let currentY = yPos;

        const infoPairs = [];

        if (checklistType === 'viabilidad-educativa') {
            infoPairs.push({ label: 'Institución Educativa:', value: contractorInfo.institutionName });
        }
        
        const campusLabel = checklistType === 'viabilidad-junta' ? 'Nombre de la Junta de Internet – Comunidad de Conectividad:' : 'Sede Educativa:';
        infoPairs.push({ label: campusLabel, value: contractorInfo.campusName });

        infoPairs.push(
            { label: 'Contratista:', value: contractorInfo.contractorName },
            { label: 'Tipo de Sitio:', value: contractorInfo.siteType },
            { label: 'Municipio:', value: contractorInfo.municipality },
            { label: 'Fecha:', value: format(contractorInfo.date, 'PPP', { locale: es }) },
        );
        
        infoPairs.forEach(pair => {
            const lines = doc.splitTextToSize(`${pair.label} ${pair.value}`, contentWidth);
            doc.text(lines, margin, currentY);
            currentY += (lines.length * 5) + 2;
        });

        yPos = currentY;


        const tableColumn = ["ID", "Título", "Estado", "Observación"];
        const tableRows: (string | null)[][] = [];

        checklistItems.forEach(item => {
          const itemData = [
            item.id,
            item.title,
            item.status,
            item.observation,
          ];
          tableRows.push(itemData);
        });

        (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: yPos,
          styles: {
            fontSize: 8
          },
          headStyles: {
            fontSize: 9,
            fillColor: [33, 150, 243]
          },
          margin: { top: 35, bottom: 25 }, 
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
        
        if (yPos > pageHeight - 40) { 
          doc.addPage();
          yPos = 40;
        }

        doc.setFontSize(11);
        doc.text(`Interventor: ${contractorInfo.inspectorName}`, 14, yPos);
        yPos += 8;
        
        if (signature) {
            doc.text('Firma del Interventor:', 14, yPos);
            yPos += 4;
            doc.addImage(signature, 'PNG', 14, yPos, 60, 30);
            yPos += 32; 
            
            if (yPos > pageHeight - 40) { 
              doc.addPage();
              yPos = 40;
            }
            
            const now = new Date();
            const formattedDate = format(now, 'PPP', { locale: es });
            const formattedTime = format(now, 'p', { locale: es });
            
            doc.setFontSize(8);
            doc.setFont('helvetica', 'italic');

            
            doc.text('Profesional Técnico.', 14, yPos);
            yPos += 5;
            
            const signatureText = `Firmado digitalmente por ${contractorInfo.inspectorName} el ${formattedDate} a las ${formattedTime}. La integridad de este documento está asegurada.`;
            const splitSignatureText = doc.splitTextToSize(signatureText, contentWidth);
            doc.text(splitSignatureText, 14, yPos);
        }
        
        addHeaderAndFooter();
        const campusName = contractorInfo.campusName?.replace(/ /g, '_') || 'SedeEducativa';
        const dateStr = format(contractorInfo.date, 'yyyy-MM-dd');
        const fileName = `Aprobación_Interventoria_${campusName}_${dateStr}.pdf`;
        doc.save(fileName);
    } catch(error) {
        console.error("Error exporting PDF:", error);
        toast({
            variant: 'destructive',
            title: 'Error al Exportar PDF',
            description: 'No se pudieron cargar las imágenes para el encabezado o pie de página. Verifique la conexión a internet.',
        });
    } finally {
        setIsExporting(false);
    }
  };
  
  const getFeedbackForItemId = (itemId: string) => {
      return aiFeedback.find(f => (f as any).itemId === itemId);
  }

  const getStatusColor = (status: ComplianceStatus) => {
    switch (status) {
      case 'cumple':
        return 'bg-green-500';
      case 'no_cumple':
        return 'bg-red-500';
      case 'parcial':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-base font-semibold">
           {formTitle}
          </CardTitle>
          <CardDescription className="text-center">Convenio Interadministrativo 1211-2025</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                control={form.control}
                name="campusName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>
                        {checklistType === 'viabilidad-junta' 
                            ? 'Nombre de la Junta de Internet' 
                            : 'Nombre de la Sede Educativa'}
                    </FormLabel>
                    <div className="flex gap-2">
                      <Popover open={openCampusesPopover} onOpenChange={setOpenCampusesPopover}>
                        <PopoverTrigger asChild disabled={isViewer}>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value
                                ? campuses.find(
                                    (campus) => campus.name.toLowerCase() === field.value.toLowerCase()
                                  )?.name
                                : 'Seleccione o escriba un nombre'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder={checklistType === 'viabilidad-junta' ? "Buscar junta..." : "Buscar sede..."}
                              onValueChange={(value) => field.onChange(value)}
                              disabled={isViewer}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <p className="p-4 text-sm text-muted-foreground">
                                  No se encontró. Puede agregarla a la lista.
                                </p>
                              </CommandEmpty>
                              <CommandGroup>
                                {campuses.map((campus) => (
                                  <CommandItem
                                    value={campus.name}
                                    key={campus.id}
                                    onSelect={() => {
                                      form.setValue('campusName', campus.name);
                                      if (checklistType === 'viabilidad-educativa') {
                                        form.setValue('institutionName', campus.institutionName);
                                      }
                                      form.setValue('municipality', campus.municipality);
                                      setOpenCampusesPopover(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        campus.name === field.value ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    {campus.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {!isViewer && (
                      <Dialog open={isManageCampusesOpen} onOpenChange={setIsManageCampusesOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Administrar Sedes/Juntas</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Administrar {checklistType === 'viabilidad-junta' ? 'Juntas de Internet' : 'Sedes Educativas'}</DialogTitle>
                            <DialogDescription>
                              Agregue, edite o elimine elementos de la lista.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex flex-col gap-2">
                               <Input
                                value={newCampus.name}
                                onChange={(e) => setNewCampus({...newCampus, name: e.target.value})}
                                placeholder={checklistType === 'viabilidad-junta' ? "Nombre de la nueva junta" : "Nombre de la nueva sede"}
                                className="mb-2"
                              />
                               {checklistType === 'viabilidad-educativa' && 
                                <Input
                                    value={newCampus.institutionName}
                                    onChange={(e) => setNewCampus({...newCampus, institutionName: e.target.value})}
                                    placeholder="Nombre de la Institución"
                                    className="mb-2"
                                />}
                               <Input
                                value={newCampus.municipality}
                                onChange={(e) => setNewCampus({...newCampus, municipality: e.target.value})}
                                placeholder="Municipio"
                                className="mb-2"
                              />
                              <Button onClick={handleAddCampus}>
                                <Plus className="mr-2 h-4 w-4" /> Agregar
                              </Button>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                              {campuses.map((campus) => (
                                <div
                                  key={campus.id}
                                  className="flex items-center justify-between gap-2 rounded-md p-2 bg-muted/50"
                                >
                                  {editingCampus?.id === campus.id ? (
                                    <div className="flex flex-col gap-2 flex-1">
                                      <Input
                                          value={editingCampus.name}
                                          onChange={(e) =>
                                          setEditingCampus({ ...editingCampus, name: e.target.value })
                                          }
                                          className="h-8"
                                           placeholder={checklistType === 'viabilidad-junta' ? "Nombre de la junta" : "Nombre de la sede"}
                                      />
                                      {checklistType === 'viabilidad-educativa' &&
                                      <Input
                                          value={editingCampus.institutionName}
                                          onChange={(e) =>
                                          setEditingCampus({ ...editingCampus, institutionName: e.target.value })
                                          }
                                          className="h-8"
                                          placeholder="Institución"
                                      />}
                                       <Input
                                          value={editingCampus.municipality}
                                          onChange={(e) =>
                                          setEditingCampus({ ...editingCampus, municipality: e.target.value })
                                          }
                                          className="h-8"
                                          placeholder="Municipio"
                                      />
                                    </div>
                                  ) : (
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{campus.name}</p>
                                        <p className="text-xs text-muted-foreground">{campus.institutionName}</p>
                                        <p className="text-xs text-muted-foreground">{campus.municipality}</p>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1">
                                    {editingCampus?.id === campus.id ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={handleUpdateCampus}
                                        >
                                          <Save className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setEditingCampus(null)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setEditingCampus(campus)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => handleDeleteCampus(campus.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsManageCampusesOpen(false)}>
                              Cerrar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {checklistType === 'viabilidad-educativa' && (
              <FormField
                control={form.control}
                name="institutionName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Nombre de la Institución Educativa</FormLabel>
                    <div className="flex gap-2">
                    <Popover open={openInstitutionsPopover} onOpenChange={setOpenInstitutionsPopover}>
                      <PopoverTrigger asChild disabled={isViewer}>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              'w-full justify-between',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value
                              ? institutions.find(
                                  (inst) => inst.name.toLowerCase() === field.value.toLowerCase()
                                )?.name
                              : 'Seleccione o escriba un nombre'}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput 
                                placeholder="Buscar institución..." 
                                onValueChange={(value) => field.onChange(value)}
                                disabled={isViewer}
                             />
                            <CommandList>
                                <CommandEmpty>
                                    <p className="p-4 text-sm text-muted-foreground">
                                        No se encontró la institución. Puede agregarla a la lista.
                                    </p>
                                </CommandEmpty>
                                <CommandGroup>
                                {institutions.map((inst) => (
                                    <CommandItem
                                    value={inst.name}
                                    key={inst.id}
                                    onSelect={() => {
                                        form.setValue('institutionName', inst.name);
                                        setOpenInstitutionsPopover(false);
                                    }}
                                    >
                                    <Check
                                        className={cn(
                                        'mr-2 h-4 w-4',
                                        inst.name === field.value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    {inst.name}
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                          </Command>
                      </PopoverContent>
                    </Popover>
                     {!isViewer && (
                     <Dialog open={isManageInstitutionsOpen} onOpenChange={setIsManageInstitutionsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0">
                                <Edit className="h-4 w-4"/>
                                <span className="sr-only">Administrar Instituciones</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Administrar Instituciones</DialogTitle>
                                <DialogDescription>
                                    Agregue, edite o elimine instituciones de la lista.
                                </DialogDescription>
                            </DialogHeader>
                             <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input 
                                        value={newInstitutionName}
                                        onChange={(e) => setNewInstitutionName(e.target.value)}
                                        placeholder="Nombre de la nueva institución"
                                    />
                                    <Button onClick={handleAddInstitution}><Plus className="mr-2 h-4 w-4"/> Agregar</Button>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                                    {institutions.map(inst => (
                                        <div key={inst.id} className="flex items-center justify-between gap-2 rounded-md p-2 bg-muted/50">
                                            {editingInstitution?.id === inst.id ? (
                                                <Input 
                                                    value={editingInstitution.name}
                                                    onChange={(e) => setEditingInstitution({...editingInstitution, name: e.target.value})}
                                                    className="h-8"
                                                />
                                            ) : (
                                                <span className="text-sm flex-1">{inst.name}</span>
                                            )}
                                            
                                            <div className="flex items-center gap-1">
                                                {editingInstitution?.id === inst.id ? (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUpdateInstitution}>
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingInstitution(null)}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingInstitution(inst)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteInstitution(inst.id)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsManageInstitutionsOpen(false)}>Cerrar</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              )}
              <FormField
                control={form.control}
                name="contractorName"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Nombre del Contratista</FormLabel>
                    <div className="flex gap-2">
                      <Popover open={openContractorsPopover} onOpenChange={setOpenContractorsPopover}>
                        <PopoverTrigger asChild disabled={isViewer}>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                'w-full justify-between',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value
                                ? contractors.find(
                                    (contractor) => contractor.name.toLowerCase() === field.value.toLowerCase()
                                  )?.name
                                : 'Seleccione o escriba un nombre'}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command>
                            <CommandInput
                              placeholder="Buscar contratista..."
                              onValueChange={(value) => field.onChange(value)}
                              disabled={isViewer}
                            />
                            <CommandList>
                              <CommandEmpty>
                                <p className="p-4 text-sm text-muted-foreground">
                                  No se encontró el contratista. Puede agregarlo a la lista.
                                </p>
                              </CommandEmpty>
                              <CommandGroup>
                                {contractors.map((contractor) => (
                                  <CommandItem
                                    value={contractor.name}
                                    key={contractor.id}
                                    onSelect={() => {
                                      form.setValue('contractorName', contractor.name);
                                      setOpenContractorsPopover(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        contractor.name === field.value ? 'opacity-100' : 'opacity-0'
                                      )}
                                    />
                                    {contractor.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      {!isViewer && (
                      <Dialog open={isManageContractorsOpen} onOpenChange={setIsManageContractorsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Administrar Contratistas</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Administrar Contratistas</DialogTitle>
                            <DialogDescription>
                              Agregue, edite o elimine contratistas de la lista.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <Input
                                value={newContractorName}
                                onChange={(e) => setNewContractorName(e.target.value)}
                                placeholder="Nombre del nuevo contratista"
                              />
                              <Button onClick={handleAddContractor}>
                                <Plus className="mr-2 h-4 w-4" /> Agregar
                              </Button>
                            </div>
                            <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                              {contractors.map((contractor) => (
                                <div
                                  key={contractor.id}
                                  className="flex items-center justify-between gap-2 rounded-md p-2 bg-muted/50"
                                >
                                  {editingContractor?.id === contractor.id ? (
                                    <Input
                                      value={editingContractor.name}
                                      onChange={(e) =>
                                        setEditingContractor({ ...editingContractor, name: e.target.value })
                                      }
                                      className="h-8"
                                    />
                                  ) : (
                                    <span className="text-sm flex-1">{contractor.name}</span>
                                  )}
                                  <div className="flex items-center gap-1">
                                    {editingContractor?.id === contractor.id ? (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={handleUpdateContractor}
                                        >
                                          <Save className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setEditingContractor(null)}
                                        >
                                          <X className="h-4 w-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => setEditingContractor(contractor)}
                                        >
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive"
                                          onClick={() => handleDeleteContractor(contractor.id)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsManageContractorsOpen(false)}>
                              Cerrar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Inspección</FormLabel>
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
                            {field.value && isClient ? (
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
                          disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
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
                name="siteType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Sitio</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={true}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un tipo de sitio" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Junta de Internet">Junta de Internet</SelectItem>
                        <SelectItem value="Institución Educativa">Institución Educativa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="municipality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Municipio</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Cúcuta" {...field} disabled={isViewer}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="inspectorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Interventor</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Juan Pérez" {...field} disabled={isViewer}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Verificación</CardTitle>
          <CardDescription>
            {isViewer ? 'Revise cada elemento, sus observaciones y evidencias.' : 'Evalúe cada elemento, agregue observaciones y adjunte fotos como evidencia.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {checklistLoading ? (
             <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : (
            <>
            <Accordion type="multiple" className="w-full">
                {checklistItems.map((item) => {
                const feedback = getFeedbackForItemId(item.id);
                return (
                    <AccordionItem value={item.id} key={item.id}>
                    <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-4 w-full">
                        <div className={cn("h-3 w-3 rounded-full", getStatusColor(item.status))}></div>
                        <span className="text-left flex-1">
                            <span className="font-bold font-code mr-2">{item.id}</span>
                            {item.title}
                        </span>
                        {feedback && (
                            <Badge variant="destructive" className="flex items-center gap-1.5 animate-pulse">
                            <AlertCircle className="h-4 w-4"/> Se necesita evidencia
                            </Badge>
                        )}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-6">
                        <p className="text-muted-foreground">{item.description}</p>
                        
                        {feedback && (
                            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
                                <p className="text-sm text-destructive-foreground font-semibold">Observación de IA:</p>
                                <p className="text-sm text-destructive-foreground/80">{(feedback as any).reason}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                            <div>
                                    <Label className="mb-2 block">Estado de Cumplimiento</Label>
                                    <RadioGroup
                                        value={item.status}
                                        onValueChange={(value) => handleStatusChange(item.id, value as ComplianceStatus)}
                                        className="flex flex-wrap gap-x-4 gap-y-2"
                                        disabled={isViewer}
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="cumple" id={`cumple-${item.id}`} />
                                            <Label htmlFor={`cumple-${item.id}`}>Cumple</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="no_cumple" id={`no_cumple-${item.id}`} />
                                            <Label htmlFor={`no_cumple-${item.id}`}>No Cumple</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="parcial" id={`parcial-${item.id}`} />
                                            <Label htmlFor={`parcial-${item.id}`}>Parcial</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="na" id={`na-${item.id}`} />
                                            <Label htmlFor={`na-${item.id}`}>N/A</Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                                <div>
                                    <Label htmlFor={`obs-${item.id}`}>Observaciones</Label>
                                    <Textarea
                                        id={`obs-${item.id}`}
                                        placeholder="Añada sus comentarios aquí..."
                                        value={item.observation}
                                        onChange={(e) => handleObservationChange(item.id, e.target.value)}
                                        rows={4}
                                        disabled={isViewer}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor={`photo-${item.id}`}>Documentación Visual</Label>
                                <div className="flex items-center gap-4">
                                <Input id={`photo-${item.id}`} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange(item.id, e)} disabled={isViewer}/>
                                {!isViewer && (
                                    <Button asChild variant="outline">
                                    <label htmlFor={`photo-${item.id}`} className="cursor-pointer flex items-center gap-2">
                                        <Camera className="h-4 w-4" /> Subir Foto
                                    </label>
                                    </Button>
                                )}
                                </div>
                                {item.photoDataUri && (
                                    <Dialog>
                                    <DialogTrigger asChild>
                                        <button className="mt-2 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-all">
                                        <Image
                                            src={item.photoDataUri}
                                            alt={`Evidencia para ${item.id}`}
                                            width={128}
                                            height={128}
                                            className="object-cover h-32 w-32"
                                            data-ai-hint="site construction"
                                        />
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-3xl">
                                        <DialogHeader>
                                            <DialogTitle>Vista Previa - {item.id}: {item.title}</DialogTitle>
                                        </DialogHeader>
                                        <div className="mt-4">
                                        <Image
                                            src={item.photoDataUri}
                                            alt={`Evidencia para ${item.id}`}
                                            width={800}
                                            height={600}
                                            className="w-full h-auto object-contain rounded-md"
                                            data-ai-hint="site construction"
                                        />
                                        </div>
                                    </DialogContent>
                                    </Dialog>
                                )}
                            </div>
                        </div>
                    </AccordionContent>
                    </AccordionItem>
                );
                })}
            </Accordion>
          
            <div className="py-6">
                <Separator />
            </div>

            <div className="space-y-4">
                <Collapsible className="space-y-2">
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between space-x-4 px-1 cursor-pointer">
                            <h4 className="text-sm font-semibold">
                                Contenido del Concepto de Viabilidad
                            </h4>
                            <Button variant="ghost" size="sm" className="w-9 p-0">
                                <ChevronsUpDown className="h-4 w-4" />
                                <span className="sr-only">Toggle</span>
                            </Button>
                        </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                    <Card>
                        <CardContent className="p-6 space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="antecedentes">1. Antecedentes</Label>
                                <Textarea id="antecedentes" value={viabilityAntecedentes} onChange={(e) => setViabilityAntecedentes(e.target.value)} rows={5} disabled={isViewer} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="analisis">2. Análisis Técnico</Label>
                                <Textarea id="analisis" value={viabilityAnalisis} onChange={(e) => setViabilityAnalisis(e.target.value)} rows={5} disabled={isViewer} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="conclusion">3. Conclusión Técnica</Label>
                                <Textarea id="conclusion" value={viabilityConclusion} onChange={(e) => setViabilityConclusion(e.target.value)} rows={5} disabled={isViewer} />
                            </div>
                        </CardContent>
                    </Card>
                    </CollapsibleContent>
                </Collapsible>
                
                <div className="py-6">
                    <Separator />
                </div>
                
                <div>
                    <Label>Firma del Interventor</Label>
                    <p className="text-sm text-muted-foreground">
                        {isViewer ? 'Firma del interventor que realizó el checklist.' : 'Dibuje su firma en el recuadro o suba una imagen de su firma.'}
                    </p>
                </div>
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
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row items-center gap-4 justify-end pt-6 border-t">
            {!isViewer && (
              <>
                <Button onClick={handleSaveToDB} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {form.getValues()._id ? 'Actualizar' : 'Guardar'}
                </Button>
                <p className="text-sm text-muted-foreground max-w-xs text-right hidden md:block">
                    La IA puede verificar si los elementos con observaciones tienen evidencia fotográfica de respaldo.
                </p>
                <Button onClick={handleVerifyCompliance} disabled={isChecking} className="bg-primary hover:bg-primary/90">
                    {isChecking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Verificar con IA
                </Button>
              </>
            )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {!isViewer && (
                <>
                  <DropdownMenuItem onClick={handleExportCSV}>
                      Exportar a CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF()}>
                    Exportar a PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportViabilityPDF()}>
                    Exportar Concepto Viabilidad PDF
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardFooter>
      </Card>
    </div>
  );
}
