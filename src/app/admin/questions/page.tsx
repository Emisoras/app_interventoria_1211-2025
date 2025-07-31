// src/app/admin/questions/page.tsx
'use client';

import { getChecklistTemplate, updateChecklistTemplate, type ChecklistQuestion, type UpdateChecklistTemplateInput } from '@/app/actions';
import { CheckInterventoriaLogo } from '@/components/check-interventoria-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit, GripVertical, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

type ChecklistType = 'viabilidad-educativa' | 'viabilidad-junta' | 'instalacion-educativa' | 'instalacion-junta';

const checklistTypeLabels: Record<ChecklistType, string> = {
    'viabilidad-educativa': 'Viabilidad Institución Educativa',
    'viabilidad-junta': 'Viabilidad Junta de Internet',
    'instalacion-educativa': 'Instalación Institución Educativa',
    'instalacion-junta': 'Instalación Junta de Internet',
};

export default function AdminQuestionsPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [selectedChecklist, setSelectedChecklist] = useState<ChecklistType | ''>('');
    const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<ChecklistQuestion | null>(null);
    const [newQuestion, setNewQuestion] = useState({ title: '', description: '' });
    const dragItem = React.useRef<number | null>(null);
    const dragOverItem = React.useRef<number | null>(null);

    useEffect(() => {
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (!isAdmin) {
            toast({
                variant: 'destructive',
                title: 'Acceso Denegado',
                description: 'No tiene permisos para acceder a esta página.',
            });
            router.push('/login');
        }
    }, [router, toast]);

    const fetchQuestions = useCallback(async (templateName: ChecklistType) => {
        setLoading(true);
        const data = await getChecklistTemplate(templateName);
        setQuestions(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        if (selectedChecklist) {
            fetchQuestions(selectedChecklist);
        } else {
            setQuestions([]);
        }
    }, [selectedChecklist, fetchQuestions]);

    const handleSave = async () => {
        if (!selectedChecklist) return;
        setSaving(true);
        const result = await updateChecklistTemplate({ templateName: selectedChecklist, questions });
        if (result.success) {
            toast({ title: '¡Guardado!', description: 'Las preguntas se han actualizado correctamente.' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setSaving(false);
    };
    
    const handleEditQuestion = (question: ChecklistQuestion) => {
        setEditingQuestion(question);
        setIsDialogOpen(true);
    };

    const handleUpdateQuestion = () => {
        if (!editingQuestion) return;
        setQuestions(questions.map(q => q.id === editingQuestion.id ? editingQuestion : q));
        setIsDialogOpen(false);
        setEditingQuestion(null);
    };
    
    const handleAddQuestion = () => {
        const newId = `Q-${Date.now()}`;
        setQuestions([...questions, { id: newId, ...newQuestion }]);
        setNewQuestion({ title: '', description: '' });
    };

    const handleDeleteQuestion = (id: string) => {
        setQuestions(questions.filter(q => q.id !== id));
    };

    const handleDragSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const newQuestions = [...questions];
        const draggedItemContent = newQuestions.splice(dragItem.current, 1)[0];
        newQuestions.splice(dragOverItem.current, 0, draggedItemContent);
        dragItem.current = null;
        dragOverItem.current = null;
        setQuestions(newQuestions);
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col">
            <header className="p-4 border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10">
                <div className="container mx-auto flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <CheckInterventoriaLogo className="h-8 w-8 text-primary" />
                        <h1 className="text-xl md:text-2xl font-bold font-headline text-foreground">
                            Administrar Preguntas
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button asChild variant="outline">
                            <Link href="/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Link>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto p-4 md:p-8 flex-grow">
                <Card>
                    <CardHeader>
                        <CardTitle>Seleccionar Checklist</CardTitle>
                        <CardDescription>Elige el checklist que deseas editar.</CardDescription>
                        <Select onValueChange={(value: ChecklistType) => setSelectedChecklist(value)} value={selectedChecklist}>
                            <SelectTrigger className="w-full md:w-1/2 mt-4">
                                <SelectValue placeholder="Selecciona un tipo de checklist" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(checklistTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </CardHeader>
                    {selectedChecklist && (
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center items-center h-40">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold">Agregar Nueva Pregunta</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-title">Título de la Pregunta</Label>
                                                <Input id="new-title" value={newQuestion.title} onChange={e => setNewQuestion({ ...newQuestion, title: e.target.value })} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-desc">Descripción</Label>
                                                <Textarea id="new-desc" value={newQuestion.description} onChange={e => setNewQuestion({ ...newQuestion, description: e.target.value })} />
                                            </div>
                                        </div>
                                        <Button onClick={handleAddQuestion} disabled={!newQuestion.title}><Plus className="mr-2 h-4 w-4" /> Agregar Pregunta</Button>
                                    </div>
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold">Preguntas Actuales</h3>
                                        <div className="border rounded-md">
                                        {questions.map((q, index) => (
                                            <div
                                                key={q.id}
                                                className="flex items-center gap-4 p-4 border-b last:border-b-0"
                                                draggable
                                                onDragStart={() => dragItem.current = index}
                                                onDragEnter={() => dragOverItem.current = index}
                                                onDragEnd={handleDragSort}
                                                onDragOver={e => e.preventDefault()}
                                            >
                                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                                                <div className="flex-1">
                                                    <p className="font-medium">{q.title}</p>
                                                    <p className="text-sm text-muted-foreground">{q.description}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => handleEditQuestion(q)}><Edit className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteQuestion(q.id)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button onClick={handleSave} disabled={saving}>
                                            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Guardar Cambios
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    )}
                </Card>
            </main>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Pregunta</DialogTitle>
                    </DialogHeader>
                    {editingQuestion && (
                         <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Título</Label>
                                <Input id="edit-title" value={editingQuestion.title} onChange={e => setEditingQuestion({...editingQuestion, title: e.target.value})} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-desc">Descripción</Label>
                                <Textarea id="edit-desc" value={editingQuestion.description} onChange={e => setEditingQuestion({...editingQuestion, description: e.target.value})} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpdateQuestion}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
