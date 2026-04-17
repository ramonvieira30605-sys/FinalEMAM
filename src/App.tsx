/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';

// Error Boundary Component
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-black text-white p-6 text-center">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Ops! Algo deu errado.</h2>
          <p className="text-zinc-500 text-sm max-w-xs mb-8">
            Ocorreu um erro inesperado ao processar as informações do ativo. 
            Tente recarregar a página ou limpe os dados locais.
          </p>
          <div className="flex flex-col w-full gap-3">
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl active:scale-95 transition-all"
            >
              RECARREGAR APLICATIVO
            </button>
            <button 
              onClick={() => {
                if (confirm('Atenção: Isso excluirá todos os seus ativos e checklists salvos localmente. Deseja continuar?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
              className="w-full py-4 bg-zinc-900 text-zinc-500 font-bold rounded-2xl active:scale-95 transition-all border border-zinc-800"
            >
              LIMPAR TODOS OS DADOS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Plus, 
  Search, 
  QrCode, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Wrench, 
  XCircle,
  RefreshCw,
  Trash2,
  ChevronRight,
  Download,
  X,
  BookOpen,
  Zap,
  Activity,
  AlertTriangle,
  Database,
  Upload,
  ShieldCheck,
  Camera,
  ChevronLeft,
  MinusCircle,
  Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import { Asset, AssetStatus, AssetType, Checklist, ChecklistItem, KnowledgeBaseDoc } from './types';

// --- Constants ---

const ALL_CHECKLIST_ITEMS_TEMPLATE = [
  // 1. QGBT (QUADRO GERAL)
  { id: '1.1', type: 'Quadro' as AssetType, label: 'Portas fechadas e vedadas?', description: 'Verificar se as portas do QGBT estão devidamente fechadas e com vedação íntegra.' },
  { id: '1.2', type: 'Quadro' as AssetType, label: 'Sinais de aquecimento/cheiro?', description: 'Verificar se há odor característico de queima ou sinais de calor excessivo nos componentes.' },
  { id: '1.3', type: 'Quadro' as AssetType, label: 'Tensão entre Fases (R-S, S-T, T-R)', description: 'Medir tensão entre as fases. Ex: 380V ou 440V', requiresValue: true, referenceValue: '380V / 440V' },
  { id: '1.4', type: 'Quadro' as AssetType, label: 'Corrente Total de Carga (L1, L2, L3)', description: 'Medir corrente total por fase. Conforme projeto.', requiresValue: true, referenceValue: 'Ver Projeto' },
  { id: '1.5', type: 'Quadro' as AssetType, label: 'Temperatura Máx. (Termografia)', description: 'Temperatura das conexões (Máx. 65ºC).', requiresValue: true, referenceValue: '65ºC' },
  { id: '1.6', type: 'Quadro' as AssetType, label: 'FOTO DO BARRAMENTO/DISJUNTORES', description: '📸 ADICIONAR FOTO DO BARRAMENTO/DISJUNTORES (Registro visual obrigatório).' },

  // 2. SOFT STARTER SSW07 + MOTOR
  { id: '2.1', type: 'Soft-Starter' as AssetType, label: 'Display sem erros (E01, E04)?', description: 'Verificar se o display da Soft Starter não apresenta códigos de erro ativos.' },
  { id: '2.2', type: 'Soft-Starter' as AssetType, label: 'Corrente de Partida (Pico)', description: 'Medir corrente de pico na partida. (3x a 5x Nominal).', requiresValue: true, referenceValue: '3-5x Nom.' },
  { id: '2.3', type: 'Soft-Starter' as AssetType, label: 'Corrente em Regime (Bypass)', description: 'Medir corrente em regime. Deve ser igual à Nominal.', requiresValue: true, referenceValue: 'Nominal' },
  { id: '2.4', type: 'Soft-Starter' as AssetType, label: 'Cooler operando normalmente?', description: 'Verificar se o ventilador de arrefecimento está operando sem ruídos ou obstruções.' },
  { id: '2.5', type: 'Soft-Starter' as AssetType, label: 'FOTO DO DISPLAY LIGADO', description: '📸 ADICIONAR FOTO DO DISPLAY LIGADO (Registro visual obrigatório).' },

  // 3. INVERSOR DE FREQUÊNCIA + MOTOR
  { id: '3.1', type: 'Inversor' as AssetType, label: 'Corrente de Saída (Display)', description: 'Verificar corrente no display. Deve ser menor que a Nominal.', requiresValue: true, referenceValue: '< Inom' },
  { id: '3.2', type: 'Inversor' as AssetType, label: 'Frequência de Operação', description: 'Geralmente entre 0-60 Hz.', requiresValue: true, referenceValue: '0-60 Hz' },
  { id: '3.3', type: 'Inversor' as AssetType, label: 'Tensão de Barramento CC (Bus)', description: 'Verificar tensão no barramento CC. Conforme manual.', requiresValue: true, referenceValue: 'Vcc Man.' },
  { id: '3.4', type: 'Inversor' as AssetType, label: 'Dissipador de calor está limpo?', description: 'Verificar se as aletas do dissipador traseiro estão livres de poeira ou obstruções.' },
  { id: '3.5', type: 'Inversor' as AssetType, label: 'FOTO DOS BORNES/DISPLAY', description: '📸 ADICIONAR FOTO DOS BORNES/DISPLAY (Registro visual obrigatório).' },

  // 4. BOMBAS (PARTE ELÉTRICA)
  { id: '4.1', type: 'Bomba' as AssetType, label: 'Pressão de Recalque (Manômetro)', description: 'Conforme Curva da Bomba.', requiresValue: true, referenceValue: 'Curva Bomba' },
  { id: '4.2', type: 'Bomba' as AssetType, label: 'Pressão de Sucção', description: 'Evitar Cavitação.', requiresValue: true, referenceValue: '> 0 mca' },
  { id: '4.3', type: 'Bomba' as AssetType, label: 'Caixa de ligação vedada e seca?', description: 'Verificar se a caixa de bornes do motor da bomba está totalmente seca e vedada.' },
  { id: '4.4', type: 'Bomba' as AssetType, label: 'FOTO DA ENTRADA DE CABOS', description: '📸 ADICIONAR FOTO DA ENTRADA DE CABOS (PRENSA-CABOS) (Registro visual obrigatório).' },

  // 5. MOTORES
  { id: '5.1', type: 'Motor' as AssetType, label: 'Resistência de Isolação (Megômetro)', description: 'Desejável > 100 MΩ.', requiresValue: true, referenceValue: '> 100 MΩ' },
  { id: '5.2', type: 'Motor' as AssetType, label: 'Vibração (mm/s ou visual/auditivo)', description: 'Nível baixo/estável.', requiresValue: true, referenceValue: 'Baixo' },
  { id: '5.3', type: 'Motor' as AssetType, label: 'FOTO DA PLACA E CONEXÕES', description: '📸 ADICIONAR FOTO DA PLACA/CAIXA DE BORNES.' },
];

// Set PDF.js worker using a more robust method
try {
  const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
} catch (e) {
  console.error('Failed to set PDF.js worker', e);
}

// --- Components ---

const StatusBadge = ({ status }: { status: AssetStatus }) => {
  const colors = {
    'Operacional': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'Alerta': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    'Manutenção': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Crítico': 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const icons = {
    'Operacional': <CheckCircle2 size={12} />,
    'Alerta': <AlertCircle size={12} />,
    'Manutenção': <Wrench size={12} />,
    'Crítico': <XCircle size={12} />,
  };

  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${colors[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'guide' | 'knowledge' | 'reports'>('dashboard');
  const [viewingAssetDetail, setViewingAssetDetail] = useState<Asset | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isGuideInModalOpen, setIsGuideInModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AssetType>('Motor');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeBaseDoc | null>(null);
  const [viewMode, setViewMode] = useState<'original' | 'text'>('original');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [kbSearchTerm, setKbSearchTerm] = useState('');
  const [inventorySearchTerm, setInventorySearchTerm] = useState('');
  const [docSearchTerm, setDocSearchTerm] = useState('');
  const [checklistSummary, setChecklistSummary] = useState<string | null>(null);
  
  // New states for Reports
  const [reportTechnician, setReportTechnician] = useState('');
  const [reportType, setReportType] = useState<'ativos' | 'auditoria' | 'checklist_geral' | 'comparativo_semanal' | 'checklist_diario'>('ativos');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Checklist Wizard States
  const [currentChecklistStep, setCurrentChecklistStep] = useState(0);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [technicianName, setTechnicianName] = useState('');
  const [isChecklistStarted, setIsChecklistStarted] = useState(false);
  const [tempPhoto, setTempPhoto] = useState<string | null>(null);
  const [ncDescription, setNcDescription] = useState('');
  const [measuredValue, setMeasuredValue] = useState('');

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => 
      asset.name.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
      asset.model.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
      asset.serialNumber.toLowerCase().includes(inventorySearchTerm.toLowerCase()) ||
      asset.location.toLowerCase().includes(inventorySearchTerm.toLowerCase())
    );
  }, [assets, inventorySearchTerm]);

  const filteredKB = useMemo(() => {
    return knowledgeBase.filter(doc => 
      doc.name.toLowerCase().includes(kbSearchTerm.toLowerCase()) ||
      doc.content.toLowerCase().includes(kbSearchTerm.toLowerCase())
    );
  }, [knowledgeBase, kbSearchTerm]);

  const highlightText = (text: string, search: string) => {
    if (!search.trim()) return text;
    const parts = text.split(new RegExp(`(${search})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === search.toLowerCase() ? (
            <mark key={i} className="bg-emerald-500 text-black rounded-sm px-0.5">{part}</mark>
          ) : part
        )}
      </>
    );
  };

  // Reset asset detail view on tab change
  useEffect(() => {
    setViewingAssetDetail(null);
  }, [activeTab]);

  // Load from LocalStorage
  useEffect(() => {
    const migrateData = (data: any) => {
      if (data && Array.isArray(data)) {
        return data.map((c: any) => {
          if (c.items && !Array.isArray(c.items)) {
            const migratedItems: ChecklistItem[] = Object.keys(c.items)
              .filter(k => k !== 'observations')
              .map(key => ({
                id: key,
                label: key,
                description: '',
                status: (c.items[key] === 'OK' || (typeof c.items[key] === 'string' && c.items[key].includes('OK'))) ? 'C' : 'NC',
                photo: null,
              }));
            return {
              ...c,
              observations: c.items.observations || '',
              items: migratedItems
            };
          }
          return c;
        });
      }
      return data || [];
    };

    const loadInitialData = () => {
      try {
        const savedAssets = localStorage.getItem('emam_assets');
        if (savedAssets) setAssets(JSON.parse(savedAssets));
        
        const savedChecklists = localStorage.getItem('emam_checklists');
        if (savedChecklists) {
          const parsed = JSON.parse(savedChecklists);
          setChecklists(migrateData(parsed));
        }
        
        const savedKnowledge = localStorage.getItem('emam_knowledge');
        if (savedKnowledge) setKnowledgeBase(JSON.parse(savedKnowledge));
      } catch (e) {
        console.error('Failed to parse local storage', e);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadInitialData();
  }, []);

  // Auto-sync to LocalStorage only
  useEffect(() => {
    localStorage.setItem('emam_assets', JSON.stringify(assets));
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('emam_checklists', JSON.stringify(checklists));
  }, [checklists]);

  useEffect(() => {
    localStorage.setItem('emam_knowledge', JSON.stringify(knowledgeBase));
  }, [knowledgeBase]);

  const stats = useMemo(() => ({
    total: assets.length,
    operational: assets.filter(a => a.status === 'Operacional').length,
    alerts: assets.filter(a => a.status !== 'Operacional').length,
  }), [assets]);

  const generatePDF = (checklist: Checklist, asset: Asset) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text('RELATÓRIO DE CHECKLIST DIÁRIO', 105, 25, { align: 'center' });
    
    // Asset Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.text('INFORMAÇÕES DO ATIVO', 14, 55);
    doc.setFontSize(10);
    
    const assetData = [
      ['Ativo:', asset.name],
      ['Tipo:', asset.type],
      ['Modelo:', asset.model],
      ['Nº de Série:', asset.serialNumber],
      ['Localização:', asset.location],
      ['Motor Conectado:', asset.technicalParams?.connectedMotor || 'N/A']
    ];
    
    (doc as any).autoTable({
      startY: 60,
      body: assetData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
    });

    // Checklist Info
    const startYChecklist = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.text('RESULTADOS DO CHECKLIST', 14, startYChecklist);
    
    const checklistData = [
      ['Data/Hora:', new Date(checklist.date).toLocaleString('pt-BR')],
      ['Técnico Responsável:', checklist.technician],
    ];

    const counts = checklist.items.reduce((acc, item) => {
      if (item.status === 'C') acc.c++;
      else if (item.status === 'NC') acc.nc++;
      else if (item.status === 'NA') acc.na++;
      return acc;
    }, { c: 0, nc: 0, na: 0 });

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('Resumo de Conformidade:', 14, startYChecklist + 10);
    doc.setFontSize(9);
    doc.text(`Conforme: ${counts.c} | Não Conforme: ${counts.nc} | N/A: ${counts.na}`, 14, startYChecklist + 15);

    (doc as any).autoTable({
      startY: startYChecklist + 20,
      body: checklistData,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
    });

    const itemsData = checklist.items.map((item: ChecklistItem) => [
      item.label,
      item.status === 'C' ? 'CONFORME' : item.status === 'NC' ? '[!] NÃO CONFORME' : 'N/A',
      item.measuredValue ? `${item.measuredValue} / ${item.referenceValue}` : '-',
      item.ncDescription || '-'
    ]);

    (doc as any).autoTable({
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Item', 'Status', 'Valor / Ref.', 'Observação']],
      body: itemsData,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 9 },
      didParseCell: (data) => {
        if (data.row.section === 'body' && data.column.index === 1) {
          const val = data.cell.raw as string;
          if (val && val.includes('NÃO CONFORME')) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });

    // Photos
    let yPos = (doc as any).lastAutoTable.finalY + 15;
    checklist.items.forEach((item) => {
      if (item.photo) {
        if (yPos > 240) {
          doc.addPage();
          yPos = 20;
        }
        doc.setFontSize(8);
        doc.text(`Foto Item: ${item.label}`, 14, yPos);
        try {
          if (item.photo.startsWith('data:image')) {
            doc.addImage(item.photo, 'JPEG', 14, yPos + 5, 60, 45);
            yPos += 60;
          }
        } catch (e) {
          console.error('Error adding image to PDF', e);
          yPos += 10;
        }
      }
    });

    // Technical Params (if any)
    if (asset.technicalParams) {
      const startYParams = yPos + 10 > 240 ? (doc.addPage(), 20) : yPos + 10;
      doc.setFontSize(14);
      doc.text('PARÂMETROS TÉCNICOS CONFIGURADOS', 14, startYParams);
      
      const paramsData = asset.type === 'Inversor' ? [
        ['Corrente (P0401):', asset.technicalParams.current || '-'],
        ['RPM (P0402):', asset.technicalParams.rpm || '-'],
        ['Freq (P0403):', asset.technicalParams.frequency || '-'],
        ['Potência (P0404):', asset.technicalParams.power || '-'],
        ['Tensão (P0400):', asset.technicalParams.voltage || '-'],
        ['Fator Serviço (P0406):', asset.technicalParams.serviceFactor || '-'],
        ['Tempo Acel (P0100):', asset.technicalParams.p0100 || '-'],
        ['Tempo Desacel (P0101):', asset.technicalParams.p0101 || '-'],
        ['Tipo Controle (P0202):', asset.technicalParams.p0202 || '-'],
        ['Seleção L/R (P0220):', asset.technicalParams.p0220 || '-'],
        ['Corrente Sobrecarga (P0156):', asset.technicalParams.p0156 || '-']
      ] : [
        ['Corrente (P0401):', asset.technicalParams.current || '-'],
        ['RPM (P0402):', asset.technicalParams.rpm || '-'],
        ['Freq (P0403):', asset.technicalParams.frequency || '-'],
        ['Potência (P0404):', asset.technicalParams.power || '-'],
        ['Tensão (P0400):', asset.technicalParams.voltage || '-'],
        ['Fator Serviço (P0406):', asset.technicalParams.serviceFactor || '-'],
        ['Tensão Inicial (P0101):', asset.technicalParams.p0101 || '-'],
        ['Tempo Acel (P0102):', asset.technicalParams.p0102 || '-'],
        ['Tempo Desacel (P0104):', asset.technicalParams.p0104 || '-'],
        ['Tipo Partida (P0202):', asset.technicalParams.p0202 || '-'],
        ['Limite Corrente (P0110):', asset.technicalParams.p0110 || '-']
      ];

      (doc as any).autoTable({
        startY: startYParams + 5,
        body: paramsData,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold' } }
      });
    }

    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Relatório Gerado por EMAM/ELT - GESTÃO WEG - ${new Date().toLocaleString('pt-BR')}`,
        105,
        285,
        { align: 'center' }
      );
    }

    doc.save(`checklist-${asset.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        if (file.type !== 'application/pdf') continue;
        const [content, fileData] = await Promise.all([
          extractTextFromPDF(file),
          readFileAsDataURL(file)
        ]);
        const newDoc: KnowledgeBaseDoc = {
          id: crypto.randomUUID(),
          name: file.name,
          content: content,
          fileData: fileData,
          uploadDate: new Date().toISOString(),
        };
        setKnowledgeBase(prev => [newDoc, ...prev]);
      }
    } catch (error) {
      console.error('Error uploading PDF:', error);
      alert('Erro ao processar o PDF. Verifique se o arquivo não está protegido por senha.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeDoc = (id: string) => {
    setKnowledgeBase(prev => prev.filter(doc => doc.id !== id));
  };

  // Save to LocalStorage whenever data changes
  useEffect(() => {
    if (!isLoadingData) {
      localStorage.setItem('emam_assets', JSON.stringify(assets));
      localStorage.setItem('emam_checklists', JSON.stringify(checklists));
      localStorage.setItem('emam_knowledge', JSON.stringify(knowledgeBase));
    }
  }, [assets, checklists, knowledgeBase, isLoadingData]);

  const exportData = () => {
    const data = {
      assets,
      checklists,
      knowledgeBase,
      exportDate: new Date().toISOString(),
      version: '4.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EMAM_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.assets && data.checklists) {
          if (confirm('Isso irá substituir seus dados atuais pelos dados do arquivo. Deseja continuar?')) {
            // Migration logic for checklists in imported data
            const migratedChecklists = data.checklists.map((c: any) => {
              if (c.items && !Array.isArray(c.items)) {
                return {
                  ...c,
                  observations: c.items.observations || '',
                  items: Object.keys(c.items).filter(k => k !== 'observations').map(key => ({
                    id: key,
                    label: key,
                    description: '',
                    status: (c.items[key] === 'OK' || (typeof c.items[key] === 'string' && c.items[key].includes('OK'))) ? 'C' : 'NC',
                    photo: null
                  }))
                };
              }
              return c;
            });

            setAssets(data.assets);
            setChecklists(migratedChecklists);
            if (data.knowledgeBase) setKnowledgeBase(data.knowledgeBase);
            alert('Dados importados com sucesso!');
          }
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleAddAsset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newAsset: Asset = {
      id: crypto.randomUUID(),
      name: formData.get('name') as string,
      type: formData.get('type') as AssetType,
      model: formData.get('model') as string,
      serialNumber: (formData.get('serialNumber') as string) || 'N/A',
      location: formData.get('location') as string,
      status: formData.get('status') as AssetStatus,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      technicalParams: {
        current: formData.get('current') as string,
        rpm: formData.get('rpm') as string,
        frequency: formData.get('frequency') as string,
        power: formData.get('power') as string,
        voltage: formData.get('voltage') as string,
        serviceFactor: formData.get('serviceFactor') as string,
        connectedMotor: formData.get('connectedMotor') as string,
        p0100: formData.get('p0100') as string,
        p0101: formData.get('p0101') as string,
        p0102: formData.get('p0102') as string,
        p0104: formData.get('p0104') as string,
        p0202: formData.get('p0202') as string,
        p0220: formData.get('p0220') as string,
        p0156: formData.get('p0156') as string,
        p0110: formData.get('p0110') as string,
      }
    };
    setAssets(prev => [newAsset, ...prev]);
    setIsModalOpen(false);
  };

  const handleDeleteAsset = (id: string) => {
    if (confirm('Deseja realmente excluir este ativo?')) {
      setAssets(prev => prev.filter(a => a.id !== id));
      if (selectedAsset?.id === id) setSelectedAsset(null);
    }
  };

  const startChecklist = (assetOverride?: Asset) => {
    const asset = assetOverride || selectedAsset;
    if (!asset) return;
    
    const items = ALL_CHECKLIST_ITEMS_TEMPLATE
      .filter(item => item.type === asset.type)
      .map(item => ({
        ...item,
        status: null as 'C' | 'NC' | 'NA' | null,
        photo: null as string | null,
        ncDescription: '',
        measuredValue: ''
      }));
    
    if (items.length === 0) {
      setChecklistItems([{
        id: 'gen-1',
        label: 'Estado Geral do Ativo',
        description: 'Verificação visual completa. ANEXAR FOTO.',
        status: null,
        photo: null
      }]);
    } else {
      setChecklistItems(items);
    }
    
    setCurrentChecklistStep(0);
    setIsChecklistStarted(true);
    setTempPhoto(null);
    setNcDescription('');
    setMeasuredValue('');
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress quality to 70% to save space
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          setTempPhoto(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChecklistStep = (status: 'C' | 'NC' | 'NA') => {
    const currentItem = checklistItems[currentChecklistStep];
    const isPhotoItem = currentItem.label.toUpperCase().includes('FOTO') || 
                        currentItem.description.includes('📸');
    const isPhotoMandatory = status === 'NC' || isPhotoItem;

    if (isPhotoMandatory && !tempPhoto) {
      alert('Este item exige uma foto como registro obrigatório.');
      return;
    }

    const updatedItems = [...checklistItems];
    updatedItems[currentChecklistStep] = {
      ...updatedItems[currentChecklistStep],
      status,
      photo: tempPhoto,
      ncDescription: status === 'NC' ? ncDescription : '',
      measuredValue: currentItem.requiresValue ? measuredValue : undefined
    };
    setChecklistItems(updatedItems);
    
    if (currentChecklistStep < checklistItems.length - 1) {
      setCurrentChecklistStep(prev => prev + 1);
      setTempPhoto(null);
      setNcDescription('');
      setMeasuredValue('');
    } else {
      finishChecklist(updatedItems);
    }
  };

  const finishChecklist = (finalItems: ChecklistItem[]) => {
    if (!selectedAsset) return;
    
    const newChecklist: Checklist = {
      id: crypto.randomUUID(),
      assetId: selectedAsset.id,
      date: new Date().toISOString(),
      technician: technicianName,
      items: finalItems,
      observations: ''
    };

    // Generate summary for copying
    let summary = `--- 📋 RESUMO DE INSPEÇÃO DIÁRIA ---\n`;
    summary += `DATA: ${new Date().toLocaleDateString('pt-BR')}\n`;
    summary += `TÉCNICO: ${technicianName}\n`;
    summary += `EQUIPAMENTO: ${selectedAsset.name} (${selectedAsset.type})\n\n`;

    finalItems.forEach(item => {
      const statusText = item.status === 'C' ? 'SIM' : item.status === 'NC' ? 'NÃO [CRÍTICO]' : 'N/A';
      summary += `[${statusText}] ${item.label}\n`;
      if (item.measuredValue) {
        summary += `   VALOR: ${item.measuredValue} (REF: ${item.referenceValue || '-'})\n`;
      }
      if (item.ncDescription) {
        summary += `   OBS: ${item.ncDescription}\n`;
      }
    });
    summary += `\n--- FIM DO RELATÓRIO ---`;

    setChecklistSummary(summary);
    setChecklists(prev => [newChecklist, ...prev]);
    setIsChecklistStarted(false);
  };

  const exportPDF = (asset: Asset) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Relatório Técnico de Ativo WEG', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 30);

    autoTable(doc, {
      startY: 40,
      head: [['Campo', 'Valor']],
      body: [
        ['Nome', asset.name],
        ['Tipo', asset.type],
        ['Modelo', asset.model],
        ['Nº de Série', asset.serialNumber],
        ['Localização', asset.location],
        ['Status Atual', asset.status],
        ['ID do Sistema', asset.id],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
    });

    // Add recent checklist if available
    const lastChecklist = checklists.find(c => c.assetId === asset.id);
    if (lastChecklist) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Último Checklist Diário', 14, 22);
      doc.setFontSize(10);
      doc.text(`Data: ${new Date(lastChecklist.date).toLocaleString()}`, 14, 30);
      doc.text(`Técnico: ${lastChecklist.technician}`, 14, 35);

      const counts = lastChecklist.items.reduce((acc, item) => {
        if (item.status === 'C') acc.c++;
        else if (item.status === 'NC') acc.nc++;
        else if (item.status === 'NA') acc.na++;
        return acc;
      }, { c: 0, nc: 0, na: 0 });

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Resumo de Conformidade:', 14, 45);
      doc.setFontSize(9);
      doc.text(`Conforme: ${counts.c} | Não Conforme: ${counts.nc} | N/A: ${counts.na}`, 14, 50);

      autoTable(doc, {
        startY: 55,
        head: [['Item', 'Status', 'Observação']],
        body: lastChecklist.items.map(i => [
          i.label,
          i.status === 'C' ? 'CONFORME' : i.status === 'NC' ? '[!] NÃO CONFORME' : 'N/A',
          i.ncDescription || '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        didParseCell: (data) => {
          if (data.row.section === 'body' && data.column.index === 1) {
            const val = data.cell.raw as string;
            if (val && val.includes('NÃO CONFORME')) {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
      
      let yPos = (doc as any).lastAutoTable.finalY + 20;
      lastChecklist.items.forEach((item) => {
        if (item.photo) {
          if (yPos > 240) {
            doc.addPage();
            yPos = 20;
          }
          doc.setFontSize(8);
          doc.text(`Foto Item ${item.id}: ${item.label}`, 14, yPos);
          try {
            // Check if it's a valid data URL
            if (item.photo.startsWith('data:image')) {
              doc.addImage(item.photo, 'JPEG', 14, yPos + 5, 60, 45);
              yPos += 60;
            }
          } catch (e) {
            console.error('Error adding image to PDF', e);
            yPos += 10;
          }
        }
      });
    }

    doc.save(`EMAM_Relatorio_${asset.serialNumber}.pdf`);
  };

  const generateGeneralReport = () => {
    if (!reportTechnician.trim()) {
      alert('Por favor, informe o nome do responsável técnico.');
      return;
    }

    setIsGeneratingReport(true);
    const doc = new jsPDF();
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    
    // Header
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('EMAM/ELT - GESTÃO WEG', 14, 25);
    doc.setFontSize(10);
    doc.text(`RELATÓRIO: ${reportType.toUpperCase()}`, 14, 35);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Responsável Técnico: ${reportTechnician}`, 14, 50);
    doc.text(`Data de Emissão: ${dateStr} ${now.toLocaleTimeString('pt-BR')}`, 14, 55);

    if (reportType === 'ativos') {
      autoTable(doc, {
        startY: 65,
        head: [['Nome', 'Tipo', 'Modelo', 'Série', 'Local', 'Status']],
        body: assets.map(a => [a.name, a.type, a.model, a.serialNumber, a.location, a.status]),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
      });
    } else if (reportType === 'checklist_diario') {
      const today = new Date().toLocaleDateString('pt-BR');
      const todaysChecklists = checklists.filter(c => new Date(c.date).toLocaleDateString('pt-BR') === today);

      if (todaysChecklists.length === 0) {
        alert('Nenhum checklist foi realizado hoje para compor o relatório consolidado.');
        setIsGeneratingReport(false);
        return;
      }

      doc.setFontSize(14);
      doc.text('Relatório Técnico Consolidado Diário', 14, 70);
      doc.setFontSize(10);
      doc.text(`Total de Inspeções: ${todaysChecklists.length}`, 14, 78);

      let currentY = 85;

      todaysChecklists.forEach((c, index) => {
        const asset = assets.find(a => a.id === c.assetId);
        
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFillColor(244, 244, 245);
        doc.rect(14, currentY, 182, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`${index + 1}. ATIVO: ${asset?.name || 'Desconhecido'} (${asset?.type || '-'})`, 16, currentY + 6);
        doc.setFont('helvetica', 'normal');
        
        currentY += 12;

        autoTable(doc, {
          startY: currentY,
          head: [['Item', 'Status', 'Valor / Ref.', 'Observação']],
          body: c.items.map(i => [
            i.label,
            i.status === 'C' ? 'CONFORME' : i.status === 'NC' ? '[!] NÃO CONFORME' : 'N/A',
            i.measuredValue ? `${i.measuredValue} / ${i.referenceValue}` : '-',
            i.ncDescription || '-'
          ]),
          theme: 'grid',
          headStyles: { fillColor: [63, 63, 70] },
          styles: { fontSize: 8 },
          didParseCell: (data) => {
            if (data.row.section === 'body' && data.column.index === 1) {
              const val = data.cell.raw as string;
              if (val && val.includes('NÃO CONFORME')) {
                data.cell.styles.textColor = [220, 38, 38];
              }
            }
          }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      });
    } else if (reportType === 'checklist_geral') {
      const allItems = checklists.flatMap(c => c.items as ChecklistItem[]);
      const totalCounts = allItems.reduce((acc, item) => {
        if (item.status === 'C') acc.c++;
        else if (item.status === 'NC') acc.nc++;
        else if (item.status === 'NA') acc.na++;
        return acc;
      }, { c: 0, nc: 0, na: 0 });

      doc.setFontSize(12);
      doc.text('Resumo de Conformidade Geral:', 14, 70);
      doc.setFontSize(10);
      doc.text(`Total Conforme: ${totalCounts.c} | Total Não Conforme: ${totalCounts.nc} | Total N/A: ${totalCounts.na}`, 14, 78);

      autoTable(doc, {
        startY: 85,
        head: [['Data', 'Ativo', 'Técnico', 'Status dos Itens']],
        body: checklists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(c => {
          const asset = assets.find(a => a.id === c.assetId);
          const items = c.items as ChecklistItem[];
          const statusSummary = items.map(i => `${i.id}: ${i.status === 'NC' ? '[!] ' : ''}${i.status}`).join(' | ');
          
          return [
            new Date(c.date).toLocaleDateString('pt-BR'),
            asset?.name || 'N/A',
            c.technician,
            statusSummary
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
        didParseCell: (data) => {
          if (data.row.section === 'body' && data.column.index === 3) {
            const val = data.cell.raw as string;
            if (val && val.includes('[!]')) {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        }
      });
    } else if (reportType === 'comparativo_semanal') {
      // Logic for weekly comparison
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const recentChecklists = checklists.filter(c => new Date(c.date) >= oneWeekAgo);
      const oldChecklists = checklists.filter(c => new Date(c.date) < oneWeekAgo);

      doc.setFontSize(14);
      doc.text('Análise de Tendência Semanal', 14, 70);
      doc.setFontSize(10);
      doc.text(`Período: ${oneWeekAgo.toLocaleDateString('pt-BR')} até ${dateStr}`, 14, 78);

      const comparisonData = assets.map(asset => {
        const recent = recentChecklists.filter(c => c.assetId === asset.id);
        const old = oldChecklists.filter(c => c.assetId === asset.id);
        
        const recentAlerts = recent.filter(c => {
          return c.items.some(i => i.status === 'NC');
        }).length;

        const oldAlerts = old.filter(c => {
          return c.items.some(i => i.status === 'NC');
        }).length;

        let trend = 'Estável';
        if (recentAlerts > oldAlerts) trend = 'Piora';
        if (recentAlerts < oldAlerts && oldAlerts > 0) trend = 'Melhora';

        return [asset.name, asset.status, oldAlerts, recentAlerts, trend];
      });

      autoTable(doc, {
        startY: 85,
        head: [['Ativo', 'Status Atual', 'Alertas (Sem. Ant.)', 'Alertas (Esta Sem.)', 'Tendência']],
        body: comparisonData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
      });
    } else if (reportType === 'auditoria') {
      doc.setFontSize(12);
      doc.text('Resumo de Auditoria de Sistema', 14, 70);
      
      const allItems = checklists.flatMap(c => c.items as ChecklistItem[]);
      const totalCounts = allItems.reduce((acc, item) => {
        if (item.status === 'C') acc.c++;
        else if (item.status === 'NC') acc.nc++;
        else if (item.status === 'NA') acc.na++;
        return acc;
      }, { c: 0, nc: 0, na: 0 });

      const stats = {
        totalAssets: assets.length,
        totalChecklists: checklists.length,
        criticalAssets: assets.filter(a => a.status === 'Crítico').length,
        docsInKb: knowledgeBase.length,
      };

      autoTable(doc, {
        startY: 80,
        head: [['Métrica', 'Valor']],
        body: [
          ['Total de Ativos Cadastrados', stats.totalAssets],
          ['Total de Checklists Realizados', stats.totalChecklists],
          ['Ativos em Estado Crítico', stats.criticalAssets],
          ['Total de Itens Conformes', totalCounts.c],
          ['Total de Itens Não Conformes', totalCounts.nc],
          ['Total de Itens N/A', totalCounts.na],
          ['Documentos na Base de Conhecimento', stats.docsInKb],
          ['Modo de Operação', 'Local/Offline (Backup Manual)'],
        ],
        theme: 'grid',
      });
    }

    doc.save(`EMAM_Relatorio_${reportType}_${dateStr.replace(/\//g, '-')}.pdf`);
    setIsGeneratingReport(false);
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col h-screen max-w-md mx-auto bg-black items-center justify-center p-6 text-center">
        <div className="relative mb-8">
          <div className="w-24 h-24 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="text-2xl font-black text-emerald-500">V4</h1>
          </div>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">EMAM/ELT</h2>
        <p className="text-zinc-500 text-sm">Carregando dados locais...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-black overflow-hidden relative">
      
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-zinc-900">
        <div>
          <h1 className="text-2xl font-bold tracking-tighter text-white">EMAM<span className="text-emerald-500">/ELT</span></h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Manutenção Elétrica</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
        <AnimatePresence mode="wait">
          
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="dark-card emerald-glow">
                  <p className="text-zinc-500 text-xs font-medium">Total de Ativos</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.total}</h3>
                </div>
                <div className="dark-card border-emerald-500/30">
                  <p className="text-zinc-500 text-xs font-medium">Operacionais</p>
                  <h3 className="text-3xl font-bold mt-1 text-emerald-500">{stats.operational}</h3>
                </div>
              </div>

              <div className="dark-card bg-zinc-900/50 border-zinc-800 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-zinc-800">
                    <Database className="text-emerald-500" size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Backup & Transferência</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Gestão de Dados Offline</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={exportData}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    EXPORTAR
                  </button>
                  <label className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Upload size={14} />
                    IMPORTAR
                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                  </label>
                </div>
              </div>

              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Plus size={20} />
                ADICIONAR ATIVO WEG
              </button>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Atividades Recentes</h4>
                {assets.slice(0, 3).map(asset => (
                  <div key={asset.id} className="dark-card flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{asset.name}</p>
                      <p className="text-[10px] text-zinc-500">{asset.location}</p>
                    </div>
                    <StatusBadge status={asset.status} />
                  </div>
                ))}
                {assets.length === 0 && (
                  <p className="text-center py-8 text-zinc-600 text-sm italic">Nenhum ativo cadastrado ainda.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Asset Details View */}
          {activeTab === 'inventory' && viewingAssetDetail && (
            <motion.div
              key="asset-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-8"
            >
              {/* Back Button */}
              <button 
                onClick={() => setViewingAssetDetail(null)}
                className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
              >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold uppercase tracking-widest">Voltar ao Inventário</span>
              </button>

              {/* Asset Header Card */}
              <div className="dark-card border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Package size={80} />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mb-1">{viewingAssetDetail.type}</p>
                      <h2 className="text-2xl font-black text-white leading-tight">{viewingAssetDetail.name}</h2>
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                        <Search size={12} /> {viewingAssetDetail.location}
                      </p>
                    </div>
                    <StatusBadge status={viewingAssetDetail.status} />
                  </div>
                  
                  <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/50">
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Nº de Série</p>
                      <p className="text-xs font-mono text-white">{viewingAssetDetail.serialNumber}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest">Modelo</p>
                      <p className="text-xs text-white">{viewingAssetDetail.model}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="dark-card flex items-center gap-6 bg-white/5 border-zinc-800">
                <div className="p-2 bg-white rounded-xl">
                  <QRCodeSVG value={viewingAssetDetail.id} size={80} />
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-tight">Identificação Digital</h4>
                  <p className="text-[10px] text-zinc-500 leading-tight">Escaneie este código para acesso rápido aos parâmetros técnicos em campo.</p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(viewingAssetDetail.id);
                      alert('ID do Ativo copiado!');
                    }}
                    className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 hover:underline"
                  >
                    <Copy size={10} /> COPIAR ID
                  </button>
                </div>
              </div>

              {/* Technical Parameters */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Zap size={14} className="text-emerald-500" />
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Parâmetros Técnicos (WEG)</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Corrente (A)', value: viewingAssetDetail.technicalParams?.current },
                    { label: 'RPM', value: viewingAssetDetail.technicalParams?.rpm },
                    { label: 'Frequência (Hz)', value: viewingAssetDetail.technicalParams?.frequency },
                    { label: 'Potência (kW/cv)', value: viewingAssetDetail.technicalParams?.power },
                    { label: 'Tensão (V)', value: viewingAssetDetail.technicalParams?.voltage },
                    { label: 'Fator de Serviço', value: viewingAssetDetail.technicalParams?.serviceFactor },
                    { label: 'Motor Conectado', value: viewingAssetDetail.technicalParams?.connectedMotor },
                    { label: 'P0100 (Acel.)', value: viewingAssetDetail.technicalParams?.p0100 },
                    { label: 'P0101 (Desac.)', value: viewingAssetDetail.technicalParams?.p0101 },
                    { label: 'P0102 (V/f)', value: viewingAssetDetail.technicalParams?.p0102 },
                  ].map((param, idx) => (
                    <div key={idx} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                      <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mb-1">{param.label}</p>
                      <p className="text-sm font-bold text-white">{param.value || '---'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Maintenance History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-emerald-500" />
                    <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Histórico de Manutenção</h4>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full">
                    {checklists.filter(c => c.assetId === viewingAssetDetail.id).length} Registros
                  </span>
                </div>
                
                <div className="space-y-2">
                  {checklists
                    .filter(c => c.assetId === viewingAssetDetail.id)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(c => {
                      const hasNC = c.items.some(i => i.status === 'NC');
                      return (
                        <div key={c.id} className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl flex justify-between items-center group hover:border-zinc-700 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">
                                {new Date(c.date).toLocaleDateString('pt-BR')}
                              </span>
                              {hasNC && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-bold rounded-full border border-red-500/20 animate-pulse">
                                  <AlertTriangle size={8} /> NC DETECTADO
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500">
                              Técnico: {c.technician} • {new Date(c.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button 
                            onClick={() => generatePDF(c, viewingAssetDetail)}
                            className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-all active:scale-90"
                            title="Baixar Relatório"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      );
                    })}
                  {checklists.filter(c => c.assetId === viewingAssetDetail.id).length === 0 && (
                    <div className="p-8 text-center border border-dashed border-zinc-800 rounded-2xl">
                      <p className="text-xs text-zinc-600 italic">Nenhum checklist realizado para este ativo.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button 
                  onClick={() => {
                    setSelectedAsset(viewingAssetDetail);
                    startChecklist(viewingAssetDetail);
                  }}
                  className="py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Plus size={18} />
                  NOVA INSPEÇÃO
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Deseja realmente excluir este ativo e todo seu histórico?')) {
                      setAssets(prev => prev.filter(a => a.id !== viewingAssetDetail.id));
                      setChecklists(prev => prev.filter(c => c.assetId !== viewingAssetDetail.id));
                      setViewingAssetDetail(null);
                    }
                  }}
                  className="py-4 bg-zinc-900 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 border border-zinc-800 hover:border-red-500/50 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Trash2 size={18} />
                  EXCLUIR ATIVO
                </button>
              </div>
            </motion.div>
          )}

          {/* Inventory */}
          {activeTab === 'inventory' && !viewingAssetDetail && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar por modelo ou série..."
                  value={inventorySearchTerm}
                  onChange={(e) => setInventorySearchTerm(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="space-y-3">
                {filteredAssets.map(asset => (
                  <div 
                    key={asset.id} 
                    onClick={() => setViewingAssetDetail(asset)}
                    className="dark-card cursor-pointer transition-all hover:border-emerald-500/30 active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">{asset.type}</p>
                        <h4 className="font-bold text-white">{asset.name}</h4>
                      </div>
                      <StatusBadge status={asset.status} />
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] text-zinc-500 font-mono">SN: {asset.serialNumber}</p>
                      <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold uppercase">
                        <span>Ver Detalhes</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                ))}
                {assets.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Package size={48} className="mx-auto text-zinc-800" />
                    <p className="text-zinc-500 text-sm italic">Nenhum ativo cadastrado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">Relatórios & Auditoria</h2>
                <p className="text-zinc-500 text-sm">Geração de documentos técnicos oficiais.</p>
              </div>

              <div className="dark-card space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Responsável Técnico (TEC)</label>
                  <input 
                    type="text" 
                    value={reportTechnician}
                    onChange={(e) => setReportTechnician(e.target.value)}
                    placeholder="Nome do Engenheiro/Técnico"
                    className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tipo de Relatório</label>
                  <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'ativos', label: 'Inventário de Ativos', icon: <Package size={16} /> },
                        { id: 'checklist_diario', label: 'Relatório Técnico Diário (Consolidado)', icon: <ShieldCheck size={16} /> },
                        { id: 'checklist_geral', label: 'Histórico de Checklists', icon: <FileText size={16} /> },
                        { id: 'comparativo_semanal', label: 'Comparativo Semanal (Tendência)', icon: <Activity size={16} /> },
                        { id: 'auditoria', label: 'Auditoria de Sistema', icon: <Database size={16} /> },
                      ].map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setReportType(type.id as any)}
                        className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
                          reportType === type.id 
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                            : 'bg-black/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        {type.icon}
                        <span className="text-sm font-bold">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={generateGeneralReport}
                  disabled={isGeneratingReport}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingReport ? (
                    <RefreshCw size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  GERAR RELATÓRIO PDF
                </button>

                {reportType === 'checklist_geral' && checklists.length > 0 && (
                  <div className="space-y-4 pt-6 border-t border-zinc-800/50">
                    <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Checklists Recentes</h3>
                    <div className="space-y-2">
                      {checklists.slice(0, 10).map(c => {
                        const asset = assets.find(a => a.id === c.assetId);
                        const hasNC = c.items.some(i => i.status === 'NC');
                        return (
                          <div key={c.id} className="p-4 bg-black/40 border border-zinc-800 rounded-xl flex justify-between items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{asset?.name || 'Ativo Removido'}</span>
                                {hasNC && <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[8px] font-bold rounded-full border border-red-500/20">NC DETECTADO</span>}
                              </div>
                              <p className="text-[10px] text-zinc-500">{new Date(c.date).toLocaleDateString('pt-BR')} às {new Date(c.date).toLocaleTimeString('pt-BR')} - {c.technician}</p>
                            </div>
                            <button 
                              onClick={() => asset && generatePDF(c, asset)}
                              className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Baixar Relatório Individual"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <AlertTriangle size={16} />
                  <span className="text-[10px] font-bold uppercase">Aviso de Auditoria</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  O comparativo semanal analisa os últimos 7 dias em relação ao período anterior para identificar tendências de falha nos ativos WEG.
                </p>
              </div>
            </motion.div>
          )}

          {/* Guia Técnico */}
          {activeTab === 'guide' && (
            <motion.div 
              key="guide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pb-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Guia Técnico</h2>
                  <p className="text-zinc-500 text-sm">Parâmetros Ouro WEG</p>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <BookOpen className="w-5 h-5 text-emerald-500" />
                </div>
              </div>

              <div className="grid gap-6">
                {/* Exemplo de Diagnóstico Especialista */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">F070 - Sobrecarga no Inversor</h3>
                      <p className="text-xs text-zinc-500">Análise de Especialista Sênior</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-red-500 uppercase mb-2 tracking-widest">1. Diagnóstico Rápido</h4>
                      <ul className="text-xs space-y-1 text-zinc-300 list-disc pl-4">
                        <li>Carga mecânica excessiva ou travamento no eixo.</li>
                        <li>Parâmetros de corrente nominal (P0401) abaixo do real.</li>
                        <li>Curto-circuito entre fases ou para terra no cabo do motor.</li>
                      </ul>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">2. Parâmetros de Verificação</h4>
                      <ul className="text-xs space-y-1 text-zinc-300">
                        <li><span className="text-white font-mono">P0003:</span> Corrente de Saída (Verificar se excede P0401).</li>
                        <li><span className="text-white font-mono">P0030:</span> Temperatura estimada do motor.</li>
                        <li><span className="text-white font-mono">P0014:</span> Última falha ocorrida.</li>
                      </ul>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-blue-500 uppercase mb-2 tracking-widest">3. Procedimento de Campo</h4>
                      <ol className="text-xs space-y-2 text-zinc-300 list-decimal pl-4">
                        <li>Desconectar motor e testar drive em vazio (V/f).</li>
                        <li>Medir resistência de isolamento com Megômetro (Mín. 100MΩ).</li>
                        <li>Verificar torque em todos os terminais de potência (U, V, W).</li>
                      </ol>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-orange-500 uppercase mb-2 tracking-widest">4. Segurança e Norma (NR-10)</h4>
                      <p className="text-[10px] text-zinc-400">
                        Uso obrigatório de luvas isolantes Classe 0, óculos de proteção e multímetro CAT IV. Aplicar LOTO no disjuntor geral com cadeado e etiqueta de bloqueio.
                      </p>
                    </div>

                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-purple-500 uppercase mb-2 tracking-widest">5. Preditiva 4.0</h4>
                      <p className="text-[10px] text-zinc-400">
                        Instalar WEG Motor Scan para monitorar vibração e temperatura. Utilizar software WPS para extrair o log de eventos e analisar a curva de corrente pré-falha.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dica de Ouro Section */}
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6 mb-8">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1">Dica de Ouro: Dados de Placa</h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        Sempre verifique se a ligação física nos bornes do motor (Triângulo Δ ou Estrela Y) corresponde à tensão que você está parametrizando. Sem dados precisos, você corre o risco de queimar o enrolamento ou ter desarmes constantes por sobrecarga.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Knowledge Base */}
          {activeTab === 'knowledge' && (
            <motion.div 
              key="knowledge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="dark-card emerald-glow">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <Database className="text-emerald-500" size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Base de Conhecimento</h3>
                    <p className="text-zinc-500 text-xs">Carregue manuais PDF para consulta da IA</p>
                  </div>
                </div>

                <label className="block w-full cursor-pointer">
                  <div className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ${isUploading ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-zinc-800 hover:border-emerald-500/30 hover:bg-emerald-500/5'}`}>
                    {isUploading ? (
                      <RefreshCw className="text-emerald-500 animate-spin" size={32} />
                    ) : (
                      <Plus className="text-zinc-600" size={32} />
                    )}
                    <p className="text-sm font-bold text-zinc-400">{isUploading ? 'Processando PDF...' : 'Carregar Manual PDF'}</p>
                    <p className="text-[10px] text-zinc-600">A IA usará o conteúdo para responder</p>
                  </div>
                  <input 
                    type="file" 
                    accept=".pdf" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Documentos ({filteredKB.length})</h4>
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
                    <input 
                      type="text" 
                      placeholder="Buscar na base..." 
                      value={kbSearchTerm}
                      onChange={(e) => setKbSearchTerm(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredKB.map(doc => (
                    <div key={doc.id} className="dark-card flex items-center justify-between group">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedDoc(doc)}
                      >
                        <FileText className="text-emerald-500" size={18} />
                        <div>
                          <p className="font-semibold text-sm truncate max-w-[180px]">{doc.name}</p>
                          <p className="text-[10px] text-zinc-500">{new Date(doc.uploadDate).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedDoc(doc)}
                          className="p-2 text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Visualizar"
                        >
                          <BookOpen size={16} />
                        </button>
                        <button 
                          onClick={() => removeDoc(doc.id)}
                          className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredKB.length === 0 && (
                    <div className="text-center py-12 border border-zinc-900 rounded-3xl border-dashed">
                      <BookOpen className="mx-auto text-zinc-800 mb-2" size={32} />
                      <p className="text-zinc-600 text-sm italic">
                        {kbSearchTerm ? 'Nenhum documento encontrado para esta busca.' : 'Nenhum documento carregado.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bottom-nav-blur border-t border-zinc-900 px-6 py-4 flex justify-between items-center z-40">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-emerald-500' : 'text-zinc-600'}`}
        >
          <LayoutDashboard size={20} />
          <span className="text-[10px] font-bold">Início</span>
        </button>
        <button 
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'inventory' ? 'text-emerald-500' : 'text-zinc-600'}`}
        >
          <Package size={20} />
          <span className="text-[10px] font-bold">Ativos</span>
        </button>
        <button 
          onClick={() => setActiveTab('knowledge')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'knowledge' ? 'text-emerald-500' : 'text-zinc-600'}`}
        >
          <Database size={20} />
          <span className="text-[10px] font-bold">Base</span>
        </button>
        <button 
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'reports' ? 'text-emerald-500' : 'text-zinc-600'}`}
        >
          <FileText size={20} />
          <span className="text-[10px] font-bold">Relatórios</span>
        </button>
      </nav>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex flex-col"
          >
            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-center border-b border-zinc-800 gap-4 bg-zinc-900/50">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <FileText className="text-emerald-500" size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white truncate max-w-[200px] md:max-w-md">{selectedDoc.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Visualização de Manual</p>
                    <span className="text-[10px] text-zinc-700">•</span>
                    <button 
                      onClick={() => window.open(selectedDoc.fileData || '', '_blank')}
                      className="text-[10px] text-emerald-500 hover:underline flex items-center gap-1"
                    >
                      <Download size={10} /> Abrir Externo
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="flex bg-black p-1 rounded-xl border border-zinc-800">
                  <button 
                    onClick={() => setViewMode('original')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'original' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                  >
                    ORIGINAL
                  </button>
                  <button 
                    onClick={() => setViewMode('text')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${viewMode === 'text' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                  >
                    TEXTO
                  </button>
                </div>

                {viewMode === 'text' && (
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar no texto..." 
                      value={docSearchTerm}
                      onChange={(e) => setDocSearchTerm(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                )}
                <button 
                  onClick={() => {
                    setSelectedDoc(null);
                    setDocSearchTerm('');
                    setViewMode('original');
                  }}
                  className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 rounded-xl flex items-center justify-center text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden bg-zinc-950">
              {viewMode === 'original' && selectedDoc.fileData ? (
                <iframe 
                  src={selectedDoc.fileData} 
                  className="w-full h-full border-none"
                  title={selectedDoc.name}
                />
              ) : (
                <div className="h-full overflow-y-auto p-4 md:p-8 custom-scrollbar">
                  <div className="max-w-3xl mx-auto bg-zinc-900/30 p-6 md:p-10 rounded-3xl border border-zinc-800/50 shadow-2xl">
                    <div className="prose prose-invert max-w-none">
                      <pre className="text-zinc-300 text-sm md:text-base whitespace-pre-wrap font-sans leading-relaxed tracking-wide">
                        {highlightText(selectedDoc.content, docSearchTerm)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 md:p-6 border-t border-zinc-800 bg-zinc-900 flex justify-center gap-4">
              <button 
                onClick={() => {
                  setSelectedDoc(null);
                  setDocSearchTerm('');
                  setViewMode('original');
                }}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
              >
                FECHAR MANUAL
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full rounded-3xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Novo Ativo WEG</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddAsset} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Nome do Ativo</label>
                  <input name="name" required placeholder="Ex: ssw07/motor" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 space-y-3">
                  <button 
                    type="button"
                    onClick={() => setIsGuideInModalOpen(!isGuideInModalOpen)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Guia de Parâmetros Ouro</span>
                    </div>
                    <ChevronRight size={14} className={`text-zinc-500 transition-transform ${isGuideInModalOpen ? 'rotate-90' : ''}`} />
                  </button>
                  
                  {isGuideInModalOpen && (
                    <div className="text-[10px] text-zinc-400 space-y-2 leading-relaxed animate-in fade-in slide-in-from-top-1">
                      <p>Para que o inversor ou a soft-starter protejam o motor e entreguem o torque correto, os "parâmetros ouro" são sempre os dados de placa.</p>
                      <div className="grid grid-cols-1 gap-2 bg-black/40 p-3 rounded-xl border border-zinc-800/50">
                        <p><span className="text-emerald-500 font-bold">1. Corrente Nominal (In):</span> Valor em Amperes (A) para a ligação feita (ex: 220V ou 380V).</p>
                        <p><span className="text-emerald-500 font-bold">2. Tensão Nominal (Vn):</span> Tensão de trabalho (220V, 380V, 440V).</p>
                        <p><span className="text-emerald-500 font-bold">3. Frequência Nominal (fn):</span> Padrão 60 Hz no Brasil.</p>
                        <p><span className="text-emerald-500 font-bold">4. Rotação Nominal (RPM):</span> Velocidade a plena carga (ex: 1745 RPM).</p>
                        <p><span className="text-emerald-500 font-bold">5. Fator de Serviço (FS):</span> Capacidade de sobrecarga contínua (ex: 1.15).</p>
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold text-zinc-300">CFW500 (Inversor):</p>
                        <p>P0401: Corrente | P0402: RPM | P0403: Hz | P0404: cv/kW | P0400: V</p>
                        <p className="font-bold text-zinc-300">SSW07 (Soft-Starter):</p>
                        <p>P0401: Corrente | P0406: Fator de Serviço</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Tipo</label>
                    <select 
                      name="type" 
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as AssetType)}
                      className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="Motor">Motor</option>
                      <option value="Inversor">Inversor (CFW500)</option>
                      <option value="Soft-Starter">Soft-Starter (SSW07)</option>
                      <option value="Quadro">Quadro Elétrico (QGBT)</option>
                      <option value="Bomba">Motobomba</option>
                      <option value="Compressor">Compressor Parafuso</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Status</label>
                    <select name="status" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50">
                      <option>Operacional</option>
                      <option>Alerta</option>
                      <option>Manutenção</option>
                      <option>Crítico</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Modelo</label>
                    <input name="model" placeholder="Ex: CFW500 / SSW07" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                  </div>
                </div>

                {(selectedType === 'Inversor' || selectedType === 'Soft-Starter') && (
                  <div className="space-y-3 pt-2 border-t border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Dados da Placa do Motor</h4>
                      <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold">CONJUNTO DRIVE + MOTOR</span>
                    </div>
                    
                    <div className="space-y-1 mb-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">Motor Conectado (Identificação)</label>
                      <input name="connectedMotor" placeholder="Ex: Motor Britador 01" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Corrente (A)</label>
                        <input name="current" placeholder="P0401" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Rotação (RPM)</label>
                        <input name="rpm" placeholder="P0402" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Frequência (Hz)</label>
                        <input name="frequency" placeholder="P0403" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Potência (cv/kW)</label>
                        <input name="power" placeholder="P0404" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tensão (V)</label>
                        <input name="voltage" placeholder="P0400" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Fator de Serviço</label>
                        <input name="serviceFactor" placeholder="P0406" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Configuração Atual do Drive</h4>
                        <span className="text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full font-bold">PARÂMETROS NO EQUIPAMENTO</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {selectedType === 'Inversor' ? (
                          <>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo Acel. (P0100)</label>
                              <input name="p0100" placeholder="Ex: 10s" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo Desacel. (P0101)</label>
                              <input name="p0101" placeholder="Ex: 10s" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tipo Controle (P0202)</label>
                              <input name="p0202" placeholder="0=V/f, 1=VVW, 2=Vetor" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Seleção L/R (P0220)</label>
                              <input name="p0220" placeholder="0=Local, 1=Remoto" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Corrente Sobrecarga (P0156)</label>
                              <input name="p0156" placeholder="Ex: 1.1 * In" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tensão Inicial (P0101)</label>
                              <input name="p0101" placeholder="Ex: 40%" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo Acel. (P0102)</label>
                              <input name="p0102" placeholder="Ex: 15s" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tempo Desacel. (P0104)</label>
                              <input name="p0104" placeholder="Ex: 0s" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Tipo Partida (P0202)</label>
                              <input name="p0202" placeholder="0=Rampa, 1=Limite" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <label className="text-[10px] font-bold text-zinc-500 uppercase">Limite de Corrente (P0110)</label>
                              <input name="p0110" placeholder="Ex: 300%" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Localização</label>
                  <input name="location" placeholder="Ex: Setor de Britagem" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    type="submit" 
                    className="py-4 bg-emerald-500 text-black font-bold rounded-2xl active:scale-95 transition-all text-sm"
                  >
                    SALVAR ATIVO WEG
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist Modal */}
      <AnimatePresence>
        {isChecklistModalOpen && selectedAsset && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 space-y-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">{checklistSummary ? 'Resumo da Inspeção' : 'Checklist Diário'}</h3>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">{selectedAsset.name}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsChecklistModalOpen(false);
                    setIsChecklistStarted(false);
                    setChecklistSummary(null);
                    setTechnicianName('');
                  }} 
                  className="text-zinc-500 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              {!isChecklistStarted && !checklistSummary ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Técnico Responsável</label>
                    <input 
                      value={technicianName}
                      onChange={(e) => setTechnicianName(e.target.value)}
                      placeholder="Seu nome completo" 
                      className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50" 
                    />
                  </div>
                  <button 
                    disabled={!technicianName}
                    onClick={() => startChecklist()}
                    className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl active:scale-95 transition-all text-sm disabled:opacity-50 disabled:active:scale-100"
                  >
                    INICIAR COLETA DE DADOS
                  </button>
                </div>
              ) : checklistSummary ? (
                <div className="space-y-6">
                  <div className="p-4 bg-black border border-zinc-800 rounded-2xl font-mono text-[10px] whitespace-pre-wrap text-emerald-500 leading-relaxed max-h-[40vh] overflow-y-auto custom-scrollbar">
                    {checklistSummary}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(checklistSummary);
                        alert('Resumo copiado para a área de transferência!');
                      }}
                      className="py-4 bg-zinc-800 text-emerald-500 font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                    >
                      <Copy size={16} />
                      COPIAR TEXTO
                    </button>
                    <button 
                      onClick={() => {
                        setIsChecklistModalOpen(false);
                        setChecklistSummary(null);
                        setTechnicianName('');
                      }}
                      className="py-4 bg-emerald-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all text-xs"
                    >
                      <CheckCircle2 size={16} />
                      CONCLUIR
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Progress Bar & Back Button */}
                  <div className="flex items-center gap-3">
                    {currentChecklistStep > 0 && (
                      <button 
                        onClick={() => {
                          setCurrentChecklistStep(prev => prev - 1);
                          setTempPhoto(checklistItems[currentChecklistStep - 1].photo);
                          setNcDescription(checklistItems[currentChecklistStep - 1].ncDescription || '');
                          setMeasuredValue(checklistItems[currentChecklistStep - 1].measuredValue || '');
                        }}
                        className="p-2 bg-zinc-800 text-zinc-400 rounded-xl hover:text-white transition-colors"
                      >
                        <ChevronLeft size={20} />
                      </button>
                    )}
                    <div className="flex-1 flex gap-1 h-1">
                      {checklistItems.map((_, idx) => (
                        <div 
                          key={idx} 
                          className={`flex-1 rounded-full transition-all ${idx <= currentChecklistStep ? 'bg-emerald-500' : 'bg-zinc-800'}`} 
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Item {checklistItems[currentChecklistStep].id}</span>
                      <h4 className="text-lg font-bold leading-tight">{checklistItems[currentChecklistStep].label}</h4>
                      <p className="text-xs text-zinc-400">{checklistItems[currentChecklistStep].description}</p>
                    </div>

                    {/* Measured Value Input */}
                    {checklistItems[currentChecklistStep].requiresValue && (
                      <div className="space-y-2 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Valor de Medição / Grandeza</label>
                          <span className="text-[8px] font-bold text-zinc-500 uppercase">Ref: {checklistItems[currentChecklistStep].referenceValue}</span>
                        </div>
                        <input 
                          type="text"
                          value={measuredValue}
                          onChange={(e) => setMeasuredValue(e.target.value)}
                          placeholder="Ex: 380V, 12.5A, 45ºC..."
                          className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <p className="text-[9px] text-zinc-500 italic leading-tight">Insira o valor real encontrado em campo para este equipamento.</p>
                      </div>
                    )}

                    {/* Photo Upload Area */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                          {(checklistItems[currentChecklistStep].label.toUpperCase().includes('FOTO') || 
                            checklistItems[currentChecklistStep].description.includes('📸')) 
                            ? 'Foto Obrigatória' 
                            : 'Foto (Opcional)'}
                        </label>
                        {tempPhoto && (
                          <span className="text-[10px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                            <CheckCircle2 size={10} /> Foto Capturada
                          </span>
                        )}
                      </div>
                      
                      <div className="relative aspect-video bg-black border-2 border-dashed border-zinc-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3">
                        {tempPhoto ? (
                          <>
                            <img src={tempPhoto} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button 
                                onClick={() => setTempPhoto(null)}
                                className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-transform"
                              >
                                <Trash2 size={14} /> REMOVER E TIRAR OUTRA
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="grid grid-cols-2 gap-4 w-full p-4 h-full">
                            <label className="flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl cursor-pointer active:scale-95 transition-all hover:bg-emerald-500/5 hover:border-emerald-500/20 group">
                              <Camera size={28} className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">Câmera</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                onChange={handlePhotoCapture} 
                                className="hidden" 
                              />
                            </label>
                            <label className="flex flex-col items-center justify-center bg-zinc-900/50 border border-zinc-800 rounded-2xl cursor-pointer active:scale-95 transition-all hover:bg-emerald-500/5 hover:border-emerald-500/20 group">
                              <Upload size={28} className="text-zinc-500 mb-2 group-hover:scale-110 transition-transform" />
                              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter">Galeria</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                onChange={handlePhotoCapture} 
                                className="hidden" 
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* NC Description */}
                    <AnimatePresence>
                      {checklistItems[currentChecklistStep].status === 'NC' && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Descrição do Problema (Obrigatório)</label>
                          <textarea 
                            value={ncDescription}
                            onChange={(e) => setNcDescription(e.target.value)}
                            placeholder="Descreva brevemente a anomalia encontrada..."
                            className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                            rows={2}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Actions */}
                    <div className="grid grid-cols-3 gap-2 pt-4">
                      <button 
                        onClick={() => {
                          if (checklistItems[currentChecklistStep].requiresValue) {
                            const updated = [...checklistItems];
                            updated[currentChecklistStep].status = 'C';
                            setChecklistItems(updated);
                          } else {
                            handleChecklistStep('C');
                          }
                        }}
                        className={`py-4 font-bold rounded-2xl active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1 ${checklistItems[currentChecklistStep].status === 'C' ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-emerald-500'}`}
                      >
                        <CheckCircle2 size={16} />
                        CONFORME (C)
                      </button>
                      <button 
                        onClick={() => {
                          if (checklistItems[currentChecklistStep].status === 'NC' && !checklistItems[currentChecklistStep].requiresValue) {
                            handleChecklistStep('NC');
                          } else {
                            const updated = [...checklistItems];
                            updated[currentChecklistStep].status = 'NC';
                            setChecklistItems(updated);
                          }
                        }}
                        className={`py-4 font-bold rounded-2xl active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1 ${checklistItems[currentChecklistStep].status === 'NC' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-red-500'}`}
                      >
                        <AlertTriangle size={16} />
                        NÃO CONF. (NC)
                      </button>
                      <button 
                        onClick={() => handleChecklistStep('NA')}
                        className={`py-4 font-bold rounded-2xl active:scale-95 transition-all text-[10px] flex flex-col items-center justify-center gap-1 ${checklistItems[currentChecklistStep].status === 'NA' ? 'bg-zinc-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}
                      >
                        <MinusCircle size={16} />
                        N/A
                      </button>
                    </div>
                    {(checklistItems[currentChecklistStep].status === 'NC' || checklistItems[currentChecklistStep].requiresValue) && checklistItems[currentChecklistStep].status !== null && (
                      <button 
                        disabled={checklistItems[currentChecklistStep].status === 'NC' && !ncDescription.trim()}
                        onClick={() => handleChecklistStep(checklistItems[currentChecklistStep].status as 'C' | 'NC')}
                        className="w-full py-3 bg-emerald-500 text-black font-bold rounded-xl text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        Confirmar e Próximo
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset Detail Sheet */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 max-w-md mx-auto bg-zinc-900 border-t border-zinc-800 rounded-t-[32px] z-50 p-6 pb-12 overflow-y-auto max-h-[90vh]"
          >
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" onClick={() => setSelectedAsset(null)} />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs text-emerald-500 font-bold uppercase">{selectedAsset.type}</p>
                <h2 className="text-2xl font-bold">{selectedAsset.name}</h2>
                <p className="text-zinc-500 text-sm">{selectedAsset.location}</p>
              </div>
              <StatusBadge status={selectedAsset.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-black rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Modelo</p>
                <p className="font-medium text-sm">{selectedAsset.model}</p>
              </div>
              <div className="p-4 bg-black rounded-2xl border border-zinc-800">
                <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Nº de Série</p>
                <p className="font-medium text-sm">{selectedAsset.serialNumber}</p>
              </div>
            </div>

            <div className="flex gap-3 mb-8">
              <button 
                onClick={() => setIsChecklistModalOpen(true)}
                className="flex-1 py-4 bg-emerald-500 text-black font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <FileText size={18} />
                REALIZAR CHECKLIST
              </button>
            </div>

            {selectedAsset.technicalParams && (
              <div className="mb-8 space-y-4">
                {selectedAsset.technicalParams.connectedMotor && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">Motor Conectado</p>
                      <h4 className="font-bold text-white">{selectedAsset.technicalParams.connectedMotor}</h4>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Comparativo: Placa vs Ouro</h4>
                  <span className="text-[8px] text-zinc-500 italic">Referência WEG SSW/CFW</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: 'Corrente (P0401)', key: 'current', ref: 'In (Placa)' },
                    { label: 'Rotação (P0402)', key: 'rpm', ref: 'RPM (Placa)' },
                    { label: 'Frequência (P0403)', key: 'frequency', ref: '60 Hz' },
                    { label: 'Potência (P0404)', key: 'power', ref: 'cv/kW' },
                    { label: 'Tensão (P0400)', key: 'voltage', ref: '220/380V' },
                    { label: 'Fator Serviço (P0406)', key: 'serviceFactor', ref: '1.15' },
                  ].map((param) => {
                    const value = (selectedAsset.technicalParams as any)[param.key];
                    if (!value) return null;
                    
                    return (
                      <div key={param.key} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800/50">
                        <div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase">{param.label}</p>
                          <p className="text-sm font-mono text-white">{value}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] text-emerald-500/50 uppercase font-bold">Padrão Ouro</p>
                          <p className="text-[10px] text-emerald-500 font-medium">{param.ref}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800/50">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Configuração Atual do Drive</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAsset.type === 'Inversor' ? [
                      { label: 'Tempo Acel.', key: 'p0100', param: 'P0100' },
                      { label: 'Tempo Desacel.', key: 'p0101', param: 'P0101' },
                      { label: 'Tipo Controle', key: 'p0202', param: 'P0202' },
                      { label: 'Seleção L/R', key: 'p0220', param: 'P0220' },
                      { label: 'Corrente Sobrecarga', key: 'p0156', param: 'P0156' },
                    ].map((item) => {
                      const value = (selectedAsset.technicalParams as any)[item.key];
                      if (!value) return null;
                      return (
                        <div key={item.key} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30">
                          <p className="text-[8px] text-zinc-500 font-bold uppercase">{item.label} ({item.param})</p>
                          <p className="text-xs font-mono text-white">{value}</p>
                        </div>
                      );
                    }) : [
                      { label: 'Tensão Inicial', key: 'p0101', param: 'P0101' },
                      { label: 'Tempo Acel.', key: 'p0102', param: 'P0102' },
                      { label: 'Tempo Desacel.', key: 'p0104', param: 'P0104' },
                      { label: 'Tipo Partida', key: 'p0202', param: 'P0202' },
                      { label: 'Limite Corrente', key: 'p0110', param: 'P0110' },
                    ].map((item) => {
                      const value = (selectedAsset.technicalParams as any)[item.key];
                      if (!value) return null;
                      return (
                        <div key={item.key} className="p-3 bg-zinc-800/50 rounded-xl border border-zinc-700/30">
                          <p className="text-[8px] text-zinc-500 font-bold uppercase">{item.label} ({item.param})</p>
                          <p className="text-xs font-mono text-white">{value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-center gap-3">
                  <Zap size={14} className="text-emerald-500" />
                  <p className="text-[10px] text-zinc-400 italic">
                    O {selectedAsset.type} está configurado para proteger o motor conforme os dados acima.
                  </p>
                </div>

                <div className="space-y-3 pt-6 border-t border-zinc-800/50">
                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Histórico de Checklists</h4>
                  <div className="space-y-2">
                    {checklists.filter(c => c.assetId === selectedAsset.id).length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">Nenhum checklist realizado ainda.</p>
                    ) : (
                      checklists.filter(c => c.assetId === selectedAsset.id).map(checklist => (
                        <div key={checklist.id} className="p-4 bg-black/40 rounded-2xl border border-zinc-800/50 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-white">{new Date(checklist.date).toLocaleDateString('pt-BR')}</p>
                            <p className="text-[10px] text-zinc-500 uppercase">{checklist.technician}</p>
                          </div>
                          <button 
                            onClick={() => generatePDF(checklist, selectedAsset)}
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-emerald-500 transition-colors"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="p-4 bg-white rounded-2xl">
                <QRCodeSVG value={`EMAM-WEG-${selectedAsset.id}`} size={120} />
              </div>
              <p className="text-[10px] text-zinc-500 font-mono">ID: {selectedAsset.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => exportPDF(selectedAsset)}
                className="flex items-center justify-center gap-2 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm font-bold transition-all"
              >
                <FileText size={18} />
                RELATÓRIO PDF
              </button>
              <button 
                onClick={() => handleDeleteAsset(selectedAsset.id)}
                className="flex items-center justify-center gap-2 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl text-sm font-bold transition-all"
              >
                <Trash2 size={18} />
                EXCLUIR
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
