# CPLP Relacionamentos - ÉNós

## Visão da Arquitetura (V1.0)
- **Frontend**: React + TypeScript + Tailwind CSS (Vite, PWA ready, mobile-first, light-first)
- **Backend / Server APIs**: Express API servindo rotas seguras para AI match explanation, profile bio assist e moderação
- **Banco de Dados (Source of Truth)**: Cloud Firestore
- **Autenticação**: Firebase Authentication (Anônima rápida com vinculação futura de e-mail/credenciais)
- **Mídia**: Firebase Storage + compressão local client-side WebP/Canvas

## Princípio Fundamental
**Poucos elementos na superfície, muita inteligência por baixo.**
- Abas principais: **Descobrir**, **Conversas**, **Perfil**.
- Fluxo de Onboarding relâmpago de 4 etapas: Nome -> Localização CPLP -> Intenção -> Interesses.
- Matching determinístico de alta performance com IA Gemini invisível para enriquecimento e explicações de compatibilidade lusófona intercultural.
