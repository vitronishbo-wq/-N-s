import {
  UserProfile,
  InteractionSignals,
  DiscoveryCandidate,
  RelationshipIntent,
  CPLPCountryCode
} from '../types';

export type CommunicationStyle = 'reflective' | 'expressive' | 'direct' | 'warm';
export type ConversationalDepth = 'light' | 'moderate' | 'deep';

export interface ConnectionGraphNode {
  uid: string;
  countryCode: CPLPCountryCode;
  cityName: string;
  intent: RelationshipIntent;
  interests: string[];
  communicationStyle: CommunicationStyle;
  conversationalDepth: ConversationalDepth;
  responsivenessScore: number; // 0.0 - 1.0
  culturalBridgeAperture: number; // 0.0 - 1.0
}

export interface ConnectionGraphEdge {
  sourceUid: string;
  targetUid: string;
  reciprocityScore: number;
  communicationResonance: number;
  culturalSynergy: number;
  complementaryBalance: number;
  compositeSynergy: number;
  insights: string[];
}

/**
 * 3.8, 3.9, 3.10, 3.11: Human Connection Graph (In-Memory Topology Overlay)
 * Models communication preference, reciprocity, conversational depth, initiative,
 * humor, cultural compatibility, and complementary differences purely from existing signals.
 */
export class HumanConnectionGraph {
  private static instance: HumanConnectionGraph;

  public static getInstance(): HumanConnectionGraph {
    if (!HumanConnectionGraph.instance) {
      HumanConnectionGraph.instance = new HumanConnectionGraph();
    }
    return HumanConnectionGraph.instance;
  }

  /**
   * 3.10 & 3.11: Infer communication style without burdensome questionnaires
   */
  public inferCommunicationStyle(profile: UserProfile, signals?: InteractionSignals): CommunicationStyle {
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const hasManyInterests = profile.interests.length >= 4;
    const isHighInitiative = (signals?.conversationStarts || 0) > 3;

    if (profile.interests.includes('Literatura') || profile.interests.includes('História & Lusofonia')) {
      if (bioLength > 40) return 'reflective';
    }
    if (isHighInitiative || profile.interests.includes('Dança & Ritmos') || profile.interests.includes('Festivais & Eventos')) {
      return 'expressive';
    }
    if (profile.interests.includes('Música Lusófona') && !profile.interests.includes('Literatura')) {
      return 'expressive';
    }
    if (profile.intent === 'serious' && bioLength > 50) {
      return 'warm';
    }
    if (bioLength < 40 && hasManyInterests) {
      return 'direct';
    }
    return 'warm';
  }

  /**
   * 3.10: Infer conversational depth
   */
  public inferConversationalDepth(profile: UserProfile, signals?: InteractionSignals): ConversationalDepth {
    const bioLength = profile.bio ? profile.bio.trim().length : 0;
    const meaningfulCount = signals?.meaningfulInteractions || 0;

    if (meaningfulCount >= 2 || bioLength > 100) {
      return 'deep';
    }
    if (bioLength > 35 || profile.interests.length >= 3) {
      return 'moderate';
    }
    return 'light';
  }

  /**
   * 3.8 & 3.9: Create a normalized Graph Node for a user
   */
  public createNode(profile: UserProfile, signals?: InteractionSignals): ConnectionGraphNode {
    const communicationStyle = this.inferCommunicationStyle(profile, signals);
    const conversationalDepth = this.inferConversationalDepth(profile, signals);

    const totalActions = (signals?.totalLikesGiven || 0) + (signals?.totalPassesGiven || 0);
    const likeRatio = totalActions > 0 ? (signals?.totalLikesGiven || 0) / totalActions : 0.5;
    const responsivenessScore = Math.min(1.0, 0.4 + likeRatio * 0.4 + (profile.online ? 0.2 : 0));

    const likedCountriesCount = Object.keys(signals?.likedCountries || {}).length;
    const culturalBridgeAperture = Math.min(1.0, 0.5 + (likedCountriesCount * 0.15));

    return {
      uid: profile.uid,
      countryCode: profile.countryCode,
      cityName: profile.cityName,
      intent: profile.intent,
      interests: profile.interests,
      communicationStyle,
      conversationalDepth,
      responsivenessScore,
      culturalBridgeAperture
    };
  }

  /**
   * 3.8, 3.9, 3.10: Evaluate Graph Edge between two nodes
   */
  public evaluateEdge(
    nodeA: ConnectionGraphNode,
    nodeB: ConnectionGraphNode
  ): ConnectionGraphEdge {
    // 1. Communication Resonance (Styles that synergize well)
    let communicationResonance = 0.7;
    if (nodeA.communicationStyle === nodeB.communicationStyle) {
      communicationResonance = 0.95;
    } else if (
      (nodeA.communicationStyle === 'reflective' && nodeB.communicationStyle === 'warm') ||
      (nodeA.communicationStyle === 'warm' && nodeB.communicationStyle === 'reflective') ||
      (nodeA.communicationStyle === 'expressive' && nodeB.communicationStyle === 'warm')
    ) {
      communicationResonance = 0.90;
    } else if (nodeA.communicationStyle === 'direct' && nodeB.communicationStyle === 'reflective') {
      communicationResonance = 0.65;
    }

    // 2. Depth Harmony
    if (nodeA.conversationalDepth === nodeB.conversationalDepth) {
      communicationResonance += 0.05;
    }

    // 3. Cultural Synergy
    const isCrossCountry = nodeA.countryCode !== nodeB.countryCode;
    const culturalSynergy = isCrossCountry
      ? Math.min(1.0, (nodeA.culturalBridgeAperture + nodeB.culturalBridgeAperture) / 2 + 0.2)
      : 0.85;

    // 4. Complementary Balance (Distinct interests that broaden perspectives)
    const shared = nodeA.interests.filter(i => nodeB.interests.includes(i));
    const different = nodeB.interests.filter(i => !nodeA.interests.includes(i));
    const complementaryBalance = Math.min(1.0, (shared.length * 0.2) + (different.length * 0.15) + (nodeA.intent === nodeB.intent ? 0.3 : 0.1));

    // 5. Reciprocity estimation
    const reciprocityScore = (nodeA.responsivenessScore + nodeB.responsivenessScore) / 2;

    const compositeSynergy = Math.min(
      1.0,
      communicationResonance * 0.30 +
      culturalSynergy * 0.25 +
      complementaryBalance * 0.25 +
      reciprocityScore * 0.20
    );

    const insights: string[] = [];
    if (communicationResonance > 0.85) {
      insights.push(`Ressonância comunicativa natural (${nodeA.communicationStyle} ↔ ${nodeB.communicationStyle})`);
    }
    if (isCrossCountry) {
      insights.push(`Ponte viva de abertura cultural entre ${nodeA.cityName} e ${nodeB.cityName}`);
    }
    if (different.length > 0) {
      insights.push(`Diferenças complementares com partilha de novos temas (${different.slice(0, 2).join(', ')})`);
    }

    return {
      sourceUid: nodeA.uid,
      targetUid: nodeB.uid,
      reciprocityScore,
      communicationResonance,
      culturalSynergy,
      complementaryBalance,
      compositeSynergy,
      insights
    };
  }

  /**
   * 3.10: Enrich candidate with Graph Synergies
   */
  public enrichCandidate(
    candidate: DiscoveryCandidate,
    myProfile: UserProfile,
    mySignals?: InteractionSignals
  ): DiscoveryCandidate {
    const nodeA = this.createNode(myProfile, mySignals);
    const nodeB = this.createNode(candidate.profile);
    const edge = this.evaluateEdge(nodeA, nodeB);

    return {
      ...candidate,
      confidence: Math.min(1.0, (candidate.confidence || 0.8) + (edge.compositeSynergy * 0.1))
    };
  }
}

export const connectionGraph = HumanConnectionGraph.getInstance();
