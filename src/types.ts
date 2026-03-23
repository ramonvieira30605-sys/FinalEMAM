export type AssetStatus = 'Operacional' | 'Alerta' | 'Manutenção' | 'Crítico';
export type AssetType = 'Motor' | 'Inversor' | 'Soft-Starter' | 'Quadro' | 'Compressor' | 'Outro';

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  model: string;
  serialNumber: string;
  location: string;
  status: AssetStatus;
  lastUpdated: string;
  createdAt: string;
  technicalParams?: {
    current?: string;
    rpm?: string;
    frequency?: string;
    power?: string;
    voltage?: string;
    serviceFactor?: string;
    connectedMotor?: string;
    p0101?: string;
    p0102?: string;
    p0104?: string;
    p0202?: string;
    p0220?: string;
    p0156?: string;
    p0110?: string;
  };
}

export interface Checklist {
  id: string;
  assetId: string;
  date: string;
  technician: string;
  items: {
    // Acionamentos (Inversor/Soft-Starter)
    p0003_current?: string; // Corrente de Saída (CFW500)
    p0004_link_dc?: string; // Tensão Link DC (CFW500)
    p006_status?: string;   // Status (SSW07)
    starting_current_peak?: string; // Corrente de Partida (SSW07)
    
    // Conjunto Motobomba / Motor
    discharge_pressure?: string; // Pressão de Descarga
    casing_temperature?: string; // Temperatura de Carcaça
    gland_drip?: string;         // Gotejamento Gaxeta
    mechanical_seal_leak?: string; // Selo Mecânico (Zero/Vazamento)
    
    // Compressores
    load_pressure?: string;   // Pressão de Carga
    unload_pressure?: string; // Pressão de Alívio
    unit_temperature?: string; // Temperatura Unidade
    condensate_drain_oil?: string; // Dreno de Condensado (Água/Óleo)
    
    // Quadros Elétricos
    phase_unbalance?: string; // Equilíbrio de Fases (V)
    terminal_temperature?: string; // Temperatura Bornes
    dps_status?: string; // Estado dos DPS
    
    observations: string;
  };
}

export interface KnowledgeBaseDoc {
  id: string;
  name: string;
  content: string;
  fileData?: string;
  uploadDate: string;
}
