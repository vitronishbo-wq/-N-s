import { UserProfile } from '../types';

export interface ProfileImprovementItem {
  id: string;
  title: string;
  description: string;
  points: number; // percentual de pontos
  completed: boolean;
  actionText: string;
  category: 'essential' | 'identity' | 'culture' | 'trust';
}

export interface ProfileCompletenessResult {
  score: number; // 0 a 100
  level: 'iniciante' | 'em_desenvolvimento' | 'atraente' | 'magnete';
  levelLabel: string;
  color: string;
  items: ProfileImprovementItem[];
  completedCount: number;
  totalCount: number;
  multiplierText: string;
}

/**
 * Calcula o percentual de aperfeiçoamento do perfil com base em critérios objetivos e culturais CPLP
 */
export function calculateProfileCompleteness(profile: Partial<UserProfile> | null | undefined): ProfileCompletenessResult {
  if (!profile) {
    return {
      score: 0,
      level: 'iniciante',
      levelLabel: 'Recém-chegado',
      color: 'stone',
      items: [],
      completedCount: 0,
      totalCount: 0,
      multiplierText: 'Complete o perfil para receber matches'
    };
  }

  const hasName = Boolean(profile.displayName && profile.displayName.trim().length >= 2);
  const hasLocation = Boolean(profile.countryCode && profile.cityName);
  const hasIntent = Boolean(profile.intent);
  const hasMainPhoto = Boolean(
    profile.profilePhoto &&
    !profile.profilePhoto.includes('placeholder') &&
    profile.profilePhoto.trim().length > 0
  );
  const hasBio = Boolean(profile.bio && profile.bio.trim().length >= 25);
  const hasInterests = Boolean(profile.interests && profile.interests.length >= 3);
  const hasMultiplePhotos = Boolean(profile.photos && profile.photos.length >= 2);
  const hasVoiceBio = Boolean(profile.bio && (profile.bio.length > 80 || profile.interests && profile.interests.length >= 4));
  const isVerified = profile.verificationStatus === 'verified';

  const items: ProfileImprovementItem[] = [
    {
      id: 'name_age',
      title: 'Nome e Idade',
      description: 'Como os outros membros te reconhecem',
      points: 15,
      completed: hasName && (profile.age ? profile.age >= 18 : false),
      actionText: 'Definir nome',
      category: 'essential'
    },
    {
      id: 'location',
      title: 'Raízes e Localização',
      description: 'País e cidade de conexão CPLP',
      points: 15,
      completed: hasLocation,
      actionText: 'Definir localização',
      category: 'essential'
    },
    {
      id: 'intent',
      title: 'Intenção Relacional Clara',
      description: 'O que você busca na comunidade',
      points: 10,
      completed: hasIntent,
      actionText: 'Escolher intenção',
      category: 'essential'
    },
    {
      id: 'main_photo',
      title: 'Foto de Rosto Autêntica',
      description: 'A primeira impressão é decisiva',
      points: 20,
      completed: hasMainPhoto,
      actionText: 'Adicionar foto',
      category: 'identity'
    },
    {
      id: 'bio',
      title: 'Biografia com Alma',
      description: 'Pelo menos 25 caracteres sobre você',
      points: 10,
      completed: hasBio,
      actionText: 'Escrever bio',
      category: 'identity'
    },
    {
      id: 'interests',
      title: '3 ou mais Interesses Culturais',
      description: 'Música, culinária, viagens e paixões',
      points: 10,
      completed: hasInterests,
      actionText: 'Escolher interesses',
      category: 'culture'
    },
    {
      id: 'multiple_photos',
      title: 'Galeria de Momentos (2+ fotos)',
      description: 'Mostre seu estilo de vida e sorriso',
      points: 10,
      completed: hasMultiplePhotos,
      actionText: 'Adicionar fotos',
      category: 'culture'
    },
    {
      id: 'verification',
      title: 'Selo de Autenticidade / Verificação',
      description: 'Gera confiança máxima e destaque prioritário',
      points: 10,
      completed: isVerified,
      actionText: 'Verificar perfil',
      category: 'trust'
    }
  ];

  const score = items.reduce((acc, item) => item.completed ? acc + item.points : acc, 0);
  const completedCount = items.filter(i => i.completed).length;

  let level: ProfileCompletenessResult['level'] = 'iniciante';
  let levelLabel = 'Recém-chegado';
  let color = 'rose';
  let multiplierText = 'Perfis acima de 70% geram 3x mais ligações mútuas';

  if (score >= 90) {
    level = 'magnete';
    levelLabel = 'Perfil Magnético ✨';
    color = 'amber';
    multiplierText = 'Destaque prioritário e máxima visibilidade na CPLP';
  } else if (score >= 70) {
    level = 'atraente';
    levelLabel = 'Perfil Atraente 💫';
    color = 'emerald';
    multiplierText = 'Excelente! Recebes 3x mais interesse da comunidade';
  } else if (score >= 40) {
    level = 'em_desenvolvimento';
    levelLabel = 'Em Construção 🌱';
    color = 'blue';
    multiplierText = 'Adiciona mais detalhes para dobrar as tuas conexões';
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    level,
    levelLabel,
    color,
    items,
    completedCount,
    totalCount: items.length,
    multiplierText
  };
}
