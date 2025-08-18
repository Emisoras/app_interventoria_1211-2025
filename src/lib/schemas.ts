
// src/lib/schemas.ts
import { z } from 'zod';

// Define the schema for the checklist data to be saved
export const SaveChecklistInputSchema = z.object({
  _id: z.string().optional(),
  operatorName: z.string(),
  institutionName: z.string(),
  campusName: z.string(),
  siteType: z.string(),
  municipality: z.string(),
  date: z.date(),
  inspectorName: z.string(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    observation: z.string(),
    photoDataUri: z.string().nullable(),
    status: z.enum(['cumple', 'no_cumple', 'parcial', 'na']),
  })),
  signature: z.string().nullable(),
  // Add optional fields for the viability report content
  viabilityAntecedentes: z.string().optional(),
  viabilityAnalisis: z.string().optional(),
  viabilityConclusion: z.string().optional(),
});

export type SaveChecklistInput = z.infer<typeof SaveChecklistInputSchema>;

// Schemas for user authentication
export const UserLoginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export const UserRegisterSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  cedula: z.string().min(5, 'La cédula es requerida.'),
  telefono: z.string().min(7, 'El teléfono es requerido.'),
});

export const UserUpdateSchema = z.object({
    _id: z.string(),
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
    cedula: z.string().min(5, 'La cédula es requerida.'),
    telefono: z.string().min(7, 'El teléfono es requerido.'),
});

export const AdminUpdateUserSchema = z.object({
    _id: z.string(),
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
    cedula: z.string().min(5, 'La cédula es requerida.'),
    telefono: z.string().min(7, 'El teléfono es requerido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal('')),
    role: z.enum(['admin', 'editor', 'viewer', 'empleado', 'tecnico_campo']),
});


export type UserLoginInput = z.infer<typeof UserLoginSchema>;
export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

export const ChecklistQuestionSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
});
export type ChecklistQuestion = z.infer<typeof ChecklistQuestionSchema>;

export const UpdateChecklistTemplateSchema = z.object({
    templateName: z.string(),
    questions: z.array(ChecklistQuestionSchema),
});
export type UpdateChecklistTemplateInput = z.infer<typeof UpdateChecklistTemplateSchema>;

// Schema for Daily Activities
export const DailyActivitySchema = z.object({
  _id: z.string().optional(),
  date: z.date(),
  description: z.string().min(1, 'La descripción es requerida.'),
  inspectorId: z.string(),
  inspectorName: z.string(),
});
export type DailyActivity = z.infer<typeof DailyActivitySchema>;

export const ScheduleTaskStatusSchema = z.enum(['por_iniciar', 'iniciada', 'en_ejecucion', 'pausada', 'ejecutada']);
export type ScheduleTaskStatus = z.infer<typeof ScheduleTaskStatusSchema>;

export const ScheduleTaskPrioritySchema = z.enum(['baja', 'media', 'alta', 'urgente']);
export type ScheduleTaskPriority = z.infer<typeof ScheduleTaskPrioritySchema>;

export const ScheduleTypeSchema = z.enum(['cronograma_proyecto', 'cronograma_interventoria']);
export type ScheduleType = z.infer<typeof ScheduleTypeSchema>;


export const ScheduleTaskSchema = z.object({
    _id: z.string().optional(),
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    status: ScheduleTaskStatusSchema,
    priority: ScheduleTaskPrioritySchema.optional(),
    justification: z.string().optional(),
    assignedTo: z.string().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    dependencies: z.array(z.string()).optional(),
    observations: z.string().optional(),
    type: ScheduleTypeSchema,
}).refine(data => {
    if (data.startDate && !data.endDate) return true; // Allow no end date for milestones
    if (!data.startDate) return true; // Allow no start date for group headers
    if (data.startDate && data.endDate) return data.endDate >= data.startDate;
    return false;
}, {
    message: 'La fecha de finalización debe ser posterior o igual a la de inicio.',
    path: ['endDate'],
}).refine(data => !(data.status === 'pausada' && (!data.justification || data.justification.trim() === '')), {
    message: 'La justificación es requerida si el estado es "Pausada".',
    path: ['justification'],
});

export type ScheduleTask = z.infer<typeof ScheduleTaskSchema>;


// Inventory Management Schemas
export const InventoryItemStatusSchema = z.enum(['en_bodega', 'aprobado', 'rechazado', 'entregado']);
export type InventoryItemStatus = z.infer<typeof InventoryItemStatusSchema>;

export const InventoryItemSchema = z.object({
    _id: z.string().optional(),
    name: z.string().min(1, "El nombre del elemento es requerido."),
    reference: z.string().optional(),
    brand: z.string().optional(),
    serial: z.string().min(1, "El número de serie es requerido."),
    quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
    destination: z.string().optional(),
    supplier: z.string().optional(),
    status: InventoryItemStatusSchema.default('en_bodega'),
    observations: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
});
export type InventoryItem = z.infer<typeof InventoryItemSchema>;


// Campus Schema
export const CampusSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  institutionName: z.string(),
  municipality: z.string().min(1, "El municipio es requerido."),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});
export type Campus = z.infer<typeof CampusSchema> & { _id: string };


// Route Assignment Schemas
export const RouteStopStatusSchema = z.enum(['pendiente', 'en_proceso', 'visitada']);
export type RouteStopStatus = z.infer<typeof RouteStopStatusSchema>;

export const RouteCostSchema = z.object({
    description: z.string().min(1, "La descripción del costo es requerida."),
    amount: z.coerce.number().min(0, "El valor debe ser positivo."),
});
export type RouteCost = z.infer<typeof RouteCostSchema>;

export const RouteStopSchema = z.object({
  campusId: z.string(),
  status: RouteStopStatusSchema.default('pendiente'),
  costs: z.array(RouteCostSchema).optional(),
  visitTime: z.coerce.number().min(0, "El tiempo debe ser positivo.").optional().default(90),
});
export type RouteStop = z.infer<typeof RouteStopSchema>;

export const RouteSchema = z.object({
  _id: z.string().optional(),
  technicianId: z.string(),
  technicianName: z.string(),
  date: z.date(),
  stops: z.array(RouteStopSchema).min(1, 'Debe seleccionar al menos una sede.'),
  observations: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Route = z.infer<typeof RouteSchema>;
