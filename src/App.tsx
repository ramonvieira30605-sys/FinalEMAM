/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Package, 
  Cpu, 
  Cloud, 
  Plus, 
  Search, 
  QrCode, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Wrench, 
  XCircle,
  Send,
  RefreshCw,
  Trash2,
  ChevronRight,
  Download,
  X,
  BookOpen,
  Zap,
  Activity,
  AlertTriangle,
  Database
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from './supabaseClient';
import { getGeminiResponse } from './geminiService';
import { Asset, AssetStatus, AssetType, ChatMessage, Checklist, KnowledgeBaseDoc } from './types';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'ai' | 'guide' | 'knowledge' | 'reports'>('dashboard');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAnonAuthDisabled, setIsAnonAuthDisabled] = useState(false);
  const [isGuideInModalOpen, setIsGuideInModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AssetType>('Motor');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  // New states for Reports
  const [reportTechnician, setReportTechnician] = useState('');
  const [reportType, setReportType] = useState<'ativos' | 'auditoria' | 'checklist_geral' | 'comparativo_semanal'>('ativos');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Load from LocalStorage (initial) and then Supabase
  useEffect(() => {
    const loadInitialData = async () => {
      // Set a safety timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        setIsLoadingData(false);
      }, 5000);

      try {
        const savedAssets = localStorage.getItem('emam_assets');
        if (savedAssets) setAssets(JSON.parse(savedAssets));
        
        const savedChecklists = localStorage.getItem('emam_checklists');
        if (savedChecklists) setChecklists(JSON.parse(savedChecklists));
        
        const savedKnowledge = localStorage.getItem('emam_knowledge');
        if (savedKnowledge) setKnowledgeBase(JSON.parse(savedKnowledge));
      } catch (e) {
        console.error('Failed to parse local storage', e);
      }
      
      // Anonymous Login and Cloud Fetch
      const initAuthAndFetch = async () => {
        if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
          clearTimeout(timeoutId);
          setIsLoadingData(false);
          return;
        }

        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          let currentUser = user;

          if (authError || !user) {
            const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
            if (signInError) {
              console.error('Supabase Auth Error:', signInError.message);
              if (signInError.message.includes('Anonymous sign-ins are disabled')) {
                setIsAnonAuthDisabled(true);
              }
              clearTimeout(timeoutId);
              setIsLoadingData(false);
              return;
            }
            currentUser = signInData.user;
          }

          setIsAnonAuthDisabled(false);
          
          if (currentUser) {
            // Fetch Assets
            const { data: cloudAssets, error: assetsError } = await supabase
              .from('assets')
              .select('*')
              .eq('user_id', currentUser.id);
            
            if (cloudAssets && !assetsError && cloudAssets.length > 0) {
              const mappedAssets: Asset[] = cloudAssets.map(a => ({
                id: a.id,
                name: a.name,
                type: a.type as AssetType,
                model: a.model || '',
                serialNumber: a.serial_number || '',
                location: a.location || '',
                status: a.status as AssetStatus,
                lastUpdated: a.last_updated,
                createdAt: a.created_at,
                technicalParams: a.technical_params || {}
              }));
              setAssets(mappedAssets);
            }

            // Fetch Checklists
            const { data: cloudChecklists, error: checklistsError } = await supabase
              .from('checklists')
              .select('*')
              .eq('user_id', currentUser.id);
            
            if (cloudChecklists && !checklistsError && cloudChecklists.length > 0) {
              const mappedChecklists: Checklist[] = cloudChecklists.map(c => {
                let items = { observations: c.observations || '' };
                try {
                  // Try to parse JSON from observations if it starts with {
                  if (c.observations && c.observations.startsWith('{')) {
                    items = JSON.parse(c.observations);
                  } else {
                    // Fallback for old data
                    items = {
                      ...items,
                      vibration: c.vibration,
                      temperature: c.temperature,
                      noise: c.noise,
                      currentCheck: c.current_check,
                      errorCodes: c.error_codes,
                    } as any;
                  }
                } catch (e) {
                  console.warn('Failed to parse checklist items', e);
                }
                return {
                  id: c.id,
                  assetId: c.asset_id,
                  date: c.date,
                  technician: c.technician,
                  items
                };
              });
              setChecklists(mappedChecklists);
            }

            // Fetch Knowledge Base
            const { data: cloudKB, error: kbError } = await supabase
              .from('knowledge_base')
              .select('*')
              .eq('user_id', currentUser.id);
            
            if (cloudKB && !kbError && cloudKB.length > 0) {
              const mappedKB: KnowledgeBaseDoc[] = cloudKB.map(doc => ({
                id: doc.id,
                name: doc.name,
                content: doc.content,
                uploadDate: doc.upload_date
              }));
              setKnowledgeBase(mappedKB);
            }
          }
        } catch (e) {
          console.error('Auth/Fetch init failed', e);
        } finally {
          clearTimeout(timeoutId);
          setIsLoadingData(false);
        }
      };
      
      initAuthAndFetch();
    };

    loadInitialData();
  }, []);

  // Auto-sync to LocalStorage and Cloud (Debounced)
  useEffect(() => {
    localStorage.setItem('emam_assets', JSON.stringify(assets));
    
    const timer = setTimeout(() => {
      if (!isLoadingData && assets.length > 0) {
        silentSync();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [assets]);

  useEffect(() => {
    localStorage.setItem('emam_checklists', JSON.stringify(checklists));
    
    const timer = setTimeout(() => {
      if (!isLoadingData && checklists.length > 0) {
        silentSync();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [checklists]);

  useEffect(() => {
    localStorage.setItem('emam_knowledge', JSON.stringify(knowledgeBase));
    
    const timer = setTimeout(() => {
      if (!isLoadingData && knowledgeBase.length > 0) {
        silentSync();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [knowledgeBase]);

  const silentSync = async () => {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;

      // Sync Assets
      if (assets.length > 0) {
        await supabase.from('assets').upsert(assets.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          model: a.model,
          serial_number: a.serialNumber,
          location: a.location,
          status: a.status,
          technical_params: a.technicalParams,
          last_updated: a.lastUpdated,
          user_id: userId
        })));
      }

      // Sync Checklists
      if (checklists.length > 0) {
        await supabase.from('checklists').upsert(checklists.map(c => ({
          id: c.id,
          asset_id: c.assetId,
          date: c.date,
          technician: c.technician,
          // Store all items as JSON in observations to preserve new technical fields
          observations: JSON.stringify(c.items),
          user_id: userId
        })));
      }

      // Sync Knowledge Base
      if (knowledgeBase.length > 0) {
        await supabase.from('knowledge_base').upsert(knowledgeBase.map(doc => ({
          id: doc.id,
          name: doc.name,
          content: doc.content,
          upload_date: doc.uploadDate,
          user_id: userId
        })));
      }
    } catch (e) {
      console.warn('Silent sync failed', e);
    }
  };

  const stats = useMemo(() => ({
    total: assets.length,
    operational: assets.filter(a => a.status === 'Operacional').length,
    alerts: assets.filter(a => a.status !== 'Operacional').length,
  }), [assets]);

  const handleAddChecklist = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAsset) return;

    const formData = new FormData(e.currentTarget);
    const newChecklist: Checklist = {
      id: crypto.randomUUID(),
      assetId: selectedAsset.id,
      date: new Date().toISOString(),
      technician: formData.get('technician') as string,
      items: {
        // Acionamentos
        p0003_current: formData.get('p0003_current') as string,
        p0004_link_dc: formData.get('p0004_link_dc') as string,
        p006_status: formData.get('p006_status') as string,
        starting_current_peak: formData.get('starting_current_peak') as string,
        
        // Motobomba
        discharge_pressure: formData.get('discharge_pressure') as string,
        casing_temperature: formData.get('casing_temperature') as string,
        gland_drip: formData.get('gland_drip') as string,
        mechanical_seal_leak: formData.get('mechanical_seal_leak') as string,
        
        // Compressores
        load_pressure: formData.get('load_pressure') as string,
        unload_pressure: formData.get('unload_pressure') as string,
        unit_temperature: formData.get('unit_temperature') as string,
        condensate_drain_oil: formData.get('condensate_drain_oil') as string,
        
        // Quadros
        phase_unbalance: formData.get('phase_unbalance') as string,
        terminal_temperature: formData.get('terminal_temperature') as string,
        dps_status: formData.get('dps_status') as string,
        
        observations: formData.get('observations') as string,
      }
    };

    setChecklists(prev => [newChecklist, ...prev]);
    setIsChecklistModalOpen(false);
  };

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

    // Add specific parameters based on asset type
    if (asset.type === 'Inversor') {
      checklistData.push(['Corrente Saída (P0003):', checklist.items.p0003_current || '-']);
      checklistData.push(['Tensão Link DC (P0004):', checklist.items.p0004_link_dc || '-']);
    } else if (asset.type === 'Soft-Starter') {
      checklistData.push(['Status (P006):', checklist.items.p006_status || '-']);
      checklistData.push(['Corrente Partida:', checklist.items.starting_current_peak || '-']);
    } else if (asset.type === 'Motor') {
      checklistData.push(['Pressão Descarga:', checklist.items.discharge_pressure || '-']);
      checklistData.push(['Temp. Carcaça:', checklist.items.casing_temperature || '-']);
      checklistData.push(['Gotejamento Gaxeta:', checklist.items.gland_drip || '-']);
      checklistData.push(['Vazamento Selo:', checklist.items.mechanical_seal_leak || '-']);
    } else if (asset.type === 'Compressor') {
      checklistData.push(['Pressão Carga:', checklist.items.load_pressure || '-']);
      checklistData.push(['Pressão Alívio:', checklist.items.unload_pressure || '-']);
      checklistData.push(['Temp. Unidade:', checklist.items.unit_temperature || '-']);
      checklistData.push(['Dreno Condensado:', checklist.items.condensate_drain_oil || '-']);
    } else if (asset.type === 'Quadro') {
      checklistData.push(['Equilíbrio Fases:', checklist.items.phase_unbalance || '-']);
      checklistData.push(['Temp. Bornes:', checklist.items.terminal_temperature || '-']);
      checklistData.push(['Status DPS:', checklist.items.dps_status || '-']);
    }

    checklistData.push(['Observações:', checklist.items.observations || 'Nenhuma']);

    (doc as any).autoTable({
      startY: startYChecklist + 5,
      body: checklistData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 10, cellPadding: 5 },
      columnStyles: { 0: { fontStyle: 'bold', width: 50 } }
    });

    // Technical Params (if any)
    if (asset.technicalParams) {
      const startYParams = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.text('PARÂMETROS TÉCNICOS CONFIGURADOS', 14, startYParams);
      
      const paramsData = [
        ['Corrente (P0401):', asset.technicalParams.current || '-'],
        ['RPM (P0402):', asset.technicalParams.rpm || '-'],
        ['Freq (P0403):', asset.technicalParams.frequency || '-'],
        ['Potência (P0404):', asset.technicalParams.power || '-'],
        ['Tensão (P0400):', asset.technicalParams.voltage || '-'],
        ['Fator Serviço (P0406):', asset.technicalParams.serviceFactor || '-'],
        ['Tensão Inicial (P0101):', asset.technicalParams.p0101 || '-'],
        ['Tempo Acel (P0102):', asset.technicalParams.p0102 || '-'],
        ['Classe Térmica (P0640):', asset.technicalParams.p0640 || '-']
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
        `Gerado por EMAM-WEG Cloud - ${new Date().toLocaleString('pt-BR')}`,
        105,
        285,
        { align: 'center' }
      );
    }

    doc.save(`checklist-${asset.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.pdf`);
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
        const content = await extractTextFromPDF(file);
        const newDoc: KnowledgeBaseDoc = {
          id: crypto.randomUUID(),
          name: file.name,
          content: content,
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
        p0101: formData.get('p0101') as string,
        p0102: formData.get('p0102') as string,
        p0104: formData.get('p0104') as string,
        p0202: formData.get('p0202') as string,
        p0219: formData.get('p0219') as string,
        p0640: formData.get('p0640') as string,
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

  const syncWithCloud = async () => {
    if (import.meta.env.VITE_SUPABASE_URL === undefined || import.meta.env.VITE_SUPABASE_ANON_KEY === undefined) {
      alert('Configuração do Supabase ausente. Por favor, adicione VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nos Secrets.');
      return;
    }

    setIsSyncing(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        // Try to sign in again if no user
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          if (signInError.message.includes('Anonymous sign-ins are disabled')) {
            alert('ERRO: O login anônimo está desativado no seu projeto Supabase. \n\nPara corrigir:\n1. Vá ao Dashboard do Supabase\n2. Authentication -> Providers -> Anonymous\n3. Ative "Allow anonymous sign-ins"\n4. Salve e tente novamente.');
          } else {
            alert(`Erro de autenticação: ${signInError.message}`);
          }
          setIsSyncing(false);
          return;
        }
      }

      const { data: { user: activeUser } } = await supabase.auth.getUser();
      const userId = activeUser?.id;

      const { error: assetsError } = await supabase
        .from('assets')
        .upsert(assets.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          model: a.model,
          serial_number: a.serialNumber,
          location: a.location,
          status: a.status,
          technical_params: a.technicalParams,
          last_updated: a.lastUpdated,
          user_id: userId
        })));

      if (assetsError) throw assetsError;

      // Sync Checklists
      if (checklists.length > 0) {
        const { error: checklistsError } = await supabase
          .from('checklists')
          .upsert(checklists.map(c => ({
            id: c.id,
            asset_id: c.assetId,
            date: c.date,
            technician: c.technician,
            // Store all items as JSON in observations to preserve new technical fields
            observations: JSON.stringify(c.items),
            user_id: userId
          })));
        if (checklistsError) throw checklistsError;
      }

      // Sync Knowledge Base
      if (knowledgeBase.length > 0) {
        const { error: kbError } = await supabase
          .from('knowledge_base')
          .upsert(knowledgeBase.map(doc => ({
            id: doc.id,
            name: doc.name,
            content: doc.content,
            upload_date: doc.uploadDate,
            user_id: userId
          })));
        if (kbError) throw kbError;
      }

      alert('Sincronização concluída com sucesso!');
    } catch (error) {
      console.error('Sync Error:', error);
      alert('Erro ao sincronizar. Verifique se as credenciais do Supabase nos Secrets estão corretas e se as tabelas (assets, checklists, knowledge_base) foram criadas.');
    } finally {
      setIsSyncing(false);
    }
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
    } else if (reportType === 'checklist_geral') {
      autoTable(doc, {
        startY: 65,
        head: [['Data', 'Ativo', 'Técnico', 'Observações / Medições']],
        body: checklists.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(c => {
          const asset = assets.find(a => a.id === c.assetId);
          // Create a summary of measurements
          let summary = c.items.observations || '';
          if (asset?.type === 'Inversor') summary = `Corrente: ${c.items.p0003_current}A | Link DC: ${c.items.p0004_link_dc}V. ${summary}`;
          if (asset?.type === 'Soft-Starter') summary = `Status: ${c.items.p006_status} | Partida: ${c.items.starting_current_peak}. ${summary}`;
          
          return [
            new Date(c.date).toLocaleDateString('pt-BR'),
            asset?.name || 'N/A',
            c.technician,
            summary
          ];
        }),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] },
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
          const asset = assets.find(a => a.id === c.assetId);
          if (asset?.type === 'Motor') return c.items.mechanical_seal_leak === 'Com Vazamento' || c.items.gland_drip === 'Excessivo';
          if (asset?.type === 'Quadro') return c.items.dps_status === 'Vermelho (Substituir)';
          if (asset?.type === 'Compressor') return c.items.condensate_drain_oil === 'Presença de Óleo (Alerta)';
          return false;
        }).length;

        const oldAlerts = old.filter(c => {
          const asset = assets.find(a => a.id === c.assetId);
          if (asset?.type === 'Motor') return c.items.mechanical_seal_leak === 'Com Vazamento' || c.items.gland_drip === 'Excessivo';
          if (asset?.type === 'Quadro') return c.items.dps_status === 'Vermelho (Substituir)';
          if (asset?.type === 'Compressor') return c.items.condensate_drain_oil === 'Presença de Óleo (Alerta)';
          return false;
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
          ['Documentos na Base de Conhecimento', stats.docsInKb],
          ['Sincronização Cloud', 'Ativa (Supabase)'],
        ],
        theme: 'grid',
      });
    }

    doc.save(`EMAM_Relatorio_${reportType}_${dateStr.replace(/\//g, '-')}.pdf`);
    setIsGeneratingReport(false);
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const userMsg: ChatMessage = { role: 'user', text: userInput };
    setChatHistory(prev => [...prev, userMsg]);
    setUserInput('');
    setIsAiLoading(true);

    // Prepare context from knowledge base
    let context = "";
    if (knowledgeBase.length > 0) {
      context = "Base de Conhecimento (Documentos PDF):\n";
      knowledgeBase.forEach(doc => {
        context += `--- Documento: ${doc.name} ---\n${doc.content}\n\n`;
      });
      context += "\nUse APENAS as informações da Base de Conhecimento acima para responder. Se a resposta não estiver nos documentos, informe claramente que não há dados suficientes na base carregada para responder com precisão.\n\n";
    }

    const fullPrompt = context + userInput;

    const response = await getGeminiResponse(chatHistory, fullPrompt);
    const aiMsg: ChatMessage = { role: 'model', text: response };
    setChatHistory(prev => [...prev, aiMsg]);
    setIsAiLoading(false);
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
        <h2 className="text-xl font-bold text-white mb-2">EMAM Cloud Sync</h2>
        <p className="text-zinc-500 text-sm mb-8">Sincronizando seus ativos e manuais...</p>
        
        <div className="space-y-4 w-full">
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-sm font-bold"
          >
            RECARREGAR PÁGINA
          </button>
          <button 
            onClick={() => setIsLoadingData(false)}
            className="w-full py-3 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-xs font-bold"
          >
            CONTINUAR SEM NUVEM (MODO LOCAL)
          </button>
        </div>
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
        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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

          {/* Inventory */}
          {activeTab === 'inventory' && (
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
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="space-y-3">
                {assets.map(asset => (
                  <div 
                    key={asset.id} 
                    onClick={() => setSelectedAsset(asset)}
                    className={`dark-card cursor-pointer transition-all ${selectedAsset?.id === asset.id ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}
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
                      <ChevronRight size={14} className="text-zinc-700" />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* AI Diagnostic */}
          {activeTab === 'ai' && (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-[calc(100vh-180px)]"
            >
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {chatHistory.length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
                      <Cpu className="text-emerald-500" size={32} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg">IA Diagnostic</h3>
                      <p className="text-zinc-500 text-sm px-8">Especialista WEG pronto para ajudar com falhas e manutenção.</p>
                    </div>
                  </div>
                )}
                {chatHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.role === 'user' 
                        ? 'bg-emerald-500 text-black font-medium rounded-tr-none' 
                        : 'bg-zinc-900 border border-zinc-800 text-white rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-2xl rounded-tl-none flex gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex gap-2">
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Descreva a falha ou peça ajuda..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={isAiLoading || !userInput.trim()}
                  className="w-12 h-12 bg-emerald-500 text-black rounded-xl flex items-center justify-center disabled:opacity-50 active:scale-95 transition-all"
                >
                  <Send size={20} />
                </button>
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
                {/* SSW07 Section */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Soft Starter SSW07</h3>
                      <p className="text-xs text-zinc-500">Parâmetros Ouro para Partida Segura</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Acesso e Senha</h4>
                      <p className="text-sm text-zinc-300"><span className="font-mono text-white">P0009:</span> Ajustar para <span className="text-white">5</span> (Libera alteração)</p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Rampas e Partida</h4>
                        <ul className="text-xs space-y-2 text-zinc-400">
                          <li><span className="font-mono text-white">P0101:</span> Tensão Inicial (Padrão 40%)</li>
                          <li><span className="font-mono text-white">P0102:</span> Tempo Aceleração (Ex: 15s)</li>
                          <li><span className="font-mono text-white">P0104:</span> Tempo Desaceleração (0=Livre)</li>
                          <li><span className="font-mono text-white">P0202:</span> Tipo (0=Rampa, 1=Limite)</li>
                          <li><span className="font-mono text-white">P0219:</span> Controle IHM (Ajustar para 1)</li>
                        </ul>
                      </div>
                      <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Dados do Motor</h4>
                        <ul className="text-xs space-y-2 text-zinc-400">
                          <li><span className="font-mono text-white">P0400:</span> Tensão Nominal (220/380/440V)</li>
                          <li><span className="font-mono text-white">P0401:</span> Corrente Nominal (Amperes)</li>
                          <li><span className="font-mono text-white">P0406:</span> Fator de Serviço (Placa)</li>
                          <li><span className="font-mono text-white">P0640:</span> Classe Térmica (Proteção)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CFW500 Section */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                      <Activity className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Inversor CFW500</h3>
                      <p className="text-xs text-zinc-500">Parâmetros Ouro para Controle</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                      <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Acesso e Reset</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <p className="text-sm text-zinc-300"><span className="font-mono text-white">P0000:</span> Ajustar para <span className="text-white">5</span></p>
                        <p className="text-sm text-zinc-300"><span className="font-mono text-white">P0204:</span> Reset Fábrica (<span className="text-white">5</span>=60Hz)</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Dados do Motor (P04xx)</h4>
                        <ul className="text-xs space-y-2 text-zinc-400">
                          <li><span className="font-mono text-white">P0401:</span> Corrente Nominal (A)</li>
                          <li><span className="font-mono text-white">P0402:</span> Rotação Nominal (RPM)</li>
                          <li><span className="font-mono text-white">P0403:</span> Frequência Nominal (60Hz)</li>
                          <li><span className="font-mono text-white">P0404:</span> Potência Nominal (cv/kW)</li>
                          <li><span className="font-mono text-white">P0400:</span> Tensão Nominal (V)</li>
                        </ul>
                      </div>
                      <div className="bg-black/40 rounded-xl p-4 border border-zinc-800/50">
                        <h4 className="text-[10px] font-bold text-emerald-500 uppercase mb-2 tracking-widest">Operação e Controle</h4>
                        <ul className="text-xs space-y-2 text-zinc-400">
                          <li><span className="font-mono text-white">P0100:</span> Tempo Aceleração (s)</li>
                          <li><span className="font-mono text-white">P0101:</span> Tempo Desaceleração (s)</li>
                          <li><span className="font-mono text-white">P0202:</span> Controle (0=V/f, 5=VVW)</li>
                          <li><span className="font-mono text-white">P0221:</span> Ref. Local (IHM/Pot)</li>
                        </ul>
                      </div>
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

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Documentos Carregados ({knowledgeBase.length})</h4>
                {knowledgeBase.map(doc => (
                  <div key={doc.id} className="dark-card flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <FileText className="text-emerald-500" size={18} />
                      <div>
                        <p className="font-semibold text-sm truncate max-w-[180px]">{doc.name}</p>
                        <p className="text-[10px] text-zinc-500">{new Date(doc.uploadDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeDoc(doc.id)}
                      className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {knowledgeBase.length === 0 && (
                  <div className="text-center py-12 border border-zinc-900 rounded-3xl border-dashed">
                    <BookOpen className="mx-auto text-zinc-800 mb-2" size={32} />
                    <p className="text-zinc-600 text-sm italic">Nenhum documento carregado.</p>
                  </div>
                )}
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
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'ai' ? 'text-emerald-500' : 'text-zinc-600'}`}
        >
          <Cpu size={20} />
          <span className="text-[10px] font-bold">IA</span>
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
                      <option value="Motor">Motor / Bomba</option>
                      <option value="Inversor">Inversor (CFW500)</option>
                      <option value="Soft-Starter">Soft-Starter (SSW07)</option>
                      <option value="Compressor">Compressor Parafuso</option>
                      <option value="Quadro">Quadro Elétrico</option>
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
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Controle IHM (P0219)</label>
                          <input name="p0219" placeholder="Ajustar para 1" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Classe Térmica (P0640)</label>
                          <input name="p0640" placeholder="Ex: 10" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Limite de Corrente (P0110)</label>
                          <input name="p0110" placeholder="Ex: 300%" className="w-full bg-black border border-zinc-800 rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">Localização</label>
                  <input name="location" placeholder="Ex: Setor de Britagem" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>
                <button type="submit" className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl active:scale-95 transition-all">SALVAR ATIVO</button>
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
              className="bg-zinc-900 border border-zinc-800 w-full rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold">Checklist Técnico</h3>
                  <p className="text-xs text-emerald-500 font-bold uppercase">{selectedAsset.name}</p>
                </div>
                <button onClick={() => setIsChecklistModalOpen(false)} className="text-zinc-500 hover:text-white"><X size={24} /></button>
              </div>

              <form onSubmit={handleAddChecklist} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Técnico Responsável</label>
                  <input name="technician" required placeholder="Nome do técnico" className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                </div>

                {/* Dynamic Fields based on Type */}
                <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                  <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Medições Físicas / Parâmetros</h4>
                  
                  {selectedAsset.type === 'Inversor' && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Corrente de Saída (P0003) - Ampères</label>
                        <input name="p0003_current" required placeholder="Ex: 12.5" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                        <p className="text-[9px] text-zinc-600 italic">Variação &gt;10% indica problema mecânico.</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Tensão Link DC (P0004) - Volts</label>
                        <input name="p0004_link_dc" required placeholder="Padrão: 530V - 550V" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                  )}

                  {selectedAsset.type === 'Soft-Starter' && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Status (P006)</label>
                        <input name="p006_status" required placeholder="Ex: rdY, PASS ou Exx" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Corrente de Partida (Pico)</label>
                        <input name="starting_current_peak" required placeholder="Observar pico na partida" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                  )}

                  {selectedAsset.type === 'Motor' && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Pressão de Descarga (bar/psi)</label>
                        <input name="discharge_pressure" required placeholder="Ex: 6.5 bar" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Temperatura de Carcaça (°C)</label>
                        <input name="casing_temperature" required placeholder="Ex: 45°C" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Gotejamento Gaxeta</label>
                          <select name="gland_drip" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50">
                            <option>Normal (Gotas/min)</option>
                            <option>Excessivo</option>
                            <option>Seco (Risco)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Selo Mecânico</label>
                          <select name="mechanical_seal_leak" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50">
                            <option>Zero Vazamento</option>
                            <option>Com Vazamento</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedAsset.type === 'Compressor' && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Pressão Carga</label>
                          <input name="load_pressure" required placeholder="Ex: 7.0 bar" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase">Pressão Alívio</label>
                          <input name="unload_pressure" required placeholder="Ex: 8.5 bar" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Temperatura Unidade (°C)</label>
                        <input name="unit_temperature" required placeholder="Normal: 75°C - 95°C" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Dreno Condensado</label>
                        <select name="condensate_drain_oil" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50">
                          <option>Apenas Água (OK)</option>
                          <option>Presença de Óleo (Alerta)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedAsset.type === 'Quadro' && (
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Equilíbrio de Fases (V)</label>
                        <input name="phase_unbalance" required placeholder="Ex: 382V / 380V / 381V" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Temperatura Bornes (°C)</label>
                        <input name="terminal_temperature" required placeholder="Termografia ou toque seguro" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase">Status dos DPS</label>
                        <select name="dps_status" className="w-full bg-black border border-zinc-800 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-emerald-500/50">
                          <option>Verde (OK)</option>
                          <option>Vermelho (Substituir)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Observações Adicionais</label>
                  <textarea name="observations" rows={3} placeholder="Alguma anomalia ou ruído estranho?" className="w-full bg-black border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                </div>

                <button type="submit" className="w-full py-4 bg-emerald-500 text-black font-bold rounded-2xl active:scale-95 transition-all">FINALIZAR CHECKLIST</button>
              </form>
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
                    {[
                      { label: 'Tensão Inicial', key: 'p0101', param: 'P0101' },
                      { label: 'Tempo Acel.', key: 'p0102', param: 'P0102' },
                      { label: 'Tempo Desacel.', key: 'p0104', param: 'P0104' },
                      { label: 'Tipo Partida', key: 'p0202', param: 'P0202' },
                      { label: 'Controle IHM', key: 'p0219', param: 'P0219' },
                      { label: 'Classe Térmica', key: 'p0640', param: 'P0640' },
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
