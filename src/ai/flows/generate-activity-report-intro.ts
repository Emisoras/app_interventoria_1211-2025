'use server';
/**
 * @fileOverview A flow to generate an introduction for a daily activities report.
 *
 * - generateReportIntro - A function that calls the Genkit flow.
 */

import {ai} from '@/ai/genkit';
import type { GenerateReportIntroInput, GenerateReportIntroOutput } from './schemas';
import { GenerateReportIntroInputSchema, GenerateReportIntroOutputSchema } from './schemas';


export async function generateReportIntro(input: GenerateReportIntroInput): Promise<GenerateReportIntroOutput> {
  const result = await generateReportIntroFlow(input);
  return result.introduction;
}


const prompt = ai.definePrompt({
  name: 'generateReportIntroPrompt',
  input: {schema: GenerateReportIntroInputSchema},
  output: {schema: GenerateReportIntroOutputSchema},
  prompt: `
    Eres un asistente de interventoría experto, encargado de redactar informes profesionales para el proyecto "Implementación de Infraestructura Tecnológica para el Fortalecimiento de la Conectividad".
    Tu tarea es generar un párrafo de introducción que sirva como resumen ejecutivo para un informe de actividades diarias, basado en una lista de tareas realizadas por un interventor.

    **Instrucciones Clave:**
    1.  **Tono:** Formal, técnico y bien estructurado.
    2.  **No enumerar:** No listes las actividades una por una. En su lugar, agrúpalas conceptualmente (ej. "labores de verificación", "seguimiento a instalaciones", "revisión documental").
    3.  **Consolidar y Contextualizar:** Redacta un párrafo fluido que consolide las actividades, las contextualice dentro del marco del proyecto y las presente de forma clara y concisa.
    4.  **Mencionar al Interventor:** Integra el nombre del interventor de forma natural en la redacción.

    **Datos de Entrada:**
    -   **Interventor:** {{{inspectorName}}}
    -   **Actividades Realizadas:**
        {{#each activities}}
        - Fecha: {{date}}, Actividad: {{description}}
        {{/each}}

    **Ejemplo de Salida Deseada (dentro del campo 'introduction'):**
    "En el marco de la interventoría del Convenio Interadministrativo 1211-2025, el interventor {{{inspectorName}}} ha llevado a cabo una serie de actividades de seguimiento y control durante el periodo reportado. Las labores se centraron en la verificación en campo de los avances de instalación en diversas sedes, el acompañamiento en los estudios de viabilidad técnica y la correspondiente revisión documental para asegurar el cumplimiento de los hitos del proyecto. Estas acciones son fundamentales para garantizar la correcta ejecución de la infraestructura tecnológica y el fortalecimiento de la conectividad en la región."

    **Tu Tarea:**
    Basado en las **Actividades Realizadas** y siguiendo estrictamente las **Instrucciones Clave**, genera el párrafo de introducción para el informe y colócalo en el campo 'introduction' de la salida.
  `,
});

const generateReportIntroFlow = ai.defineFlow(
  {
    name: 'generateReportIntroFlow',
    inputSchema: GenerateReportIntroInputSchema,
    outputSchema: GenerateReportIntroOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
