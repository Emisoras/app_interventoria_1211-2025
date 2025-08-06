// src/components/inventory-management.tsx
'use client';

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Edit, Loader2, Plus, Trash2, Search, Download, Truck, Upload as UploadIcon } from 'lucide-react';
import * as React from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Image from 'next/image';
import SignatureCanvas from 'react-signature-canvas';

import {
  deleteInventoryItem,
  getInventoryItems,
  bulkUpdateInventoryItemsStatus
} from '@/app/actions';
import {
    InventoryItem,
    InventoryItemStatus,
} from '@/lib/schemas';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ItemForm } from './item-form';
import { ItemDispatchForm } from './item-dispatch-form';
import { Upload, Eraser } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { ItemBulkDispatchForm } from './item-bulk-dispatch-form';
import { ItemBulkUploadForm } from './item-bulk-upload-form';

const statusMap: Record<InventoryItemStatus, { label: string; color: string }> = {
  en_bodega: { label: 'En Bodega', color: 'bg-gray-500' },
  aprobado: { label: 'Aprobado', color: 'bg-green-500' },
  rechazado: { label: 'Rechazado', color: 'bg-red-500' },
  entregado: { label: 'Entregado', color: 'bg-blue-500' },
};

export function InventoryManagement({ isReadOnly }: { isReadOnly: boolean }) {
  const { toast } = useToast();
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isItemFormOpen, setIsItemFormOpen] = React.useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = React.useState(false);
  const [isDispatchFormOpen, setIsDispatchFormOpen] = React.useState(false);
  const [isBulkDispatchFormOpen, setIsBulkDispatchFormOpen] = React.useState(false);
  const [selectedItem, setSelectedItem] = React.useState<InventoryItem | null>(null);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<InventoryItemStatus | 'todos'>('todos');
  const [isExporting, setIsExporting] = React.useState(false);
  const [signature, setSignature] = React.useState<string | null>(null);
  const sigCanvas = React.useRef<SignatureCanvas>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchItems = React.useCallback(async () => {
    setLoading(true);
    const data = await getInventoryItems();
    setItems(data);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);
  
  const filteredItems = React.useMemo(() => {
    return items.filter(item => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            item.name.toLowerCase().includes(term) ||
            (item.brand || '').toLowerCase().includes(term) ||
            (item.reference || '').toLowerCase().includes(term) ||
            (item.serial || '').toLowerCase().includes(term) ||
            (item.destination || '').toLowerCase().includes(term) ||
            (item.supplier || '').toLowerCase().includes(term)
        );
        const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter]);

  const handleOpenItemForm = (item: InventoryItem | null = null) => {
    setSelectedItem(item);
    setIsItemFormOpen(true);
  };
  
  const handleOpenDispatchForm = (item: InventoryItem) => {
    setSelectedItem(item);
    setIsDispatchFormOpen(true);
  }

  const handleDelete = async (id: string) => {
    const result = await deleteInventoryItem(id);
    if (result.success) {
      toast({ title: '¡Elemento Eliminado!', description: 'El elemento ha sido eliminado del inventario.' });
      fetchItems();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setSignature(null);
  }

  const handleSignatureEnd = () => {
    if (sigCanvas.current) {
        setSignature(sigCanvas.current.toDataURL('image/png'));
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

  const handleGenerateDeliveryNotePDF = async () => {
    if (!searchTerm.trim()) {
        toast({ variant: 'destructive', title: 'Destino no especificado', description: 'Por favor, busque un destino específico para generar el acta.' });
        return;
    }

    const itemsForNote = items.filter(item => 
        item.destination?.toLowerCase() === searchTerm.toLowerCase() &&
        (item.status === 'entregado' || item.status === 'aprobado')
    );

    if (itemsForNote.length === 0) {
        toast({ variant: 'destructive', title: 'No hay elementos', description: `No se encontraron elementos con estado "Entregado" o "Aprobado" para el destino "${searchTerm}".` });
        return;
    }
    
    setIsExporting(true);

    try {
        const headerImageUrl = 'https://i.imgur.com/328Qpnh.png';
        const [headerImageBase64] = await Promise.all([imageToDataUri(headerImageUrl)]);
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const margin = 14;
        
        // Header
        doc.addImage(headerImageBase64, 'PNG', 0, 0, pageWidth, 30);
        
        // Title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('ACTA DE ENTREGA DE ELEMENTOS', pageWidth / 2, 40, { align: 'center' });

        // Info
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        let yPos = 50;
        doc.text(`Fecha de Entrega: ${format(new Date(), 'PPP', { locale: es })}`, margin, yPos);
        yPos += 7;
        doc.text(`Destino: ${searchTerm}`, margin, yPos);
        yPos += 10;
        
        // Table
        const tableColumn = ["Cant.", "Elemento", "Marca", "Modelo/Ref.", "Serial"];
        const tableRows = itemsForNote.map(item => [
            item.quantity.toString(),
            item.name,
            item.brand || '-',
            item.reference || '-',
            item.serial,
        ]);

        (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: yPos,
          theme: 'grid',
          headStyles: { fillColor: [33, 150, 243] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 25;
        
        // Signatures
        const signatureBlockWidth = (pageWidth - margin * 3) / 2;
        
        const addSignatureBlock = (title: string, x: number, y: number, signatureImage?: string | null) => {
            if (signatureImage && title === 'Firma Interventoría (Recibe)') {
                doc.addImage(signatureImage, 'PNG', x, y - 20, 50, 20);
            }
            doc.setLineWidth(0.2);
            doc.line(x, y, x + signatureBlockWidth, y);
            doc.text(title, x, y + 5);
        }
        
        addSignatureBlock('Firma Contratista (Entrega)', margin, yPos);
        addSignatureBlock('Firma Interventoría (Recibe)', margin + signatureBlockWidth + margin, yPos, signature);
        
        yPos += 30;
        addSignatureBlock('Firma Responsable Sede (Recibe a Satisfacción)', margin, yPos);


        const fileName = `ACTA_ENTREGA_${searchTerm.replace(/ /g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
        toast({ title: '¡Acta Generada!', description: `El PDF del acta de entrega para ${searchTerm} ha sido descargado.` });

    } catch (error) {
        console.error("Error generating PDF:", error);
        toast({ variant: 'destructive', title: 'Error al Exportar', description: 'No se pudo generar el acta en PDF.' });
    } finally {
        setIsExporting(false);
    }
  };

  const handleSelect = (itemId: string, checked: boolean) => {
    if (checked) {
        setSelectedItems(prev => [...prev, itemId]);
    } else {
        setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        const availableItems = filteredItems.filter(item => item.status === 'en_bodega').map(item => item._id!);
        setSelectedItems(availableItems);
    } else {
        setSelectedItems([]);
    }
  };

  const numAvailableForSelection = filteredItems.filter(item => item.status === 'en_bodega').length;


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle>Inventario de Equipos</CardTitle>
              <CardDescription>Gestione y verifique los elementos para las sedes del proyecto.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 w-full sm:w-auto">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Buscar por serial, destino..." 
                        className="pl-8 w-full sm:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                    <SelectTrigger className="w-full sm:w-auto min-w-[180px]">
                        <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos los Estados</SelectItem>
                        {Object.entries(statusMap).map(([key, { label }]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 {!isReadOnly && (
                    <Button onClick={() => handleGenerateDeliveryNotePDF()} disabled={isExporting || !searchTerm.trim()}>
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4"/>}
                        Generar Acta
                    </Button>
                )}
                 {!isReadOnly && (
                    <>
                        <Button onClick={() => setIsBulkDispatchFormOpen(true)} disabled={selectedItems.length === 0}>
                            <Truck className="mr-2 h-4 w-4" />
                            Despachar Selección ({selectedItems.length})
                        </Button>
                        <Button onClick={() => handleOpenItemForm()}>
                            <Plus className="mr-2 h-4 w-4" />
                            Añadir Elemento
                        </Button>
                        <Button variant="outline" onClick={() => setIsBulkUploadOpen(true)}>
                            <UploadIcon className="mr-2 h-4 w-4" />
                            Importar CSV
                        </Button>
                    </>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                    <TableHead className="w-10">
                        <Checkbox
                            onCheckedChange={handleSelectAll}
                            checked={numAvailableForSelection > 0 && selectedItems.length === numAvailableForSelection}
                            aria-label="Seleccionar todas las filas disponibles"
                        />
                    </TableHead>
                  <TableHead>Elemento</TableHead>
                  <TableHead>Marca/Modelo</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Estado</TableHead>
                  {!isReadOnly && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center">No se encontraron elementos que coincidan con la búsqueda.</TableCell></TableRow>
                ) : (
                  filteredItems.map(item => (
                    <TableRow key={item._id} data-state={selectedItems.includes(item._id!) ? "selected" : ""}>
                       <TableCell>
                         <Checkbox
                            checked={selectedItems.includes(item._id!)}
                            onCheckedChange={(checked) => handleSelect(item._id!, !!checked)}
                            disabled={item.status !== 'en_bodega'}
                            aria-label="Seleccionar fila"
                         />
                       </TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div>{item.brand || '-'}</div>
                        <div className="text-xs text-muted-foreground">{item.reference || '-'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.serial}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.destination || 'En Bodega'}</TableCell>
                      <TableCell>
                        <Badge className={cn('text-white', statusMap[item.status].color)}>
                          {statusMap[item.status].label}
                        </Badge>
                      </TableCell>
                      {!isReadOnly && (
                        <TableCell className="text-right whitespace-nowrap">
                          {item.status === 'en_bodega' && (
                            <Button variant="outline" size="sm" onClick={() => handleOpenDispatchForm(item)}>
                              <Truck className="mr-2 h-4 w-4" />
                              Asignar/Salida
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenItemForm(item)}><Edit className="h-4 w-4" /></Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará el elemento permanentemente.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item._id!)} className="bg-destructive hover:bg-destructive/90">Sí, eliminar</AlertDialogAction>
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
        </CardContent>
         <CardFooter className="flex flex-col items-start gap-4 pt-6 border-t">
              <div className="font-medium">Firma del Interventor para Actas</div>
              <div className="relative w-full max-w-sm h-40 border rounded-md bg-white flex items-center justify-center">
                  {signature ? (
                      <Image src={signature} alt="Firma" layout="fill" objectFit="contain" />
                  ) : (
                      <SignatureCanvas
                          ref={sigCanvas}
                          penColor="black"
                          canvasProps={{ className: 'w-full h-full' }}
                          onEnd={handleSignatureEnd}
                          disabled={isReadOnly}
                      />
                  )}
              </div>
              {!isReadOnly && (
                  <div className="flex gap-2">
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
          </CardFooter>
      </Card>
      
      <ItemForm 
        isOpen={isItemFormOpen} 
        setIsOpen={setIsItemFormOpen} 
        editingItem={selectedItem}
        onItemSaved={() => {
            fetchItems();
            setSelectedItem(null);
        }}
      />

      <ItemDispatchForm
        isOpen={isDispatchFormOpen}
        setIsOpen={setIsDispatchFormOpen}
        itemToDispatch={selectedItem}
        onItemSaved={() => {
            fetchItems();
            setSelectedItem(null);
        }}
      />

      <ItemBulkDispatchForm
        isOpen={isBulkDispatchFormOpen}
        setIsOpen={setIsBulkDispatchFormOpen}
        itemsToDispatch={selectedItems}
        onItemsDispatched={() => {
            fetchItems();
            setSelectedItems([]);
        }}
       />
       
       <ItemBulkUploadForm
        isOpen={isBulkUploadOpen}
        setIsOpen={setIsBulkUploadOpen}
        onItemsUploaded={() => {
            fetchItems();
        }}
      />
      
    </div>
  );
}
