// src/app/actions.ts
'use server';
import 'dotenv/config';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { complianceCheck, type ComplianceCheckInput, type ComplianceCheckOutput } from '@/ai/flows/compliance-check';
import { generateReportIntro } from '@/ai/flows/generate-activity-report-intro';
import type { GenerateReportIntroInput, GenerateReportIntroOutput } from '@/ai/flows/schemas';
import { checklistInstitucionEducativaData, checklistInstalacionInstitucionEducativaData, checklistJuntaInternetData, checklistInstalacionJuntaInternetData } from '@/lib/checklist-data';

// Define the schema for the checklist data to be saved
const SaveChecklistInputSchema = z.object({
  _id: z.string().optional(),
  contractorName: z.string(),
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
const UserLoginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

const UserRegisterSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  cedula: z.string().min(5, 'La cédula es requerida.'),
  telefono: z.string().min(7, 'El teléfono es requerido.'),
});

const UserUpdateSchema = z.object({
    _id: z.string(),
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
    cedula: z.string().min(5, 'La cédula es requerida.'),
    telefono: z.string().min(7, 'El teléfono es requerido.'),
});

const AdminUpdateUserSchema = z.object({
    _id: z.string(),
    username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres.'),
    cedula: z.string().min(5, 'La cédula es requerida.'),
    telefono: z.string().min(7, 'El teléfono es requerido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.').optional().or(z.literal('')),
    role: z.enum(['admin', 'editor', 'viewer', 'empleado']),
});


export type UserLoginInput = z.infer<typeof UserLoginSchema>;
export type UserRegisterInput = z.infer<typeof UserRegisterSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
export type AdminUpdateUserInput = z.infer<typeof AdminUpdateUserSchema>;

const ChecklistQuestionSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
});
export type ChecklistQuestion = z.infer<typeof ChecklistQuestionSchema>;

const UpdateChecklistTemplateSchema = z.object({
    templateName: z.string(),
    questions: z.array(ChecklistQuestionSchema),
});
export type UpdateChecklistTemplateInput = z.infer<typeof UpdateChecklistTemplateSchema>;

// Schema for Daily Activities
const DailyActivitySchema = z.object({
  _id: z.string().optional(),
  date: z.date(),
  description: z.string().min(1, 'La descripción es requerida.'),
  inspectorId: z.string(),
  inspectorName: z.string(),
});
export type DailyActivity = z.infer<typeof DailyActivitySchema>;

const ScheduleTaskStatusSchema = z.enum(['por_iniciar', 'iniciada', 'en_ejecucion', 'pausada', 'ejecutada']);
export type ScheduleTaskStatus = z.infer<typeof ScheduleTaskStatusSchema>;

const ScheduleTaskSchema = z.object({
    _id: z.string().optional(),
    name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres.'),
    startDate: z.date().optional(),
    endDate: z.date().optional(),
    status: ScheduleTaskStatusSchema,
    justification: z.string().optional(),
    assignedTo: z.string().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    dependencies: z.array(z.string()).optional(),
}).refine(data => {
    if (data.startDate && !data.endDate) return true; // Allow no end date for group headers
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

export type ScheduleTask = z.infer<typeof ScheduleTaskSchema>;

export async function runComplianceCheck(input: ComplianceCheckInput): Promise<ComplianceCheckOutput> {
  try {
    const result = await complianceCheck(input);
    return result;
  } catch (error) {
    console.error('Error running compliance check:', error);
    return { itemsNeedingMoreEvidence: [] };
  }
}

export async function generateActivityReportIntro(input: GenerateReportIntroInput): Promise<GenerateReportIntroOutput> {
    try {
        const result = await generateReportIntro(input);
        return result;
    } catch (error) {
        console.error('Error generating report intro:', error);
        return 'No se pudo generar la introducción para el informe de actividades.';
    }
}


async function getDbClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.trim() === '') {
    throw new Error('La variable de entorno MONGODB_URI no está configurada o está vacía. Asegúrese de que el archivo .env contenga una cadena de conexión válida a MongoDB.');
  }

  return new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });
}

export async function loginUser(credentials: UserLoginInput): Promise<{ success: boolean; error?: string; userId?: string; isAdmin?: boolean; role?: string; }> {
  const validation = UserLoginSchema.safeParse(credentials);
  if (!validation.success) {
    return { success: false, error: 'Datos de entrada inválidos.' };
  }

  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");

    const user = await usersCollection.findOne({ email: credentials.email });
    if (!user) {
      return { success: false, error: 'El usuario no existe.' };
    }
    
    const isAdmin = user.email === "ingcamilo.toro19@gmail.com";

    // If the user is not an admin, check their status.
    // Users without a status field (created before the approval system) are considered approved.
    if (!isAdmin && user.status && user.status !== 'approved') {
        if(user.status === 'blocked') {
            return { success: false, error: 'Su cuenta ha sido bloqueada por un administrador.' };
        }
        return { success: false, error: 'Su cuenta está pendiente de aprobación por un administrador.' };
    }

    const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
    if (!isPasswordValid) {
      return { success: false, error: 'Contraseña incorrecta.' };
    }
    
    return { success: true, userId: user._id.toString(), isAdmin, role: isAdmin ? 'admin' : user.role };
  } catch (error) {
    console.error('Error en el login:', error);
    return { success: false, error: 'Ocurrió un error en el servidor.' };
  } finally {
    await client.close();
  }
}

export async function registerUser(data: UserRegisterInput): Promise<{ success: boolean; error?: string; pending?: boolean }> {
  const validation = UserRegisterSchema.safeParse(data);
  if (!validation.success) {
    return { success: false, error: 'Datos de entrada inválidos.' };
  }

  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");

    const existingUser = await usersCollection.findOne({ email: data.email });
    if (existingUser) {
      return { success: false, error: 'El correo electrónico ya está en uso.' };
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const isAdmin = data.email === "ingcamilo.toro19@gmail.com";

    const result = await usersCollection.insertOne({
      username: data.username,
      email: data.email,
      password: hashedPassword,
      cedula: data.cedula,
      telefono: data.telefono,
      status: isAdmin ? 'approved' : 'pending',
      role: isAdmin ? 'admin' : 'viewer',
      createdAt: new Date(),
    });
    
    if (result.insertedId) {
        return { success: true, pending: !isAdmin };
    } else {
        return { success: false, error: 'No se pudo crear el usuario.' };
    }

  } catch (error) {
    console.error('Error en el registro:', error);
    return { success: false, error: 'Ocurrió un error en el servidor.' };
  } finally {
    await client.close();
  }
}

export async function updateUser(userData: UserUpdateInput): Promise<{ success: boolean; error?: string }> {
    const validation = UserUpdateSchema.safeParse(userData);
    if (!validation.success) {
        return { success: false, error: 'Datos de entrada inválidos.' };
    }

    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");

        const { _id, ...dataToUpdate } = userData;

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(_id) },
            { $set: dataToUpdate }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Usuario no encontrado.' };
        }

        return { success: true };

    } catch (error) {
        console.error('Error actualizando usuario:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}

export async function getUserById(id: string): Promise<any> {
    if (!ObjectId.isValid(id)) {
        return null;
    }
    
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        
        if (!user) {
            return null;
        }

        const { password, ...userWithoutPassword } = user;
        return JSON.parse(JSON.stringify(userWithoutPassword));

    } catch (error) {
        console.error('Error fetching user by ID:', error);
        return null;
    } finally {
        await client.close();
    }
}


export async function getChecklists() {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("checklists");
    const checklists = await collection.find({}, { 
      projection: { 
        campusName: 1, 
        contractorName: 1, 
        date: 1,
        institutionName: 1,
        inspectorName: 1,
        items: 1 // Include items for edit URL logic
      } 
    }).sort({ date: -1 }).toArray();

    return JSON.parse(JSON.stringify(checklists));
  } catch (error) {
    console.error('Error fetching checklists from MongoDB:', error);
    return [];
  } finally {
    await client.close();
  }
}

export async function getChecklistById(id: string) {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("checklists");
    const checklist = await collection.findOne({ _id: new ObjectId(id) });
    return JSON.parse(JSON.stringify(checklist));
  } catch (error) {
    console.error(`Error fetching checklist with id ${id}:`, error);
    return null;
  } finally {
    await client.close();
  }
}


export async function saveChecklist(data: SaveChecklistInput): Promise<{ success: boolean; error?: string }> {
  const validation = SaveChecklistInputSchema.safeParse(data);

  if (!validation.success) {
    console.error('Invalid input data:', validation.error.flatten());
    return { success: false, error: 'Los datos de entrada no son válidos.' };
  }
  
  const client = await getDbClient();

  try {
    await client.connect();
    
    const db = client.db("instacheck");
    const collection = db.collection("checklists");
    
    if (validation.data._id) {
      const { _id, ...dataToUpdate } = validation.data;
      await collection.updateOne({ _id: new ObjectId(_id) }, { $set: dataToUpdate });
    } else {
      // Check for duplicates before inserting a new record
      const existingChecklist = await collection.findOne({ campusName: validation.data.campusName });
      if (existingChecklist) {
          return { success: false, error: `Ya existe un checklist para "${validation.data.campusName}". Por favor, cárguelo desde el historial para actualizarlo.` };
      }
      await collection.insertOne(validation.data);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving checklist to MongoDB:', error);
    if (error instanceof Error) {
        if (error.name.includes('MongoAuth')) {
            return { success: false, error: 'Error de autenticación con la base de datos. Verifique las credenciales.' };
        }
        if (error.message.includes('MONGODB_URI')) {
             return { success: false, error: error.message };
        }
    }
    return { success: false, error: 'No se pudo guardar el checklist en la base de datos.' };
  } finally {
    await client.close();
  }
}

export async function deleteChecklist(id: string): Promise<{ success: boolean; error?: string }> {
  if (!id) {
    return { success: false, error: 'ID de checklist no proporcionado.' };
  }

  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("checklists");
    
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 1) {
      return { success: true };
    } else {
      return { success: false, error: 'No se encontró el checklist para eliminar.' };
    }

  } catch (error) {
    console.error(`Error deleting checklist with id ${id}:`, error);
    return { success: false, error: 'No se pudo eliminar el checklist de la base de datos.' };
  } finally {
    await client.close();
  }
}

// Admin actions for user management
export async function getAllUsers(adminId: string) {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");
    // Find all users except the admin who is currently logged in
    const users = await usersCollection.find({ _id: { $ne: new ObjectId(adminId) } }).toArray();
    return JSON.parse(JSON.stringify(users.map(({ password, ...user }) => user)));
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  } finally {
    await client.close();
  }
}

export async function getPendingUsers() {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");
    const pendingUsers = await usersCollection.find({ status: 'pending' }).toArray();
    return JSON.parse(JSON.stringify(pendingUsers));
  } catch (error) {
    console.error('Error fetching pending users:', error);
    return [];
  } finally {
    await client.close();
  }
}

export async function approveUser(userId: string, role: 'editor' | 'viewer' | 'empleado'): Promise<{ success: boolean; error?: string }> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { status: 'approved', role: role } }
    );
    if (result.matchedCount === 0) {
      return { success: false, error: 'Usuario no encontrado.' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error approving user:', error);
    return { success: false, error: 'Ocurrió un error en el servidor.' };
  } finally {
    await client.close();
  }
}

export async function rejectUser(userId: string): Promise<{ success: boolean; error?: string }> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const usersCollection = db.collection("users");
    const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });
    if (result.deletedCount === 0) {
      return { success: false, error: 'Usuario no encontrado.' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error rejecting user:', error);
    return { success: false, error: 'Ocurrió un error en el servidor.' };
  } finally {
    await client.close();
  }
}

export async function deleteUserById(userId: string): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");
        const result = await usersCollection.deleteOne({ _id: new ObjectId(userId) });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Usuario no encontrado.' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}

export async function updateUserRole(userId: string, role: 'editor' | 'viewer' | 'admin' | 'empleado'): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { role: role, status: 'approved' } } // Ensure status is approved when role is set
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Usuario no encontrado.' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error updating user role:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}


export async function updateUserByAdmin(userData: AdminUpdateUserInput): Promise<{ success: boolean; error?: string }> {
    const validation = AdminUpdateUserSchema.safeParse(userData);
    if (!validation.success) {
        return { success: false, error: 'Datos de entrada inválidos.' };
    }

    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");

        const { _id, password, role, ...dataToUpdate } = userData;
        
        const updateDoc: any = { $set: { ...dataToUpdate, role, status: 'approved' } };

        if (password) {
            updateDoc.$set.password = await bcrypt.hash(password, 10);
        }

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(_id) },
            updateDoc
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Usuario no encontrado.' };
        }

        return { success: true };

    } catch (error) {
        console.error('Error actualizando usuario por admin:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}


export async function toggleUserStatus(userId: string, currentStatus: 'approved' | 'blocked'): Promise<{ success: boolean; error?: string }> {
    const newStatus = currentStatus === 'approved' ? 'blocked' : 'approved';
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const usersCollection = db.collection("users");
        const result = await usersCollection.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { status: newStatus } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Usuario no encontrado.' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error toggling user status:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}


// Checklist Template Management Actions

const initialTemplates = {
    'viabilidad-educativa': checklistInstitucionEducativaData,
    'viabilidad-junta': checklistJuntaInternetData,
    'instalacion-educativa': checklistInstalacionInstitucionEducativaData,
    'instalacion-junta': checklistInstalacionJuntaInternetData,
};

async function seedChecklistTemplate(db: any, templateName: string, data: any[]) {
    const collection = db.collection("checklist_templates");
    const existingTemplate = await collection.findOne({ templateName });
    if (!existingTemplate) {
        await collection.insertOne({
            templateName,
            questions: data,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }
}

export async function getChecklistTemplate(templateName: string): Promise<ChecklistQuestion[]> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("checklist_templates");

        // Seed initial data if it doesn't exist for any template
        await Promise.all(
            Object.entries(initialTemplates).map(([key, data]) => seedChecklistTemplate(db, key, data))
        );

        const template = await collection.findOne({ templateName });
        if (template) {
            return template.questions as ChecklistQuestion[];
        }

        // Fallback to initial data if not found after seeding attempt
        return (initialTemplates as any)[templateName] || [];

    } catch (error) {
        console.error(`Error fetching checklist template ${templateName}:`, error);
        return (initialTemplates as any)[templateName] || [];
    } finally {
        await client.close();
    }
}

export async function updateChecklistTemplate(input: UpdateChecklistTemplateInput): Promise<{ success: boolean; error?: string }> {
    const validation = UpdateChecklistTemplateSchema.safeParse(input);
    if (!validation.success) {
        return { success: false, error: 'Datos de entrada inválidos.' };
    }
    
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("checklist_templates");

        const result = await collection.updateOne(
            { templateName: input.templateName },
            { $set: { questions: input.questions, updatedAt: new Date() } },
            { upsert: true }
        );

        if (result.matchedCount === 0 && result.upsertedCount === 0) {
            return { success: false, error: 'No se pudo actualizar la plantilla.' };
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating checklist template:', error);
        return { success: false, error: 'Ocurrió un error en el servidor.' };
    } finally {
        await client.close();
    }
}

// Data Management Actions (Contractors, Institutions, Campuses)
export interface Contractor {
    _id: string; // From MongoDB
    id?: number; // Optional original ID
    name: string;
}

export interface Institution {
    _id: string; // From MongoDB
    id?: number; // Optional original ID
    name: string;
}

export interface Campus {
    _id: string; // From MongoDB
    id?: number; // Optional original ID
    name: string;
    institutionName: string;
    municipality: string;
}

async function seedData<T>(db: any, collectionName: string, initialData: T[], nameField: keyof T) {
  const collection = db.collection(collectionName);
  for (const item of initialData) {
    const query = { [nameField]: item[nameField] };
    const existing = await collection.findOne(query);
    if (!existing) {
      await collection.insertOne({
        ...item,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }
}

// Contractor Actions
export async function getContractors(): Promise<Contractor[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("contractors");
    const contractors = await collection.find({}).sort({ name: 1 }).toArray();
    return JSON.parse(JSON.stringify(contractors));
  } finally {
    await client.close();
  }
}

export async function addContractor(name: string): Promise<{ success: boolean, contractor?: any, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("contractors");
        const newContractor = { name, createdAt: new Date(), updatedAt: new Date() };
        const result = await collection.insertOne(newContractor);
        return { success: true, contractor: { ...newContractor, _id: result.insertedId } };
    } catch (e) {
        return { success: false, error: "Error al agregar contratista." };
    } finally {
        await client.close();
    }
}

export async function updateContractor(id: string, name: string): Promise<{ success: boolean, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("contractors");
        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { name, updatedAt: new Date() } });
        return { success: result.matchedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al actualizar contratista." };
    } finally {
        await client.close();
    }
}

export async function deleteContractor(id: string): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("contractors");
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: result.deletedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al eliminar contratista." };
    } finally {
        await client.close();
    }
}

// Institution Actions
export async function getInstitutions(): Promise<Institution[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("institutions");
    const institutions = await collection.find({}).sort({ name: 1 }).toArray();
    return JSON.parse(JSON.stringify(institutions));
  } finally {
    await client.close();
  }
}

export async function addInstitution(name: string): Promise<{ success: boolean, institution?: any, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("institutions");
        const newInstitution = { name, createdAt: new Date(), updatedAt: new Date() };
        const result = await collection.insertOne(newInstitution);
        return { success: true, institution: { ...newInstitution, _id: result.insertedId } };
    } catch (e) {
        return { success: false, error: "Error al agregar institución." };
    } finally {
        await client.close();
    }
}

export async function updateInstitution(id: string, name: string): Promise<{ success: boolean, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("institutions");
        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { name, updatedAt: new Date() } });
        return { success: result.matchedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al actualizar institución." };
    } finally {
        await client.close();
    }
}

export async function deleteInstitution(id: string): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("institutions");
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: result.deletedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al eliminar institución." };
    } finally {
        await client.close();
    }
}


// Campus (Sedes/Juntas) Actions
export async function getCampuses(): Promise<Campus[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("campuses");
    const campuses = await collection.find({}).sort({ name: 1 }).toArray();
    return JSON.parse(JSON.stringify(campuses));
  } finally {
    await client.close();
  }
}

const CampusSchema = z.object({
  name: z.string().min(1, "El nombre es requerido."),
  institutionName: z.string(),
  municipality: z.string().min(1, "El municipio es requerido."),
});

export async function addCampus(data: Omit<Campus, '_id' | 'id'>): Promise<{ success: boolean, campus?: any, error?: string }> {
    const validation = CampusSchema.safeParse(data);
    if (!validation.success) return { success: false, error: validation.error.errors[0].message };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("campuses");
        const newCampus = { ...validation.data, createdAt: new Date(), updatedAt: new Date() };
        const result = await collection.insertOne(newCampus);
        return { success: true, campus: { ...newCampus, _id: result.insertedId } };
    } catch (e) {
        return { success: false, error: "Error al agregar sede/junta." };
    } finally {
        await client.close();
    }
}

export async function updateCampus(id: string, data: Omit<Campus, '_id' | 'id'>): Promise<{ success: boolean, error?: string }> {
    const validation = CampusSchema.safeParse(data);
    if (!validation.success) return { success: false, error: validation.error.errors[0].message };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("campuses");
        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { ...validation.data, updatedAt: new Date() } });
        return { success: result.matchedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al actualizar sede/junta." };
    } finally {
        await client.close();
    }
}

export async function deleteCampus(id: string): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("campuses");
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: result.deletedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al eliminar sede/junta." };
    } finally {
        await client.close();
    }
}

// Daily Activity Actions

export async function getDailyActivities(inspectorId: string): Promise<DailyActivity[]> {
  if (!inspectorId) return [];
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("daily_activities");
    const activities = await collection.find({ inspectorId }).sort({ date: -1 }).toArray();
    return JSON.parse(JSON.stringify(activities));
  } finally {
    await client.close();
  }
}

export async function saveDailyActivity(activity: Omit<DailyActivity, '_id'> & { _id?: string }): Promise<{ success: boolean, activity?: any, error?: string }> {
  const { _id, ...activityData } = activity;
  const validation = DailyActivitySchema.omit({ _id: true }).safeParse(activityData);

  if (!validation.success) {
    return { success: false, error: 'Datos de actividad inválidos.' };
  }
  
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("daily_activities");

    if (_id) {
      // Update
      const result = await collection.updateOne({ _id: new ObjectId(_id) }, { $set: activityData });
      if (result.matchedCount === 0) {
        return { success: false, error: 'Actividad no encontrada.' };
      }
      return { success: true, activity: { ...activityData, _id } };
    } else {
      // Insert
      const result = await collection.insertOne(activityData);
      return { success: true, activity: { ...activityData, _id: result.insertedId } };
    }
  } catch (e) {
    console.error("Error saving daily activity:", e);
    return { success: false, error: "Error al guardar la actividad." };
  } finally {
    await client.close();
  }
}

export async function deleteDailyActivity(id: string): Promise<{ success: boolean, error?: string }> {
  if (!ObjectId.isValid(id)) return { success: false, error: 'ID inválido.' };
  
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("daily_activities");
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return { success: false, error: 'Actividad no encontrada.' };
    }
    return { success: true };
  } catch (e) {
    console.error("Error deleting daily activity:", e);
    return { success: false, error: "Error al eliminar la actividad." };
  } finally {
    await client.close();
  }
}

// Schedule Task Actions
export async function getScheduleTasks(): Promise<ScheduleTask[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("schedule_tasks");
    // Sort manually in code to allow for grouping headers
    const tasks = await collection.find({}).toArray();
    return JSON.parse(JSON.stringify(tasks));
  } finally {
    await client.close();
  }
}

export async function saveScheduleTask(task: Omit<ScheduleTask, '_id'> & { _id?: string }): Promise<{ success: boolean, task?: any, error?: string }> {
  const { _id, ...taskData } = task;
  const validation = ScheduleTaskSchema.safeParse(taskData);

  if (!validation.success) {
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }
  
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("schedule_tasks");

    const dataToSave: Partial<ScheduleTask> = { ...validation.data };
    if (!dataToSave.startDate) {
        delete dataToSave.startDate;
        delete dataToSave.endDate;
    }

    if (_id) {
      // Update
      const result = await collection.updateOne({ _id: new ObjectId(_id) }, { $set: dataToSave });
      if (result.matchedCount === 0) {
        return { success: false, error: 'Tarea no encontrada.' };
      }
      return { success: true, task: { ...dataToSave, _id } };
    } else {
      // Insert
      const result = await collection.insertOne(dataToSave as ScheduleTask);
      return { success: true, task: { ...dataToSave, _id: result.insertedId.toString() } };
    }
  } catch (e) {
    console.error("Error saving schedule task:", e);
    return { success: false, error: "Error al guardar la tarea del cronograma." };
  } finally {
    await client.close();
  }
}

export async function deleteScheduleTask(id: string): Promise<{ success: boolean, error?: string }> {
  if (!ObjectId.isValid(id)) return { success: false, error: 'ID inválido.' };
  
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("schedule_tasks");
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return { success: false, error: 'Tarea no encontrada.' };
    }
    return { success: true };
  } catch (e) {
    console.error("Error deleting schedule task:", e);
    return { success: false, error: "Error al eliminar la tarea." };
  } finally {
    await client.close();
  }
}
