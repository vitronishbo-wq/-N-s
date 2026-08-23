# Documentação Técnica da Arquitetura — ÉNós (CPLP)

## 1. Visão Geral da Arquitetura

O **ÉNós** é uma plataforma de relacionamentos e conexões interculturais voltada para a comunidade dos 9 países da CPLP (**Angola, Brasil, Cabo Verde, Guiné-Bissau, Guiné Equatorial, Moçambique, Portugal, São Tomé e Príncipe, Timor-Leste**).

---

## 2. Pipeline de Descoberta (Discovery Engine)

O fluxo de descoberta opera em 7 fases explícitas e desacopladas:

1. **Candidate Pool**: Perfis elegíveis ativos em toda a lusofonia.
2. **Eligibility Layer**: Exclusão estrita e eficiente de:
   - O próprio usuário (`self`);
   - Perfis bloqueados ou denunciados;
   - Perfis com ação prévia (`likedCandidateUids`, `passedCandidateUids`);
   - Perfis em janela de recência (`recentlySeenTimestamps`);
   - Perfis com visibilidade oculta (`hidden` / `incognito`);
   - Filtros de idade e país (quando `crossCultural` estiver inativo).
3. **Deterministic Score**: Algoritmo determinístico baseado em alinhamento de intenções, interesses em comum, proximidade geográfica/cultural e faixa etária.
4. **Context Score**: Bonificação de contexto para usuários online, perfis verificados e completude biográfica.
5. **Novelty & Diversity Balancing**: Balanceamento que previne monopólio de um único país nos primeiros resultados quando a exploração intercultural está ativada.
6. **Ranking**: Ordenação ponderada e determinística.
7. **Explainability**: Saída estruturada do `CompatibilityResult` com razões explícitas, afinidade cultural e nível de confiança.

---

## 3. Entidades de Domínio & Contratos Compartilhados

- `UserProfile`: Dados públicos e biografia do usuário.
- `UserPreferences`: Filtros de busca, intenção, idade e escopo intercultural.
- `PrivacySettings`: Visibilidade, status online e localização aproximada.
- `InteractionSignals`: Telemetria incremental e eventos de ciclo de vida (`firstCandidateShown`, `firstLike`, `firstMatch`, `firstConversation`, `activated`).
- `DiscoveryContext`: Contexto em tempo real da sessão de busca.
- `DiscoveryCandidate`: Candidato com scores, razões e explicabilidade.
- `CompatibilityResult`: Objeto formal de resultado de afinidade.

---

## 4. Gestão de Ativação & FirstConnectionMoment

- **FirstConnectionMoment**: Registrado no exato momento do primeiro match mútuo.
- **Ativação Real**: Mensurada de forma leve quando o usuário inicia a sua primeira conversa, sinalizando engajamento verdadeiro.

---

## 5. Regras de Segurança (Firestore Rules)

- Acesso isolado por participante e proprietário (`isOwner(userId)`, `isParticipant(data)`).
- Metadados de mídia protegidos com validação de tamanho e tipo mime.
- Conversas e mensagens restritas aos participantes diretos.

---

## 6. Automação de Qualidade (CI / Testes)

- `npm run typecheck` (Validação estrita de tipos TypeScript)
- `npm test` (Suite Vitest cobrindo matching, exclusões, contratos e ciclo de vida)
- `npm run build` (Build de produção via Vite e esbuild para Node CommonJS)
