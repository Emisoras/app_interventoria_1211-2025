export interface Operator {
    _id: string; // From MongoDB
    id?: number; // Optional original ID
    name: string;
}

export const operatorsData: Omit<Operator, '_id'>[] = [
    { id: 1, name: 'Emtel' },
];
