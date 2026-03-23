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
    p0100?: string;
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
    // Grandezas Elétricas de Entrada (QBT/Painel)
    v_l1_l2?: string; // Tensão L1-L2 (V)
    v_l2_l3?: string; // Tensão L2-L3 (V)
    v_l3_l1?: string; // Tensão L3-L1 (V)
    
    // Grandezas de Saída (Drive/Motor)
    i_u?: string; // Corrente Fase U (A)
    i_v?: string; // Corrente Fase V (A)
    i_w?: string; // Corrente Fase W (A)
    
    // Saúde do Drive (Parâmetros de Monitoramento)
    p0004_dc_link?: string; // Tensão Link DC (V)
    p0007_heatsink_temp?: string; // Temperatura Dissipador (°C)
    p0030_motor_temp?: string; // Temperatura Estimada Motor (°C)
    
    // Integridade Física e Preditiva
    insulation_resistance?: string; // Resistência de Isolamento (MΩ)
    ground_continuity?: string; // Continuidade de Aterramento (Ω)
    torque_status: 'OK' | 'Necessita Reaperto' | 'Crítico';
    capacitor_status: 'Normal' | 'Estufado' | 'Vazamento';
    fan_status: 'Operando' | 'Ruído' | 'Parado';
    
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
