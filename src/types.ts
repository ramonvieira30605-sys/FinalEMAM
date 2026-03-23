export type AssetStatus = 'Operacional' | 'Alerta' | 'Manutenção' | 'Crítico';
export type AssetType = 'Motor' | 'Inversor' | 'Soft-Starter' | 'Quadro' | 'Outro';

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
    p0219?: string;
    p0640?: string;
    p0110?: string;
  };
}

export interface Checklist {
  id: string;
  assetId: string;
  date: string;
  technician: string;
  items: {
    vibration: 'Normal' | 'Anormal';
    temperature: 'Normal' | 'Alta';
    noise: 'Normal' | 'Anormal';
    currentCheck: 'OK' | 'Desequilibrada';
    errorCodes: string;
    observations: string;
  };
}

export interface KnowledgeBaseDoc {
  id: string;
  name: string;
  content: string;
  uploadDate: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
