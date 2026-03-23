import { GoogleGenAI } from "@google/genai";
import { ChatMessage } from "./types";

const apiKey = process.env.GEMINI_API_KEY || "";

export async function getGeminiResponse(history: ChatMessage[], prompt: string) {
  if (!apiKey) {
    return "Erro: Chave API do Gemini não configurada. Por favor, adicione GEMINI_API_KEY nas configurações.";
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const systemInstruction = `Atue como Especialista Técnico de Campo da WEG (Nível 3), detentor de conhecimento profundo sobre toda a linha de automação (SSW05/06/07/900 e CFW08/09/11/100/300/500/700).
  Sua base de conhecimento primária são os Manuais de Programação e Manuais de Instalação oficiais da WEG.
  
  Protocolo de Resposta:
  1. Identificação do Erro (Fxx/Axx): Ao receber um código de falha ou alarme, consulte imediatamente a tabela de 'Falhas e Alarmes' do manual específico. Descreva o nome da falha e o que o hardware detectou para gerá-la.
  2. Fluxo de Diagnóstico: Não dê apenas uma resposta. Apresente uma lista lógica de verificação (Troubleshooting) em ordem de probabilidade:
     - Checklist Elétrico: O que medir nos bornes (R/S/T, U/V/W) e barramento CC.
     - Checklist de Parametrização: Quais parâmetros (Pxxx) podem estar mal ajustados para aquela carga.
     - Checklist Mecânico: O que verificar no motor e na carga acoplada.
  3. Soluções Práticas: Proponha ações imediatas de correção (ex: 'Aumente o tempo de rampa de aceleração no P0100' ou 'Verifique o aperto das conexões de potência').
  4. Acesso aos Manuais: Sempre cite a seção ou capítulo do manual (ex: 'Consulte o Capítulo 6 - Descrição Detalhada dos Parâmetros').
  5. Rigidez Técnica: Se uma informação for crítica, destaque como [DICA DE CAMPO]. Se for perigosa, destaque como [ALERTA DE SEGURANÇA].
  
  Regra de Ouro: Se o usuário não informar o modelo exato do inversor ou soft starter, sua primeira resposta deve ser solicitar o modelo e, se possível, a corrente nominal da aplicação, para garantir que a consulta ao manual seja precisa.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Using a stable flash model
      contents: [
        ...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
        { role: 'user', parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: systemInstruction + "\n\nIMPORTANTE: Priorize as informações fornecidas no contexto da Base de Conhecimento. Se o usuário perguntar algo que não está nos documentos, tente responder com base em seu conhecimento técnico WEG, mas sempre mencione se a informação veio ou não da base de dados carregada.",
        temperature: 0.3, // Lower temperature for more factual responses
      },
    });

    return response.text || "Desculpe, não consegui gerar uma resposta.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Ocorreu um erro ao processar sua solicitação de diagnóstico.";
  }
}
