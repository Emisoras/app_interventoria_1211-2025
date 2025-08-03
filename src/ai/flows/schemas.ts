import {z} from 'genkit';

const ActivitySchema = z.object({
  date: z.string().describe('The date of the activity.'),
  description: z.string().describe('The description of the activity.'),
});

export const GenerateReportIntroInputSchema = z.object({
  inspectorName: z.string().describe('The name of the inspector submitting the report.'),
  activities: z.array(ActivitySchema).describe('A list of daily activities.'),
});

export type GenerateReportIntroInput = z.infer<typeof GenerateReportIntroInputSchema>;

export const GenerateReportIntroOutputSchema = z.string().describe('A well-structured and detailed introduction for the report.');
export type GenerateReportIntroOutput = z.infer<typeof GenerateReportIntroOutputSchema>;
