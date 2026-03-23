-- MIGRATION PARA SUPABASE - PROJETO EMAM V4
-- Copie e cole este script no SQL Editor do seu painel Supabase

-- 1. Criar a tabela de ativos (assets)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Motor', 'Inversor', 'Soft-Starter', 'Quadro', 'Compressor', 'Outro')),
    model TEXT,
    serial_number TEXT,
    location TEXT,
    status TEXT NOT NULL CHECK (status IN ('Operacional', 'Alerta', 'Manutenção', 'Crítico')),
    technical_params JSONB DEFAULT '{}'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- 3. Criar políticas de segurança (Políticas de Usuário)
-- Permitir que usuários vejam apenas seus próprios ativos
CREATE POLICY "Usuários podem ver seus próprios ativos" 
ON public.assets FOR SELECT 
USING (auth.uid() = user_id);

-- Permitir que usuários insiram seus próprios ativos
CREATE POLICY "Usuários podem inserir seus próprios ativos" 
ON public.assets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Permitir que usuários atualizem seus próprios ativos
CREATE POLICY "Usuários podem atualizar seus próprios ativos" 
ON public.assets FOR UPDATE 
USING (auth.uid() = user_id);

-- Permitir que usuários excluam seus próprios ativos
CREATE POLICY "Usuários podem excluir seus próprios ativos" 
ON public.assets FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Criar índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON public.assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON public.assets(serial_number);

-- 5. Criar a tabela de checklists
CREATE TABLE IF NOT EXISTS public.checklists (
    id UUID PRIMARY KEY,
    asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE,
    date TIMESTAMPTZ DEFAULT NOW(),
    technician TEXT NOT NULL,
    -- Campos abaixo tornados opcionais para suportar o novo formato JSON em 'observations'
    vibration TEXT,
    temperature TEXT,
    noise TEXT,
    current_check TEXT,
    error_codes TEXT,
    observations TEXT, -- Agora armazena o objeto 'items' completo como JSON string
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para checklists
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

-- Políticas para checklists
CREATE POLICY "Usuários podem ver seus próprios checklists" ON public.checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir seus próprios checklists" ON public.checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem atualizar seus próprios checklists" ON public.checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem excluir seus próprios checklists" ON public.checklists FOR DELETE USING (auth.uid() = user_id);

-- 6. Criar a tabela de base de conhecimento (knowledge_base)
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS para knowledge_base
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Políticas para knowledge_base
CREATE POLICY "Usuários podem ver seus próprios documentos" ON public.knowledge_base FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuários podem inserir seus próprios documentos" ON public.knowledge_base FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários podem excluir seus próprios documentos" ON public.knowledge_base FOR DELETE USING (auth.uid() = user_id);

-- 7. Índices adicionais
CREATE INDEX IF NOT EXISTS idx_checklists_asset_id ON public.checklists(asset_id);
CREATE INDEX IF NOT EXISTS idx_checklists_user_id ON public.checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_user_id ON public.knowledge_base(user_id);
