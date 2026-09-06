import {
  db,
  auth,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  OperationType,
  handleFirestoreError
} from '../firebase/config';
import { UserProfile, Conversation, ChatMessage } from '../types';
import { DEMO_LUSOFONE_PROFILES } from '../constants';

export interface FirestoreInteraction {
  id: string;
  fromUid: string;
  targetUid: string;
  type: 'like' | 'view' | 'super_interest' | 'pass';
  fromDisplayName?: string;
  fromCityName?: string;
  fromCountryCode?: string;
  fromPhoto?: string;
  targetDisplayName?: string;
  targetCityName?: string;
  targetCountryCode?: string;
  note?: string;
  isSuperInterest?: boolean;
  timestamp: number;
  updatedAt: number;
}

export class FirestoreInteractionService {
  private static instance: FirestoreInteractionService;

  public static getInstance(): FirestoreInteractionService {
    if (!FirestoreInteractionService.instance) {
      FirestoreInteractionService.instance = new FirestoreInteractionService();
    }
    return FirestoreInteractionService.instance;
  }

  /**
   * 1. Regista uma visita real ao perfil no Firestore (Coleção: interactions)
   * ID Determinístico: view_{fromUid}_{targetUid}
   */
  public async recordProfileView(fromProfile: UserProfile, targetProfile: UserProfile): Promise<void> {
    if (!fromProfile?.uid || !targetProfile?.uid || fromProfile.uid === targetProfile.uid) return;
    if (!auth.currentUser) return;

    const interactionId = `view_${fromProfile.uid}_${targetProfile.uid}`;
    const payload: FirestoreInteraction = {
      id: interactionId,
      fromUid: fromProfile.uid,
      targetUid: targetProfile.uid,
      type: 'view',
      fromDisplayName: fromProfile.displayName || 'Membro ÉNós',
      fromCityName: fromProfile.cityName || '',
      fromCountryCode: fromProfile.countryCode || '',
      fromPhoto: fromProfile.profilePhoto || '',
      targetDisplayName: targetProfile.displayName,
      targetCityName: targetProfile.cityName,
      targetCountryCode: targetProfile.countryCode,
      timestamp: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'interactions', interactionId), payload, { merge: true });
    } catch (err) {
      console.warn('Persistência de visualização de perfil no Firestore:', err);
    }
  }

  /**
   * 2. Regista um Gosto (❤️) ou Super Interesse real no Firestore (Coleção: interactions)
   * Verifica imediatamente se o utilizador de destino já tinha gostado deste utilizador.
   * Se SIM -> Cria Match em `matches/{sorted_uids}` e Conversa em `conversations/{convoId}`!
   */
  public async recordLike(
    fromProfile: UserProfile,
    targetProfile: UserProfile,
    note?: string,
    isSuperInterest?: boolean
  ): Promise<{ isMutualMatch: boolean; conversation?: Conversation }> {
    if (!fromProfile?.uid || !targetProfile?.uid || fromProfile.uid === targetProfile.uid) {
      return { isMutualMatch: false };
    }
    if (!auth.currentUser) {
      return { isMutualMatch: false };
    }

    const interactionId = `like_${fromProfile.uid}_${targetProfile.uid}`;
    const payload: FirestoreInteraction = {
      id: interactionId,
      fromUid: fromProfile.uid,
      targetUid: targetProfile.uid,
      type: isSuperInterest ? 'super_interest' : 'like',
      fromDisplayName: fromProfile.displayName || 'Membro ÉNós',
      fromCityName: fromProfile.cityName || '',
      fromCountryCode: fromProfile.countryCode || '',
      fromPhoto: fromProfile.profilePhoto || '',
      targetDisplayName: targetProfile.displayName,
      targetCityName: targetProfile.cityName,
      targetCountryCode: targetProfile.countryCode,
      note: note || '',
      isSuperInterest: !!isSuperInterest,
      timestamp: Date.now(),
      updatedAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'interactions', interactionId), payload, { merge: true });
    } catch (err) {
      console.warn('Erro ao registar gosto no Firestore:', err);
    }

    // Verificar se a outra pessoa já demonstrou interesse recíproco
    const reverseLikeId = `like_${targetProfile.uid}_${fromProfile.uid}`;
    let isReciprocal = false;

    try {
      const reverseDoc = await getDoc(doc(db, 'interactions', reverseLikeId));
      if (reverseDoc.exists()) {
        const reverseData = reverseDoc.data() as FirestoreInteraction;
        if (reverseData.type === 'like' || reverseData.type === 'super_interest') {
          isReciprocal = true;
        }
      }
    } catch (e) {
      console.info('Aviso de verificação recíproca:', e);
    }

    if (isReciprocal) {
      // 🌟 MATCH REAL RECÍPROCO!
      const sortedUids = [fromProfile.uid, targetProfile.uid].sort();
      const matchId = `match_${sortedUids.join('_')}`;
      const convoId = `convo_${sortedUids.join('_')}`;

      // Grava em matches/{matchId}
      try {
        await setDoc(doc(db, 'matches', matchId), {
          id: matchId,
          userA: sortedUids[0],
          userB: sortedUids[1],
          users: sortedUids,
          matchedAt: Date.now()
        }, { merge: true });
      } catch (e) {
        console.warn('Aviso de gravação de match:', e);
      }

      // Grava a conversa em conversations/{convoId}
      const newConvo: Conversation = {
        id: convoId,
        participantUids: sortedUids,
        participants: {
          [fromProfile.uid]: {
            displayName: fromProfile.displayName,
            profilePhoto: fromProfile.profilePhoto || '',
            cityName: fromProfile.cityName || '',
            countryCode: fromProfile.countryCode || 'PT'
          },
          [targetProfile.uid]: {
            displayName: targetProfile.displayName,
            profilePhoto: targetProfile.profilePhoto || '',
            cityName: targetProfile.cityName || '',
            countryCode: targetProfile.countryCode || 'PT'
          }
        },
        lastMessageText: 'Ligação mútua estabelecida! Diga olá 🌍✨',
        lastMessageTimestamp: Date.now(),
        lastMessageSenderId: fromProfile.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      try {
        await setDoc(doc(db, 'conversations', convoId), newConvo, { merge: true });

        // Mensagem de boas-vindas do remetente
        const welcomeMsg: ChatMessage = {
          id: 'msg_welcome_' + Date.now(),
          conversationId: convoId,
          senderId: fromProfile.uid,
          text: note || `Olá, ${targetProfile.displayName}! Temos interesse mútuo no ÉNós. Prazer em conectar-me contigo! 🌍✨`,
          createdAt: Date.now(),
          status: 'sent'
        };

        await setDoc(doc(db, 'conversations', convoId, 'messages', welcomeMsg.id), welcomeMsg);
      } catch (e) {
        console.warn('Aviso de criação de conversa:', e);
      }

      return { isMutualMatch: true, conversation: newConvo };
    }

    return { isMutualMatch: false };
  }

  /**
   * 3. Escuta em tempo real todas as interações recebidas (Visto por / Gostos recebidos)
   */
  public listenToReceivedInteractions(
    myUid: string,
    onUpdate: (interactions: FirestoreInteraction[]) => void
  ): () => void {
    if (!myUid) return () => {};

    try {
      const q = query(
        collection(db, 'interactions'),
        where('targetUid', '==', myUid)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: FirestoreInteraction[] = [];
          snapshot.forEach((d) => {
            items.push(d.data() as FirestoreInteraction);
          });
          onUpdate(items);
        },
        (error) => {
          console.warn('Erro na escuta de interações recebidas:', error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Falha ao iniciar listener de interações recebidas:', err);
      return () => {};
    }
  }

  /**
   * 4. Escuta em tempo real todas as interações enviadas (Gostos enviados / Perfis que visitei)
   */
  public listenToSentInteractions(
    myUid: string,
    onUpdate: (interactions: FirestoreInteraction[]) => void
  ): () => void {
    if (!myUid) return () => {};

    try {
      const q = query(
        collection(db, 'interactions'),
        where('fromUid', '==', myUid)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: FirestoreInteraction[] = [];
          snapshot.forEach((d) => {
            items.push(d.data() as FirestoreInteraction);
          });
          onUpdate(items);
        },
        (error) => {
          console.warn('Erro na escuta de interações enviadas:', error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Falha ao iniciar listener de interações enviadas:', err);
      return () => {};
    }
  }

  /**
   * 5. Escuta em tempo real as conversas do utilizador
   */
  public listenToConversations(
    myUid: string,
    onUpdate: (conversations: Conversation[]) => void
  ): () => void {
    if (!myUid) return () => {};

    try {
      const q = query(
        collection(db, 'conversations'),
        where('participantUids', 'array-contains', myUid)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const convos: Conversation[] = [];
          snapshot.forEach((d) => {
            convos.push(d.data() as Conversation);
          });
          convos.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
          onUpdate(convos);
        },
        (error) => {
          console.warn('Erro na escuta de conversas:', error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Falha ao escutar conversas no Firestore:', err);
      return () => {};
    }
  }

  /**
   * 6. Escuta em tempo real as mensagens de uma conversa específica
   */
  public listenToMessages(
    convoId: string,
    onUpdate: (messages: ChatMessage[]) => void
  ): () => void {
    if (!convoId) return () => {};

    try {
      const messagesRef = collection(db, 'conversations', convoId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'asc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const msgs: ChatMessage[] = [];
          snapshot.forEach((d) => {
            msgs.push(d.data() as ChatMessage);
          });
          onUpdate(msgs);
        },
        (error) => {
          console.warn(`Erro na escuta de mensagens da conversa ${convoId}:`, error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Falha ao iniciar escuta de mensagens:', err);
      return () => {};
    }
  }

  /**
   * 7. Envia uma mensagem real e persiste em conversations/{convoId}/messages/{msgId}
   */
  public async sendMessage(
    convoId: string,
    senderId: string,
    text: string,
    imageUrl?: string
  ): Promise<ChatMessage> {
    const msgId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newMsg: ChatMessage = {
      id: msgId,
      conversationId: convoId,
      senderId,
      text: text || '',
      imageUrl: imageUrl || undefined,
      createdAt: Date.now(),
      status: 'sent'
    };

    try {
      // 1. Gravar mensagem na subcoleção
      await setDoc(doc(db, 'conversations', convoId, 'messages', msgId), newMsg);

      // 2. Atualizar cabeçalho da conversa
      await updateDoc(doc(db, 'conversations', convoId), {
        lastMessageText: text || (imageUrl ? '📷 Foto enviada' : ''),
        lastMessageTimestamp: Date.now(),
        lastMessageSenderId: senderId,
        updatedAt: Date.now()
      });
    } catch (err) {
      console.warn('Erro ao enviar mensagem no Firestore:', err);
    }

    return newMsg;
  }

  /**
   * 8. Escuta os perfis reais da comunidade no Firestore (Coleção: profiles)
   * Mescla perfis reais com o catálogo de demonstração da CPLP, dando prioridade absoluta aos perfis reais cadastrados!
   */
  public listenToCommunityProfiles(
    myUid: string,
    onUpdate: (profiles: UserProfile[]) => void
  ): () => void {
    try {
      const profilesRef = collection(db, 'profiles');

      const unsubscribe = onSnapshot(
        profilesRef,
        (snapshot) => {
          const realProfiles: UserProfile[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as UserProfile;
            const profileUid = data.uid || d.id;
            // Excluir o próprio perfil
            if (profileUid !== myUid) {
              realProfiles.push({
                ...data,
                uid: profileUid
              });
            }
          });

          // Filtrar perfis demo que possam ter o mesmo UID (para evitar colisões)
          const demoFallback = DEMO_LUSOFONE_PROFILES.filter(
            demo => demo.uid !== myUid && !realProfiles.some(rp => rp.uid === demo.uid)
          );

          // Real users first, followed by demo profiles
          const combined = [...realProfiles, ...demoFallback];
          onUpdate(combined);
        },
        (error) => {
          console.warn('Erro na escuta de perfis no Firestore:', error);
        }
      );

      return unsubscribe;
    } catch (err) {
      console.warn('Falha ao escutar perfis no Firestore:', err);
      return () => {};
    }
  }
}

export const firestoreInteractionService = FirestoreInteractionService.getInstance();
