import { CPLPCountry, CPLPCountryCode, RelationshipIntent, UserProfile } from './types';

export const CPLP_COUNTRIES: Record<CPLPCountryCode, CPLPCountry> = {
  AO: {
    code: 'AO',
    name: 'Angola',
    flag: '🇦🇴',
    capital: 'Luanda',
    defaultCities: ['Luanda', 'Benguela', 'Huambo', 'Lubango', 'Cabinda', 'Lobito', 'Malanje']
  },
  BR: {
    code: 'BR',
    name: 'Brasil',
    flag: '🇧🇷',
    capital: 'Brasília',
    defaultCities: ['São Paulo', 'Rio de Janeiro', 'Salvador', 'Brasília', 'Fortaleza', 'Belo Horizonte', 'Recife', 'Curitiba', 'Porto Alegre']
  },
  CV: {
    code: 'CV',
    name: 'Cabo Verde',
    flag: '🇨🇻',
    capital: 'Praia',
    defaultCities: ['Praia (Santiago)', 'Mindelo (São Vicente)', 'Santa Maria (Sal)', 'Espargos', 'Assomada']
  },
  GW: {
    code: 'GW',
    name: 'Guiné-Bissau',
    flag: '🇬🇼',
    capital: 'Bissau',
    defaultCities: ['Bissau', 'Bafatá', 'Gabú', 'Canchungo', 'Cacheu']
  },
  GQ: {
    code: 'GQ',
    name: 'Guiné Equatorial',
    flag: '🇬🇶',
    capital: 'Malabo',
    defaultCities: ['Malabo', 'Bata', 'Ebebiyín', 'Oyala', 'Mongomo']
  },
  MZ: {
    code: 'MZ',
    name: 'Moçambique',
    flag: '🇲🇿',
    capital: 'Maputo',
    defaultCities: ['Maputo', 'Matola', 'Beira', 'Nampula', 'Chimoio', 'Quelimane', 'Tete', 'Pemba']
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    capital: 'Lisboa',
    defaultCities: ['Lisboa', 'Porto', 'Coimbra', 'Braga', 'Faro (Algarve)', 'Funchal (Madeira)', 'Ponta Delgada (Açores)', 'Setúbal', 'Aveiro']
  },
  ST: {
    code: 'ST',
    name: 'São Tomé e Príncipe',
    flag: '🇸🇹',
    capital: 'São Tomé',
    defaultCities: ['São Tomé', 'Santo Amaro', 'Neves', 'Santana', 'Santo António (Príncipe)']
  },
  TL: {
    code: 'TL',
    name: 'Timor-Leste',
    flag: '🇹🇱',
    capital: 'Díli',
    defaultCities: ['Díli', 'Baucau', 'Maliana', 'Suai', 'Liquiçá', 'Lospalos']
  }
};

export const CPLP_COUNTRY_LIST: CPLPCountry[] = Object.values(CPLP_COUNTRIES);

export const RELATIONSHIP_INTENTS_CONFIG: {
  id: RelationshipIntent;
  label: string;
  description: string;
  iconName: string;
}[] = [
  {
    id: 'serious',
    label: 'Relacionamento Sério',
    description: 'Buscando uma conexão profunda e duradoura',
    iconName: 'HeartHandshake'
  },
  {
    id: 'dating',
    label: 'Namoro',
    description: 'Encontros românticos com interesse em construir algo bonito',
    iconName: 'Heart'
  },
  {
    id: 'marriage',
    label: 'Casamento',
    description: 'Compromisso de vida e formação de família',
    iconName: 'Sparkles'
  },
  {
    id: 'friendship',
    label: 'Amizade',
    description: 'Novas amizades, conversas e troca de experiências',
    iconName: 'Users'
  },
  {
    id: 'meet_people',
    label: 'Conhecer Pessoas',
    description: 'Conversar com pessoas do mundo lusófono com calma',
    iconName: 'Globe'
  }
];

export const NORMALIZED_INTERESTS: string[] = [
  'Música (Semba, Kizomba, Samba, Fado, Morna, Marrabenta)',
  'Viagens & Culturas',
  'Gastronomia Lusófona',
  'Futebol & Desporto',
  'Livros & Literatura',
  'Cinema & Séries',
  'Negócios & Empreendedorismo',
  'Família & Valores',
  'Espiritualidade & Fé',
  'Arte & Teatro',
  'Natureza & Praias',
  'Dança',
  'Tecnologia & Inovação',
  'Animais de Estimação',
  'Poesia & Escrita'
];

export const DEMO_LUSOFONE_PROFILES: UserProfile[] = [
  {
    uid: 'demo_marta_ao',
    displayName: 'Marta',
    age: 27,
    gender: 'woman',
    countryCode: 'AO',
    countryName: 'Angola',
    cityName: 'Luanda',
    intent: 'serious',
    interests: ['Música (Semba, Kizomba, Samba, Fado, Morna, Marrabenta)', 'Viagens & Culturas', 'Família & Valores'],
    bio: 'Apaixonada por música, boas conversas ao entardecer na Ilha de Luanda e curiosa para conectar com pessoas de toda a nossa grande comunidade lusófona.',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=700&auto=format&fit=crop&q=80',
    visibility: 'public',
    verificationStatus: 'verified',
    online: true,
    lastActive: Date.now() - 1000 * 60 * 5,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now()
  },
  {
    uid: 'demo_tiago_pt',
    displayName: 'Tiago',
    age: 30,
    gender: 'man',
    countryCode: 'PT',
    countryName: 'Portugal',
    cityName: 'Lisboa',
    intent: 'dating',
    interests: ['Gastronomia Lusófona', 'Livros & Literatura', 'Viagens & Culturas'],
    bio: 'Arquiteto em Lisboa. Gosto de cafés históricos, fado ao vivo, cozinhar para amigos e explorar a herança cultural que nos une nos vários cantos do mundo.',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&auto=format&fit=crop&q=80',
    visibility: 'public',
    verificationStatus: 'verified',
    online: true,
    lastActive: Date.now() - 1000 * 60 * 15,
    createdAt: Date.now() - 86400000 * 8,
    updatedAt: Date.now()
  },
  {
    uid: 'demo_camila_br',
    displayName: 'Camila',
    age: 26,
    gender: 'woman',
    countryCode: 'BR',
    countryName: 'Brasil',
    cityName: 'Salvador',
    intent: 'serious',
    interests: ['Dança', 'Música (Semba, Kizomba, Samba, Fado, Morna, Marrabenta)', 'Negócios & Empreendedorismo'],
    bio: 'Baiana com coração aberto para o mundo. Adoro dançar, ouvir ritmos africanos e brasileiros, e procuro alguém sincero para partilhar sonhos e boas risadas.',
    profilePhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=700&auto=format&fit=crop&q=80',
    visibility: 'public',
    verificationStatus: 'verified',
    online: false,
    lastActive: Date.now() - 1000 * 60 * 60 * 2,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now()
  },
  {
    uid: 'demo_antonio_mz',
    displayName: 'António',
    age: 29,
    gender: 'man',
    countryCode: 'MZ',
    countryName: 'Moçambique',
    cityName: 'Maputo',
    intent: 'serious',
    interests: ['Tecnologia & Inovação', 'Natureza & Praias', 'Música (Semba, Kizomba, Samba, Fado, Morna, Marrabenta)'],
    bio: 'Engenheiro de software e fotógrafo amador em Maputo. O mar da Ponta do Ouro recarrega minhas energias. Muito focado em crescimento mútuo e sinceridade.',
    profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&auto=format&fit=crop&q=80',
    visibility: 'public',
    verificationStatus: 'verified',
    online: true,
    lastActive: Date.now() - 1000 * 60 * 30,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now()
  },
  {
    uid: 'demo_ines_cv',
    displayName: 'Inês',
    age: 25,
    gender: 'woman',
    countryCode: 'CV',
    countryName: 'Cabo Verde',
    cityName: 'Mindelo (São Vicente)',
    intent: 'meet_people',
    interests: ['Música (Semba, Kizomba, Samba, Fado, Morna, Marrabenta)', 'Poesia & Escrita', 'Viagens & Culturas'],
    bio: 'Criada no som da Morna e do Colá San Jon. Amo literatura crioula e portuguesa. Adoro fazer amizades pelo mundo lusófono com respeito e leveza.',
    profilePhoto: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=700&auto=format&fit=crop&q=80',
    visibility: 'public',
    verificationStatus: 'verified',
    online: true,
    lastActive: Date.now() - 1000 * 60 * 8,
    createdAt: Date.now() - 86400000 * 3,
    updatedAt: Date.now()
  }
];
