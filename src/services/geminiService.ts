import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Asset, Checklist } from "../types";

let aiClient: GoogleGenerativeAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Chave de API Gemini não configurada.");
    }
    aiClient = new GoogleGenerativeAI(apiKey);
  }
  return aiClient;
}

export interface AIAnalysisResult {
  proactiveStrategies: string[];
  potentialFailurePoints: string[];
  summary: string;
}

export async function analyzeAssetHistory(asset: Asset, history: Checklist[]): Promise<AIAnalysisResult> {
  const client = getAiClient();
  const model = "gemini-3-flash-preview";
  
  const historyPrompt = history.map(h => {
    const ncItems = h.items.filter(i => i.status === 'NC').map(i => `${i.label}: ${i.ncDescription || 'Sem descrição'}`);
    return `Data: ${h.date}, Status Equipamento: ${h.equipmentStatus}, Itens NC: [${ncItems.join('; ')}]`;
  }).join('\n');

  const systemInstruction = `Você é um especialista em manutenção industrial preditiva. 
Analise o histórico de inspeções do ativo e forneça:
1. Estratégias de manutenção proativa.
2. Pontos de falha potenciais baseados em recorrências ou criticidade.
3. Um resumo executivo da saúde do ativo.

Responda em formato JSON.`;

  const prompt = `Ativo: ${asset.name}
Tipo: ${asset.type}
Localização: ${asset.location}
Modelo: ${asset.model}

Histórico de Inspeções:
${historyPrompt || 'Nenhum histórico disponível.'}`;

  try {
    const generativeModel = client.getGenerativeModel({
      model,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }]
      }
    });

    const response = await generativeModel.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            proactiveStrategies: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Lista de estratégias de manutenção proativa recomendadas."
            },
            potentialFailurePoints: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Lista de possíveis pontos de falha identificados."
            },
            summary: {
              type: SchemaType.STRING,
              description: "Resumo executivo da saúde e tendências do ativo."
            }
          },
          required: ["proactiveStrategies", "potentialFailurePoints", "summary"]
        }
      }
    });

    const result = JSON.parse(response.response.text() || "{}");
    return result as AIAnalysisResult;
  } catch (error) {
    console.error("Erro na análise IA:", error);
    throw new Error("Falha ao analisar histórico do ativo com IA.");
  }
}
