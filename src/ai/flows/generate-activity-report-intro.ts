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
  return generateReportIntroFlow(input);
}


const prompt = ai.definePrompt({
  name: 'generateReportIntroPrompt',
  input: {schema: GenerateReportIntroInputSchema},
  output: {schema: GenerateReportIntroOutputSchema},
  prompt: `
    Eres un asistente de interventoría encargado de redactar informes profesionales.
    Tu tarea es generar una introducción o resumen para un informe de actividades diarias basado en una lista de tareas realizadas por un interventor.
    El tono debe ser formal, técnico y bien estructurado.

    Interventor: {{{inspectorName}}}

    Actividades Realizadas:
    {{#each activities}}
    - Fecha: {{date}}, Actividad: {{description}}
    {{/each}}

    Por favor, redacta un párrafo de introducción que resuma estas actividades de manera profesional.
    El resumen debe consolidar las actividades, contextualizarlas dentro del marco del proyecto de interventoría y presentarlas de forma clara y concisa.
    No enumeres las actividades una por una, sino que debes agruparlas y describirlas en un párrafo fluido.
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
