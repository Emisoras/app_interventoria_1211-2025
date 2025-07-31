-- Tabla para almacenar los datos de los checklists de Interventoria

CREATE TABLE checklists (
    id SERIAL PRIMARY KEY,
    contractor_name VARCHAR(255),
    site VARCHAR(255),
    site_type VARCHAR(255),
    location VARCHAR(255),
    inspection_date DATE,
    inspector_name VARCHAR(255),
    items JSONB,
    signature TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
