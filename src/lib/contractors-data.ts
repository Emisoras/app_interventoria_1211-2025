export interface Contractor {
    _id: string; // From MongoDB
    id?: number; // Optional original ID
    name: string;
}

export const contractorsData: Omit<Contractor, '_id'>[] = [
    { id: 1, name: 'Emtel' },
];
