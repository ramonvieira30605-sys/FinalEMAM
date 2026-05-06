import { Asset, Checklist } from "../types";
import { AIAnalysisResult } from "./geminiService";

/**
 * Realiza uma análise heurística local (offline) baseada no histórico de inspeções.
 * Detecta recorrências, tendências e pontos críticos sem necessidade de API externa.
 */
export function analyzeAssetLocally(asset: Asset, history: Checklist[]): AIAnalysisResult {
  const proactiveStrategies: string[] = [];
  const potentialFailurePoints: string[] = [];
  let healthScore = 100;

  // 1. Analisar Recorrências de Não Conformidades (NC)
  const ncCounts: Record<string, number> = {};
  history.forEach(h => {
    h.items.forEach(item => {
      if (item.status === 'NC') {
        ncCounts[item.label] = (ncCounts[item.label] || 0) + 1;
        healthScore -= 10;
      }
    });
  });

  // Identificar itens críticos recorrentes
  Object.entries(ncCounts).forEach(([label, count]) => {
    if (count >= 2) {
      potentialFailurePoints.push(`Falha recorrente detectada em: "${label}" (${count} ocorrências no período).`);
      proactiveStrategies.push(`Realizar revisão técnica profunda no sistema de ${label.toLowerCase()}.`);
    } else {
      potentialFailurePoints.push(`Anomalia isolada em: "${label}".`);
    }
  });

  // 2. Analisar Tendência de Status
  if (asset.status === 'Alerta') {
    healthScore -= 20;
    proactiveStrategies.push("Aumentar frequência de monitoramento devido ao estado de ALERTA.");
  } else if (asset.status === 'Crítico') {
    healthScore -= 50;
    proactiveStrategies.push("PARADA PROGRAMADA RECOMENDADA para correção de falhas críticas.");
  }

  // 3. Analisar Frequência de Inspeção
  if (asset.inspectionFrequencyDays) {
    const lastDate = asset.lastChecklistDate || asset.createdAt;
    const daysSince = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSince > asset.inspectionFrequencyDays) {
      potentialFailurePoints.push(`Atraso na manutenção: ${daysSince} dias desde a última inspeção (Meta: ${asset.inspectionFrequencyDays} dias).`);
      proactiveStrategies.push("Normalizar o cronograma de inspeções para evitar falhas por falta de monitoramento.");
      healthScore -= 15;
    }
  }

  // 4. Estratégias Baseadas no Tipo de Ativo
  if (asset.type === 'Motor') {
    proactiveStrategies.push("Monitorar temperatura e vibração nos mancais.");
  } else if (asset.type === 'Quadro') {
    proactiveStrategies.push("Realizar termografia semestral para detectar pontos quentes.");
  }

  // 5. Gerar Resumo
  let summary = "";
  if (healthScore >= 80) {
    summary = `O ativo "${asset.name}" apresenta boas condições operacionais. As recomendações focam na manutenção preventiva padrão.`;
  } else if (healthScore >= 50) {
    summary = `Atenção: "${asset.name}" mostra sinais de degradação ou irregularidades no cronograma. Recomenda-se intervenção preventiva nas áreas citadas.`;
  } else {
    summary = `CRÍTICO: O histórico recente de "${asset.name}" indica alto risco de falha funcional. Intervenção imediata e revisão das estratégias de manutenção são necessárias.`;
  }

  // Limitar resultados se vazios
  if (potentialFailurePoints.length === 0) potentialFailurePoints.push("Nenhuma falha crítica detectada no histórico recente.");
  if (proactiveStrategies.length === 0) proactiveStrategies.push("Manter rotina de inspeção periódica conforme manual.");

  return {
    proactiveStrategies: Array.from(new Set(proactiveStrategies)),
    potentialFailurePoints: Array.from(new Set(potentialFailurePoints)),
    summary
  };
}
