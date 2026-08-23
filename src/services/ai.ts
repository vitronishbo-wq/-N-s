import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiInstance && process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiInstance;
}

/**
 * 4.25.1: Compatibility Explanation (Selective value-add)
 */
export async function explainCompatibility(
  myProfile: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] },
  targetProfile: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] }
): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return `Sintonia autêntica entre ${myProfile.cityName} (${myProfile.countryName}) e ${targetProfile.cityName} (${targetProfile.countryName}), compartilhando interesses mútuos na lusofonia.`;
  }

  try {
    const prompt = `Você é o consultor cultural de relacionamentos do app ÉNós (comunidade CPLP: Angola, Brasil, Cabo Verde, Guiné-Bissau, Guiné Equatorial, Moçambique, Portugal, São Tomé e Príncipe, Timor-Leste).
Explique em 1 a 2 frases curtas, calorosas e elegantes em português, por que estas duas pessoas têm afinidade cultural e humana:
Usuário 1: ${myProfile.displayName}, de ${myProfile.cityName} (${myProfile.countryName}), busca ${myProfile.intent}, gosta de: ${myProfile.interests.join(', ')}.
Usuário 2: ${targetProfile.displayName}, de ${targetProfile.cityName} (${targetProfile.countryName}), busca ${targetProfile.intent}, gosta de: ${targetProfile.interests.join(', ')}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || `Excelente harmonia e objetivos alinhados entre ${myProfile.countryName} e ${targetProfile.countryName}.`;
  } catch (error) {
    console.error('Gemini compatibility error:', error);
    return `Excelente harmonia e objetivos alinhados entre ${myProfile.countryName} e ${targetProfile.countryName}.`;
  }
}

/**
 * 4.25.2: Profile Bio Assistance
 */
export async function assistBioCreation(
  interests: string[],
  intent: string,
  countryName: string,
  cityName: string
): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    return `Apaixonado por conversas significativas e cultura lusófona em ${cityName}, buscando conexões genuínas.`;
  }

  try {
    const prompt = `Escreva uma biografia cativante, autêntica e elegante de 2 frases em primeira pessoa para um perfil no aplicativo de relacionamentos lusófono ÉNós.
Cidade/País: ${cityName}, ${countryName}
Objetivo: ${intent}
Interesses: ${interests.join(', ')}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || `Apaixonado por boas conversas e novas conexões lusófonas em ${cityName}.`;
  } catch (error) {
    console.error('Gemini bio assist error:', error);
    return `Apaixonado por boas conversas e novas conexões lusófonas em ${cityName}.`;
  }
}

/**
 * 4.25.3: Conversation Icebreaker Assistance
 */
export async function assistConversationIcebreaker(
  sharedInterests: string[],
  userACity: string,
  userBCity: string
): Promise<string[]> {
  const ai = getAiClient();
  if (!ai) {
    return [
      `Olá! Notei que também aprecias ${sharedInterests[0] || 'música e cultura lusófona'}. Como vai o seu dia?`,
      `Que prazer conectar com alguém de ${userBCity}! O que mais te apaixona na tua rotina?`,
      `Olá! Adorei a nossa sintonia aqui no ÉNós. Vamos trocar ideias?`
    ];
  }

  try {
    const prompt = `Gere 3 sugestões curtas de quebra-gelo respeitosas e envolventes em português para iniciar conversa entre pessoas de ${userACity} e ${userBCity}, com interesses em comum: ${sharedInterests.join(', ')}. Responda como uma lista de 3 frases curtas separadas por quebra de linha.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const lines = response.text?.split('\n').filter(l => l.trim().length > 0).map(l => l.replace(/^\d+[\.\-\)]\s*/, '').trim()) || [];
    return lines.slice(0, 3);
  } catch (e) {
    return [
      `Olá! Notei a nossa sintonia em ${sharedInterests[0] || 'cultura lusófona'}.`,
      `Que bom conectar com ${userBCity}! Como tem sido a sua semana?`
    ];
  }
}

/**
 * 4.25.4: Text Moderation Check
 */
export async function moderateContent(text: string): Promise<{ isSafe: boolean; reason?: string }> {
  // Simple deterministic offensive words blacklist first
  const offensive = ['fraude', 'golpe', 'ofensa_grave'];
  const hasOffensive = offensive.some(term => text.toLowerCase().includes(term));
  if (hasOffensive) {
    return { isSafe: false, reason: 'Linguagem ou conteúdo não compatível com as regras da comunidade.' };
  }
  return { isSafe: true };
}
