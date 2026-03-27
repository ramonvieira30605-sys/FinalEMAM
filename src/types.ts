export type AssetStatus = 'Operacional' | 'Alerta' | 'Manutenção' | 'Crítico';
export type AssetType = 'Motor' | 'Inversor' | 'Soft-Starter' | 'Quadro' | 'Compressor' | 'Bomba' | 'Outro';

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

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: 'C' | 'NC' | 'NA' | null;
  photo: string | null;
  ncDescription?: string;
}

export interface Checklist {
  id: string;
  assetId: string;
  date: string;
  technician: string;
  items: ChecklistItem[];
  observations: string;
}

export interface KnowledgeBaseDoc {
  id: string;
  name: string;
  content: string;
  fileData?: string;
  uploadDate: string;
}
