// 4.15 & 4.16: AI Service Adapters & Domain Contracts

import {
  AIProfileAssistant,
  AICompatibilityExplainer,
  AIConversationAssistant,
  AIContentAssistant
} from '../types';

export interface CompatibilityInsightRequest {
  myProfile: {
    displayName: string;
    countryName: string;
    cityName: string;
    intent: string;
    interests: string[];
  };
  targetProfile: {
    displayName: string;
    countryName: string;
    cityName: string;
    intent: string;
    interests: string[];
  };
}

export interface CompatibilityInsightResponse {
  explanation: string;
  source: 'ai' | 'fallback';
}

export interface BioAssistRequest {
  interests: string[];
  intent: string;
  countryName: string;
  cityName: string;
}

export interface BioAssistResponse {
  bio: string;
  source: 'ai' | 'fallback';
}

export interface IcebreakersRequest {
  sharedInterests: string[];
  userACity: string;
  userBCity: string;
}

export interface IcebreakersResponse {
  icebreakers: string[];
  source: 'ai' | 'fallback';
}

export interface ContentModerationRequest {
  text: string;
}

export interface ContentModerationResponse {
  isSafe: boolean;
  reason?: string;
}

export interface IAiServiceAdapter
  extends AIProfileAssistant,
    AICompatibilityExplainer,
    AIConversationAssistant,
    AIContentAssistant {
  explainCompatibility(req: CompatibilityInsightRequest): Promise<CompatibilityInsightResponse>;
  assistBio(req: BioAssistRequest): Promise<BioAssistResponse>;
  suggestIcebreakers(req: IcebreakersRequest): Promise<IcebreakersResponse>;
  moderateText(req: ContentModerationRequest): Promise<ContentModerationResponse>;
}

/**
 * 4.16: Unified Client AI Adapter that cleanly implements all 4 domain AI contracts:
 * - AIProfileAssistant (generateBio)
 * - AICompatibilityExplainer (explainAffinity)
 * - AIConversationAssistant (generateIcebreakers)
 * - AIContentAssistant (moderate)
 */
export class ClientAiAdapter implements IAiServiceAdapter {
  private static instance: ClientAiAdapter;

  private constructor() {}

  public static getInstance(): ClientAiAdapter {
    if (!ClientAiAdapter.instance) {
      ClientAiAdapter.instance = new ClientAiAdapter();
    }
    return ClientAiAdapter.instance;
  }

  // Contract: AIProfileAssistant
  async generateBio(promptData: {
    interests: string[];
    intent: string;
    countryName: string;
    cityName: string;
  }): Promise<string> {
    const res = await this.assistBio(promptData);
    return res.bio;
  }

  // Contract: AICompatibilityExplainer
  async explainAffinity(data: {
    userA: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] };
    userB: { displayName: string; countryName: string; cityName: string; intent: string; interests: string[] };
  }): Promise<string> {
    const res = await this.explainCompatibility({
      myProfile: data.userA,
      targetProfile: data.userB
    });
    return res.explanation;
  }

  // Contract: AIConversationAssistant
  async generateIcebreakers(context: {
    sharedInterests: string[];
    userACity: string;
    userBCity: string;
  }): Promise<string[]> {
    const res = await this.suggestIcebreakers(context);
    return res.icebreakers;
  }

  // Contract: AIContentAssistant
  async moderate(content: string): Promise<{ isSafe: boolean; reason?: string }> {
    return await this.moderateText({ text: content });
  }

  // Adapter implementation for compatibility
  async explainCompatibility(req: CompatibilityInsightRequest): Promise<CompatibilityInsightResponse> {
    try {
      const res = await fetch('/api/ai/compatibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return {
        explanation: data.explanation || `Sintonia autêntica entre ${req.myProfile.countryName} e ${req.targetProfile.countryName}.`,
        source: 'ai'
      };
    } catch {
      return {
        explanation: `Sintonia autêntica e harmonia cultural entre ${req.myProfile.cityName} (${req.myProfile.countryName}) e ${req.targetProfile.cityName} (${req.targetProfile.countryName}).`,
        source: 'fallback'
      };
    }
  }

  // Adapter implementation for bio assistance
  async assistBio(req: BioAssistRequest): Promise<BioAssistResponse> {
    try {
      const res = await fetch('/api/ai/bio-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return {
        bio: data.bio || `Apaixonado por conversas autênticas e cultura lusófona em ${req.cityName}.`,
        source: 'ai'
      };
    } catch {
      return {
        bio: `Apaixonado por conversas autênticas e cultura lusófona em ${req.cityName}, buscando conexões reais.`,
        source: 'fallback'
      };
    }
  }

  // Adapter implementation for conversation icebreakers
  async suggestIcebreakers(req: IcebreakersRequest): Promise<IcebreakersResponse> {
    try {
      const res = await fetch('/api/ai/icebreakers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      return {
        icebreakers: data.icebreakers && data.icebreakers.length > 0 ? data.icebreakers : [
          `Olá! Notei nossa afinidade com ${req.sharedInterests[0] || 'a comunidade lusófona'}. Como vai seu dia?`,
          `Que alegria encontrar alguém de ${req.userBCity}! Vamos conversar?`
        ],
        source: 'ai'
      };
    } catch {
      return {
        icebreakers: [
          `Olá! Notei nossa afinidade em ${req.sharedInterests[0] || 'música e cultura'}. Como está sendo a sua semana?`,
          `Que prazer conectar com alguém de ${req.userBCity}! O que mais te encanta na sua rotina?`,
          `Olá! Adorei a nossa sintonia no ÉNós. Vamos trocar ideias?`
        ],
        source: 'fallback'
      };
    }
  }

  // Adapter implementation for content moderation
  async moderateText(req: ContentModerationRequest): Promise<ContentModerationResponse> {
    try {
      const res = await fetch('/api/moderation/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch {
      const offensive = ['fraude', 'golpe', 'ofensa_grave'];
      const hasOffensive = offensive.some(term => req.text.toLowerCase().includes(term));
      return hasOffensive
        ? { isSafe: false, reason: 'Linguagem não compatível com as regras da comunidade.' }
        : { isSafe: true };
    }
  }
}

export const defaultAiAdapter = ClientAiAdapter.getInstance();
