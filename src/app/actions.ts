// src/app/actions.ts
'use server';
import 'dotenv/config';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { complianceCheck, type ComplianceCheckInput, type ComplianceCheckOutput } from '@/ai/flows/compliance-check';
import { generateReportIntro } from '@/ai/flows/generate-activity-report-intro';
import type { GenerateReportIntroInput } from '@/ai/flows/schemas';
import { 
    SaveChecklistInputSchema,
    UserLoginSchema,
    UserRegisterSchema,
    UserUpdateSchema,
    AdminUpdateUserSchema,
    UpdateChecklistTemplateSchema,
    DailyActivitySchema,
    ScheduleTaskSchema,
    InventoryItemSchema,
    CampusSchema,
    type SaveChecklistInput,
    type UserLoginInput,
    type UserRegisterInput,
    type UserUpdateInput,
    type AdminUpdateUserInput,
    type UpdateChecklistTemplateInput,
    type DailyActivity,
    type ScheduleTask,
    type InventoryItem,
    type ScheduleType,
} from '@/lib/schemas';


export type { 
    SaveChecklistInput, 
    UserLoginInput, 
    UserRegisterInput, 
    UserUpdateInput, 
    AdminUpdateUserInput,
    ChecklistQuestion,
    UpdateChecklistTemplateInput,
    DailyActivity,
    ScheduleTask,
    ScheduleTaskStatus,
    ScheduleTaskPriority,
    InventoryItem,
    InventoryItemStatus,
    ScheduleType
} from '@/lib/schemas';

import { checklistInstitucionEducativaData, checklistInstalacionInstitucionEducativaData, checklistJuntaInternetData, checklistInstalacionJuntaInternetData } from '@/lib/checklist-data';
import type { ChecklistQuestion } from '@/lib/schemas';

export async function runComplianceCheck(input: ComplianceCheckInput): Promise<ComplianceCheckOutput> {
  try {
    const result = await complianceCheck(input);
    return result;
  } catch (error) {
    console.error('Error running compliance check:', error);
    return { itemsNeedingMoreEvidence: [] };
  }
}

export async function generateActivityReportIntro(input: GenerateReportIntroInput): Promise<string> {
    try {
        const { introduction } = await generateReportIntro(input);
        return introduction;
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
        operatorName: 1, 
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

// Data Management Actions (Operators, Institutions, Campuses)
export interface Operator {
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

// Operator Actions
export async function getOperators(): Promise<Operator[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("operators");
    const operators = await collection.find({}).sort({ name: 1 }).toArray();
    return JSON.parse(JSON.stringify(operators));
  } finally {
    await client.close();
  }
}

export async function addOperator(name: string): Promise<{ success: boolean, operator?: any, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("operators");
        const newOperator = { name, createdAt: new Date(), updatedAt: new Date() };
        const result = await collection.insertOne(newOperator);
        const savedOperator = await collection.findOne({ _id: result.insertedId });
        return { success: true, operator: JSON.parse(JSON.stringify(savedOperator)) };
    } catch (e) {
        return { success: false, error: "Error al agregar operador." };
    } finally {
        await client.close();
    }
}

export async function updateOperator(id: string, name: string): Promise<{ success: boolean, error?: string }> {
    if (!name || name.trim().length === 0) return { success: false, error: "El nombre es requerido." };
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("operators");
        const result = await collection.updateOne({ _id: new ObjectId(id) }, { $set: { name, updatedAt: new Date() } });
        return { success: result.matchedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al actualizar operador." };
    } finally {
        await client.close();
    }
}

export async function deleteOperator(id: string): Promise<{ success: boolean, error?: string }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("operators");
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        return { success: result.deletedCount > 0 };
    } catch (e) {
        return { success: false, error: "Error al eliminar operador." };
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
        const savedInstitution = await collection.findOne({ _id: result.insertedId });
        return { success: true, institution: JSON.parse(JSON.stringify(savedInstitution)) };
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
        const savedCampus = await collection.findOne({ _id: result.insertedId });
        return { success: true, campus: JSON.parse(JSON.stringify(savedCampus)) };
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
export async function getScheduleTasks(type: ScheduleType): Promise<ScheduleTask[]> {
  const client = await getDbClient();
  try {
    await client.connect();
    const db = client.db("instacheck");
    const collection = db.collection("schedule_tasks");
    const tasks = await collection.find({ type: type }).toArray();
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

export async function bulkSaveScheduleTasks(tasks: ScheduleTask[], type: ScheduleType): Promise<{ success: boolean; error?: string; insertedCount?: number; }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("schedule_tasks");

        const validationResults = tasks.map(task => ScheduleTaskSchema.omit({ _id: true, type: true }).safeParse(task));
        const invalidItems = validationResults.filter(r => !r.success);
        if (invalidItems.length > 0) {
            return { success: false, error: 'Algunas tareas en el archivo tienen datos inválidos.' };
        }

        const validatedTasks = validationResults.map(r => (r as z.SafeParseSuccess<ScheduleTask>).data);
        
        if (validatedTasks.length === 0) {
            return { success: false, error: 'No hay tareas válidas para importar.' };
        }
        
        const tasksToInsert = validatedTasks.map(task => {
            const cleanTask: Partial<ScheduleTask> = { ...task, type };
            if (cleanTask.startDate === undefined) {
                delete cleanTask.startDate;
            }
            if (cleanTask.endDate === undefined) {
                delete cleanTask.endDate;
            }
            return cleanTask;
        });

        const result = await collection.insertMany(tasksToInsert as any[]);

        return { success: true, insertedCount: result.insertedCount };
    } catch (e) {
        console.error("Error in bulk save tasks:", e);
        return { success: false, error: "Ocurrió un error en el servidor durante la carga masiva de tareas." };
    } finally {
        await client.close();
    }
}


// Inventory Management Actions
export async function getInventoryItems(): Promise<InventoryItem[]> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("inventory");
        const items = await collection.find({}).sort({ createdAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(items));
    } finally {
        await client.close();
    }
}

export async function saveInventoryItem(item: Omit<InventoryItem, '_id'> & { _id?: string }): Promise<{ success: boolean, item?: any, error?: string }> {
    const { _id, ...itemData } = item;
    const validation = InventoryItemSchema.omit({_id: true}).safeParse(itemData);

    if (!validation.success) {
        return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
    }

    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("inventory");

        // Check for duplicate serial number
        if (itemData.serial && itemData.serial.trim() !== '') {
            const query: any = { serial: itemData.serial };
            if (_id) {
                // If updating, exclude the current item from the check
                query._id = { $ne: new ObjectId(_id) };
            }
            const existingSerial = await collection.findOne(query);
            if (existingSerial) {
                return { success: false, error: `El número de serie "${itemData.serial}" ya está registrado para otro elemento.` };
            }
        }


        const dataToSave = { 
            ...validation.data, 
            updatedAt: new Date(),
        };

        if (_id) {
            const result = await collection.updateOne({ _id: new ObjectId(_id) }, { $set: dataToSave });
            if (result.matchedCount === 0) return { success: false, error: 'Elemento no encontrado.' };
            return { success: true, item: { ...dataToSave, _id } };
        } else {
            const dataToInsert = { ...dataToSave, createdAt: new Date() };
            const result = await collection.insertOne(dataToInsert as any);
            return { success: true, item: { ...dataToInsert, _id: result.insertedId.toString() } };
        }
    } catch (e) {
        console.error("Error saving inventory item:", e);
        return { success: false, error: "Error al guardar el elemento en el inventario." };
    } finally {
        await client.close();
    }
}

export async function deleteInventoryItem(id: string): Promise<{ success: boolean, error?: string }> {
    if (!ObjectId.isValid(id)) return { success: false, error: 'ID inválido.' };
    
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("inventory");
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return { success: false, error: 'Elemento no encontrado.' };
        }
        return { success: true };
    } catch (e) {
        console.error("Error deleting inventory item:", e);
        return { success: false, error: "Error al eliminar el elemento del inventario." };
    } finally {
        await client.close();
    }
}

export async function bulkSaveInventoryItems(items: InventoryItem[]): Promise<{ success: boolean; error?: string; insertedCount?: number; }> {
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("inventory");

        // Validate all items at once before any database operation
        const validationResults = items.map(item => InventoryItemSchema.omit({ _id: true }).safeParse(item));
        const invalidItems = validationResults.filter(r => !r.success);
        if (invalidItems.length > 0) {
            return { success: false, error: 'Algunos elementos en el archivo tienen datos inválidos. Por favor, verifique el formato.' };
        }

        const validatedItems = validationResults.map(r => (r as z.SafeParseSuccess<InventoryItem>).data);

        // Check for duplicate serials within the provided list
        const serials = validatedItems.map(item => item.serial).filter(Boolean);
        if (serials.length > 0) {
            const uniqueSerials = new Set(serials);
            if (serials.length !== uniqueSerials.size) {
                return { success: false, error: 'El archivo CSV contiene números de serie duplicados.' };
            }
             // Check for duplicate serials against the database
            const existingSerials = await collection.find({ serial: { $in: serials } }).project({ serial: 1 }).toArray();
            if (existingSerials.length > 0) {
                const existingSerialList = existingSerials.map(s => s.serial).join(', ');
                return { success: false, error: `Los siguientes números de serie ya existen en la base de datos: ${existingSerialList}` };
            }
        }


        if (validatedItems.length === 0) {
            return { success: false, error: 'No hay elementos válidos para importar.' };
        }
        
        const itemsToInsert = validatedItems.map(item => ({
            ...item,
            createdAt: new Date(),
            updatedAt: new Date(),
        }));

        const result = await collection.insertMany(itemsToInsert as any[]);

        return { success: true, insertedCount: result.insertedCount };
    } catch (e) {
        console.error("Error in bulk save:", e);
        return { success: false, error: "Ocurrió un error en el servidor durante la carga masiva." };
    } finally {
        await client.close();
    }
}

export async function bulkUpdateInventoryItemsStatus(itemIds: string[], destination: string, status: 'entregado'): Promise<{ success: boolean, error?: string, modifiedCount?: number }> {
    if (!itemIds || itemIds.length === 0) {
        return { success: false, error: 'No se seleccionaron elementos.' };
    }
    
    const client = await getDbClient();
    try {
        await client.connect();
        const db = client.db("instacheck");
        const collection = db.collection("inventory");

        const objectIds = itemIds.map(id => new ObjectId(id));

        const result = await collection.updateMany(
            { _id: { $in: objectIds } },
            { $set: { destination, status, updatedAt: new Date() } }
        );

        return { success: true, modifiedCount: result.modifiedCount };

    } catch (e) {
        console.error("Error in bulk update:", e);
        return { success: false, error: "Ocurrió un error en el servidor durante la actualización masiva." };
    } finally {
        await client.close();
    }
}
