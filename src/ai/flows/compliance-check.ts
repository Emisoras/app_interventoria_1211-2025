// src/ai/flows/compliance-check.ts
'use server';
/**
 * @fileOverview A compliance check AI agent.
 *
 * - complianceCheck - A function that handles the compliance check process.
 * - ComplianceCheckInput - The input type for the complianceCheck function.
 * - ComplianceCheckOutput - The return type for the complianceCheck function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ComplianceCheckInputSchema = z.object({
  checklistName: z.string().describe('The name of the checklist being evaluated.'),
  checklistItems: z.array(
    z.object({
      itemNumber: z.number().describe('The item number in the checklist.'),
      itemDescription: z.string().describe('The description of the checklist item.'),
      observation: z.string().describe('Auditor observations for this item.'),
      photoDataUri: z
        .string()
        .optional()
        .describe(
          "A photo related to the checklist item, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    })
  ).describe('The checklist items with observations and photo data.'),
});
export type ComplianceCheckInput = z.infer<typeof ComplianceCheckInputSchema>;

const ComplianceCheckOutputSchema = z.object({
  itemsNeedingMoreEvidence: z.array(
    z.object({
      itemNumber: z.number().describe('The item number needing more evidence.'),
      reason: z.string().describe('The reason why more evidence is needed.'),
    })
  ).describe('A list of checklist items that need more evidence.'),
});
export type ComplianceCheckOutput = z.infer<typeof ComplianceCheckOutputSchema>;

export async function complianceCheck(input: ComplianceCheckInput): Promise<ComplianceCheckOutput> {
  return complianceCheckFlow(input);
}

const complianceCheckPrompt = ai.definePrompt({
  name: 'complianceCheckPrompt',
  input: {schema: ComplianceCheckInputSchema},
  output: {schema: ComplianceCheckOutputSchema},
  prompt: `You are an AI assistant that reviews checklist evaluations to ensure compliance.

  You are given a checklist with items, observations, and photo data URIs.
  Your task is to determine which items in the checklist need more photographic evidence to support the observations.

  Here is the checklist name: {{{checklistName}}}

  Here are the checklist items:
  {{#each checklistItems}}
  Item Number: {{itemNumber}}
  Description: {{itemDescription}}
  Observation: {{observation}}
  {{#if photoDataUri}}
  Photo: {{media url=photoDataUri}}
  {{else}}
  No photo provided.
  {{/if}}

  {{/each}}

  Based on the observations and available photo evidence, identify the checklist items that require more evidence.  Explain the reason that it requires more evidence.
  Only return the item numbers that need more evidence in the output.
  Do not assume compliance if there is no supporting evidence.
  `,
});

const complianceCheckFlow = ai.defineFlow(
  {
    name: 'complianceCheckFlow',
    inputSchema: ComplianceCheckInputSchema,
    outputSchema: ComplianceCheckOutputSchema,
  },
  async input => {
    const {output} = await complianceCheckPrompt(input);
    return output!;
  }
);
