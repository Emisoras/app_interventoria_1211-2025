// src/components/item-bulk-upload-form.tsx
'use client';

import { Loader2, Upload } from 'lucide-react';
import Papa from 'papaparse';
import * as React from 'react';

import { bulkSaveInventoryItems, type InventoryItem } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

interface ItemBulkUploadFormProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onItemsUploaded: () => void;
}

const CSV_HEADERS_ES = ["nombre", "serial", "marca", "referencia", "cantidad", "proveedor", "observaciones"];
const CSV_HEADERS_EN = ["name", "serial", "brand", "reference", "quantity", "supplier", "observations"];

export function ItemBulkUploadForm({ isOpen, setIsOpen, onItemsUploaded }: ItemBulkUploadFormProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = React.useState(false);
  const [parsedData, setParsedData] = React.useState<InventoryItem[]>([]);
  const [fileName, setFileName] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const validData = results.data.map((row: any) => ({
            name: row.nombre || '',
            serial: row.serial || '',
            brand: row.marca || '',
            reference: row.referencia || '',
            quantity: parseInt(row.cantidad, 10) || 1,
            supplier: row.proveedor || '',
            observations: row.observaciones || '',
            status: 'en_bodega' as const,
          })).filter(item => item.name && item.serial); // Basic validation
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
      toast({ variant: 'destructive', title: 'No hay datos', description: 'No hay datos válidos para importar.' });
      return;
    }

    setIsUploading(true);
    const result = await bulkSaveInventoryItems(parsedData);
    setIsUploading(false);

    if (result.success) {
      toast({
        title: '¡Importación Exitosa!',
        description: `${result.insertedCount} elementos han sido agregados al inventario.`,
      });
      onItemsUploaded();
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
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) resetState();
        setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importación Masiva de Elementos</DialogTitle>
          <DialogDescription>
            Suba un archivo CSV con los elementos a añadir al inventario. Las columnas deben ser: {CSV_HEADERS_ES.join(', ')}.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange} />
            {fileName && <p className="text-sm text-muted-foreground">Archivo seleccionado: {fileName}</p>}
          
          {parsedData.length > 0 && (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              <h3 className="text-lg font-medium p-4">Vista Previa de Datos a Importar ({parsedData.length} filas)</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    {CSV_HEADERS_ES.map(header => <TableHead key={header}>{header}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedData.slice(0, 10).map((item, index) => ( // Preview first 10 rows
                    <TableRow key={index}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.serial}</TableCell>
                      <TableCell>{item.brand}</TableCell>
                      <TableCell>{item.reference}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell>{item.observations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
