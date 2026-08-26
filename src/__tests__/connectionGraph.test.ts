import { describe, it, expect } from 'vitest';
import { HumanConnectionGraph, connectionGraph } from '../services/connectionGraph';
import { UserProfile, InteractionSignals } from '../types';

describe('Human Connection Graph & Topology (3.8, 3.9, 3.10, 3.11)', () => {
  const profileA: UserProfile = {
    uid: 'user_lisboa',
    displayName: 'Tiago',
    age: 29,
    gender: 'man',
    intent: 'serious',
    interests: ['Música Lusófona', 'Literatura', 'Gastronomia'],
    bio: 'Leitor ávido, apaixonado pela cultura lusófona e conversas que tocam o coração.',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
    countryCode: 'PT',
    countryName: 'Portugal',
    cityName: 'Lisboa',
    verificationStatus: 'verified',
    visibility: 'public',
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const profileB: UserProfile = {
    uid: 'user_salvador',
    displayName: 'Aline',
    age: 27,
    gender: 'woman',
    intent: 'serious',
    interests: ['Música Lusófona', 'Dança & Ritmos', 'Empreendedorismo'],
    bio: 'Sempre em movimento, conectando arte e novos projetos.',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
    countryCode: 'BR',
    countryName: 'Brasil',
    cityName: 'Salvador',
    verificationStatus: 'verified',
    visibility: 'public',
    online: true,
    lastActive: Date.now(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('should infer reflective communication style for literary deep bio', () => {
    const style = connectionGraph.inferCommunicationStyle(profileA);
    expect(style).toBe('reflective');
  });

  it('should infer expressive communication style for music/dance profiles', () => {
    const style = connectionGraph.inferCommunicationStyle(profileB);
    expect(style).toBe('expressive');
  });

  it('should evaluate edge resonance, cultural synergy and complementary balance', () => {
    const nodeA = connectionGraph.createNode(profileA);
    const nodeB = connectionGraph.createNode(profileB);

    const edge = connectionGraph.evaluateEdge(nodeA, nodeB);

    expect(edge.compositeSynergy).toBeGreaterThan(0.6);
    expect(edge.culturalSynergy).toBeGreaterThan(0.5);
    expect(edge.complementaryBalance).toBeGreaterThan(0.3);
    expect(edge.insights.length).toBeGreaterThan(0);
  });
});
