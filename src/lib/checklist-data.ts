export interface ChecklistItemData {
  id: string;
  title: string;
  description: string;
}

// These are now fallbacks or for initial seeding, the source of truth will be the database.

export const checklistInstitucionEducativaData: ChecklistItemData[] = [
  { id: '1', title: 'Departamento Correcto (Norte de Santander)', description: 'Verificar que el departamento corresponde a Norte de Santander.' },
  { id: '2', title: 'Municipio Correcto', description: 'Verificar que el municipio es el correcto según el alcance del proyecto.' },
  { id: '3', title: 'Código DANE Sede', description: 'Registrar el código DANE de la sede educativa.' },
  { id: '4', title: 'Dirección Sede Educativa', description: 'Registrar la dirección completa de la sede educativa.' },
  { id: '5', title: 'Zona Sede Educativa (Rural)', description: 'Confirmar si la zona de la sede educativa es Rural.' },
  { id: '6', title: 'Matrícula Total Reportada', description: 'Registrar el número total de estudiantes matriculados.' },
  { id: '7', title: 'Coordenadas Geográficas Formato Decimal', description: 'Tomar y registrar las coordenadas geográficas en formato decimal (latitud, longitud).' },
  { id: '8', title: 'Tipo de Institución (Oficial)', description: 'Confirmar que el tipo de institución es Oficial.' },
  { id: '9', title: 'Horario Académico', description: 'Registrar el horario académico de la institución.' },
  { id: '10', title: 'Nombre del Encargado Sede Educativa', description: 'Registrar el nombre completo del rector o encargado de la sede.' },
  { id: '11', title: 'Número Telefónico del Encargado', description: 'Registrar el número de contacto del encargado de la sede.' },
  { id: '12', title: '¿Actualmente Tiene Servicio de Internet?', description: 'Indicar si la sede cuenta con servicio de internet previo a la instalación.' },
  { id: '13', title: '¿Cuenta con Servicio Eléctrico Interconectado?', description: 'Verificar si la sede dispone de conexión a la red eléctrica nacional.' },
  { id: '14', title: '¿Se Adjunta Acta Compromiso Responsable Sede?', description: 'Confirmar si se adjunta el acta de compromiso firmada por el responsable de la sede.' },
  { id: '15', title: 'Registro Fotografico Fachada Intitución Educativa', description: 'Tomar fotografía de la fachada principal de la institución.' },
  { id: '16', title: 'Infraestructura Existente (postes, mástiles, etc.)', description: 'Documentar la infraestructura existente que pueda ser utilizada (postes, mástiles, etc.).' },
  { id: '17', title: 'Registro Fotografico Alrededores de la Intitución Educativa', description: 'Tomar fotografías de los alrededores para evaluar el entorno.' },
  { id: '18', title: 'Registro Fotografico Ubicación del Gabinete', description: 'Fotografiar la ubicación final del gabinete de equipos.' },
  { id: '19', title: 'Registro Fotografico Ubicación del Access Point Interior', description: 'Fotografiar la ubicación final de cada Access Point interior.' },
  { id: '20', title: 'Registro Fotografico Ubicación del Access Point Exterior', description: 'Fotografiar la ubicación final de cada Access Point exterior.' },
  { id: '21', title: 'Registro Fotografico Ubicación de Antena Satelital', description: 'Fotografiar la ubicación final de la antena satelital.' },
  { id: '22', title: 'Registro Fotografico Sistema de Puesta a Tierra', description: 'Fotografiar la instalación del sistema de puesta a tierra.' },
  { id: '23', title: 'Registro Fotografico Tablero Eléctrico', description: 'Fotografiar el tablero eléctrico desde donde se alimenta el sistema.' },
  { id: '24', title: 'Registro Fotografico Recorrido Cable Eléctrico a Gabinete', description: 'Fotografiar el trayecto del cableado eléctrico hacia el gabinete.' },
  { id: '25', title: 'Registro Fotografico Recorrido de Gabinete a los AP', description: 'Fotografiar el trayecto del cableado de red desde el gabinete a los Access Points.' },
  { id: '26', title: 'Diagrama de Red Incluido', description: 'Verificar que se incluye el diagrama de la red instalada.' },
  { id: '27', title: 'Observaciones de Instalación Documentadas', description: 'Registrar cualquier observación o novedad durante la instalación.' },
  { id: '28', title: 'Señales RF Interiores y Exteriores', description: 'Medir y registrar los niveles de señal de RF tanto en interiores como en exteriores.' },
  { id: '29', title: 'Simulación Cobertura', description: 'Adjuntar la simulación de cobertura de la red inalámbrica.' },
  { id: '30', title: 'KMZ Ubicación de APs Adjunto', description: 'Adjuntar el archivo KMZ con la ubicación de los Access Points.' },
  { id: '31', title: 'Altura Total del Mástil Especificada', description: 'Especificar la altura total del mástil utilizado para la antena.' },
  { id: '32', title: 'Especificaciones de APs Adjuntas', description: 'Adjuntar las fichas técnicas de los Access Points instalados.' },
  { id: '33', title: 'Especificaciones del Router Adjuntas', description: 'Adjuntar la ficha técnica del router instalado.' },
  { id: '34', title: 'Especificaciones de la UPS Adjuntas', description: 'Adjuntar la ficha técnica de la UPS instalada.' },
  { id: '35', title: 'Especificaciones del Servicio de Internet', description: 'Detallar las características del servicio de internet (ancho de banda, proveedor, etc.).' },
  { id: '36', title: 'Acta Autorización para Instalación de Servicio de Conectividad', description: 'Adjuntar el acta de autorización para la instalación firmada.' },
  { id: '37', title: 'Plano de Red', description: 'Adjuntar el plano final de la red (As-Built).' },
  { id: '38', title: 'BOM (materiales)', description: 'Adjuntar el listado de materiales (Bill of Materials) utilizados.' },
  { id: '39', title: 'Firma Responsable IE (acta compromiso)', description: 'Obtener la firma del responsable de la IE en el acta de compromiso.' },
];

export const checklistJuntaInternetData: ChecklistItemData[] = [
    { id: 'JI-1', title: 'Verificación de Ubicación', description: 'Confirmar que la ubicación de la junta corresponde a la planificada.' },
    { id: 'JI-2', title: 'Acta de Constitución de la Junta', description: 'Verificar la existencia y validez del acta de constitución de la junta de internet.' },
    { id: 'JI-3', title: 'Representante Legal', description: 'Registrar nombre completo y datos de contacto del representante legal de la junta.' },
    { id: 'JI-4', title: 'Coordenadas Geográficas', description: 'Tomar y registrar las coordenadas geográficas del punto de instalación.' },
    { id: 'JI-5', title: 'Acuerdo de Servicio', description: 'Confirmar que existe un acuerdo de servicio firmado con los beneficiarios.' },
    { id: 'JI-6', title: 'Infraestructura Física', description: 'Inspeccionar la adecuación del sitio (gabinete, protecciones, etc.).' },
    { id: 'JI-7', title: 'Instalación de Antena/Receptor', description: 'Verificar la correcta instalación y orientación de la antena receptora.' },
    { id: 'JI-8', title: 'Sistema de Puesta a Tierra', description: 'Comprobar que el sistema de puesta a tierra esté correctamente instalado y funcional.' },
    { id: 'JI-9', title: 'Fuente de Energía', description: 'Verificar la fuente de energía para los equipos (red eléctrica, panel solar, etc.).' },
    { id: 'JI-10', title: 'Registro Fotográfico General', description: 'Tomar fotografías de la instalación completa, incluyendo equipos y antenas.' },
    { id: 'JI-11', title: 'Configuración de Equipos de Red', description: 'Validar la configuración del router, switches y otros equipos de red.' },
    { id: 'JI-12', title: 'Instalación y Configuración de APs', description: 'Verificar la correcta instalación y configuración de los puntos de acceso (APs).' },
    { id: 'JI-13', title: 'Pruebas de Conectividad', description: 'Realizar pruebas de velocidad de carga y descarga.' },
    { id: 'JI-14', title: 'Pruebas de Cobertura WiFi', description: 'Medir la intensidad de la señal en diferentes puntos del área de cobertura.' },
    { id: 'JI-15', title: 'Seguridad de la Red', description: 'Confirmar que la red inalámbrica esté protegida con contraseña (WPA2/WPA3).' },
    { id: 'JI-16', title: 'Capacitación a la Junta', description: 'Verificar si se realizó la capacitación sobre la gestión y mantenimiento básico de la red.' },
    { id: 'JI-17', title: 'Entrega de Manuales', description: 'Confirmar la entrega de manuales de usuario y de operación.' },
    { id: 'JI-18', title: 'Acta de Entrega y Conformidad', description: 'Asegurar que el acta de entrega esté firmada por el representante de la junta.' },
    { id: 'JI-19', title: 'Inventario de Equipos Entregados', description: 'Anexar el inventario detallado de todos los equipos instalados.' },
    { id: 'JI-20', title: 'Observaciones Finales', description: 'Registrar cualquier observación, recomendación o problema pendiente.' },
];

export const checklistInstalacionInstitucionEducativaData: ChecklistItemData[] = [
    ...checklistInstitucionEducativaData
];


export const checklistInstalacionJuntaInternetData: ChecklistItemData[] = [
    ...checklistJuntaInternetData
];
