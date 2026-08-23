import React, { useState, useEffect, useRef } from 'react';
import { Conversation, ChatMessage, UserProfile } from '../types';
import { CPLP_COUNTRIES } from '../constants';
import { ClientAiAdapter } from '../services/aiAdapter';
import { Send, ArrowLeft, Image as ImageIcon, ShieldAlert, CheckCheck, Sparkles } from 'lucide-react';
import { compressImage } from '../utils/imageCompression';

interface ConversationsProps {
  myProfile: UserProfile;
  conversations: Conversation[];
  messages: { [conversationId: string]: ChatMessage[] };
  onSendMessage: (conversationId: string, text: string, imageUrl?: string) => void;
  onBlockUser: (targetUid: string) => void;
}

export const Conversations: React.FC<ConversationsProps> = ({
  myProfile,
  conversations,
  messages,
  onSendMessage,
  onBlockUser
}) => {
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [sendingImage, setSendingImage] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [loadingIcebreakers, setLoadingIcebreakers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConvo = conversations.find(c => c.id === selectedConvoId);
  const otherUid = activeConvo?.participantUids.find(uid => uid !== myProfile.uid) || '';
  const otherUser = activeConvo?.participants?.[otherUid] || activeConvo?.participantDetails?.[otherUid];

  const currentMessages = selectedConvoId ? messages[selectedConvoId] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages]);

  // 4.15 & 4.16: Fetch AI icebreakers via AIConversationAssistant contract
  const handleLoadIcebreakers = async () => {
    if (!otherUser || loadingIcebreakers) return;
    setLoadingIcebreakers(true);
    try {
      const adapter = ClientAiAdapter.getInstance();
      const suggestions = await adapter.generateIcebreakers({
        sharedInterests: myProfile.interests.slice(0, 3),
        userACity: myProfile.cityName,
        userBCity: otherUser.cityName || otherUser.displayName
      });
      setIcebreakers(suggestions);
    } catch {
      setIcebreakers([
        `Olá! Notei nossa afinidade na lusofonia. Como tem sido seu dia?`,
        `Que prazer conectar com você! Vamos conversar?`
      ]);
    } finally {
      setLoadingIcebreakers(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedConvoId) return;
    onSendMessage(selectedConvoId, inputText.trim());
    setInputText('');
    setIcebreakers([]);
  };

  const handleSendImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedConvoId) {
      setSendingImage(true);
      try {
        const compressed = await compressImage(file, 600, 0.7);
        onSendMessage(selectedConvoId, '', compressed);
      } catch (err) {
        console.error('Error compressing chat image:', err);
      } finally {
        setSendingImage(false);
      }
    }
  };

  // If in chat detail view
  if (selectedConvoId && activeConvo && otherUser) {
    const countryInfo = CPLP_COUNTRIES[otherUser.countryCode] || { flag: '🌍', name: otherUser.cityName || otherUser.displayName };

    return (
      <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] max-w-md mx-auto w-full bg-white border-x border-stone-200">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between bg-stone-50/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="btn-chat-back"
              onClick={() => {
                setSelectedConvoId(null);
                setIcebreakers([]);
              }}
              className="p-1.5 -ml-1 text-stone-600 hover:text-stone-900 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="relative">
              <img
                src={otherUser.profilePhoto}
                alt={otherUser.displayName}
                className="w-10 h-10 rounded-full object-cover border border-stone-200"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-0 right-0 text-xs leading-none">{countryInfo.flag}</span>
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 text-sm leading-tight">{otherUser.displayName}</h3>
              <p className="text-[11px] text-stone-700">{otherUser.cityName || countryInfo.name}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm(`Deseja bloquear ${otherUser.displayName}?`)) {
                onBlockUser(otherUid);
                setSelectedConvoId(null);
              }
            }}
            title="Bloquear usuário"
            className="p-2 text-stone-400 hover:text-rose-600 transition rounded-lg"
          >
            <ShieldAlert className="w-4 h-4" />
          </button>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/50">
          {currentMessages.length === 0 ? (
            <div className="text-center py-10 text-stone-700 space-y-3">
              <p className="text-xs font-semibold text-stone-900">Vocês deram match no ÉNós! 💫</p>
              <p className="text-xs text-stone-600">Inicie uma conversa calorosa e respeitosa.</p>
              <button
                type="button"
                onClick={handleLoadIcebreakers}
                disabled={loadingIcebreakers}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-xs font-medium hover:bg-rose-100 transition"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {loadingIcebreakers ? 'Gerando quebra-gelo...' : 'Sugerir Quebra-Gelo IA'}
              </button>
            </div>
          ) : (
            currentMessages.map(msg => {
              const isMe = (msg.senderId || msg.senderUid) === myProfile.uid;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                      isMe
                        ? 'bg-rose-600 text-white rounded-br-xs'
                        : 'bg-white border border-stone-200 text-stone-900 rounded-bl-xs'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="Foto enviada"
                        className="rounded-lg mb-1.5 max-h-48 object-cover w-full"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    {msg.text && <p>{msg.text}</p>}
                  </div>
                  <span className="text-[10px] text-stone-700 mt-1 flex items-center gap-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMe && <CheckCheck className="w-3 h-3 text-rose-600" />}
                  </span>
                </div>
              );
            })
          )}

          {/* Icebreaker pills if available */}
          {icebreakers.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-xs space-y-2 mt-2">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                <Sparkles className="w-3 h-3" />
                <span>Sugestões de quebra-gelo:</span>
              </div>
              <div className="space-y-1.5">
                {icebreakers.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setInputText(item);
                    }}
                    className="w-full text-left p-2 rounded-lg bg-stone-50 hover:bg-rose-50 text-xs text-stone-800 border border-stone-200/80 transition"
                  >
                    "{item}"
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-stone-200 bg-white flex items-center gap-2">
          <label
            htmlFor="chat-image-input"
            className="p-2.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-full cursor-pointer transition"
          >
            <ImageIcon className="w-5 h-5" />
          </label>
          <input
            id="chat-image-input"
            type="file"
            accept="image/*"
            onChange={handleSendImage}
            className="hidden"
          />

          <input
            type="text"
            id="input-chat-message"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={sendingImage ? 'Comprimindo foto...' : 'Mensagem...'}
            disabled={sendingImage}
            className="flex-1 px-4 py-2.5 bg-stone-100 border border-transparent rounded-full text-xs text-stone-900 placeholder-stone-400 focus:bg-white focus:border-rose-500 focus:outline-none"
          />

          <button
            type="submit"
            id="btn-send-message"
            disabled={!inputText.trim() || sendingImage}
            className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 disabled:opacity-40 transition shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // Conversation List View
  return (
    <div className="flex-1 max-w-md mx-auto w-full p-4 pb-20 sm:pb-6">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Conversas</h2>
        <p className="text-xs text-stone-700">Seus matches e conexões na comunidade lusófona.</p>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center mt-6">
          <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center mx-auto mb-3 text-rose-600">
            💬
          </div>
          <h3 className="text-sm font-bold text-stone-900 mb-1">Nenhuma conversa ainda</h3>
          <p className="text-xs text-stone-700 max-w-xs mx-auto">
            Quando você e outra pessoa se curtirem no Descobrir, a conversa aparecerá aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden shadow-2xs">
          {conversations.map(convo => {
            const partnerUid = convo.participantUids.find(uid => uid !== myProfile.uid) || '';
            const partner = convo.participants?.[partnerUid] || convo.participantDetails?.[partnerUid];
            if (!partner) return null;
            const country = CPLP_COUNTRIES[partner.countryCode] || { flag: '🌍', name: partner.cityName || partner.displayName };

            return (
              <button
                key={convo.id}
                type="button"
                id={`convo-item-${convo.id}`}
                onClick={() => setSelectedConvoId(convo.id)}
                className="w-full p-3.5 flex items-center gap-3 hover:bg-stone-50 transition text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={partner.profilePhoto}
                    alt={partner.displayName}
                    className="w-12 h-12 rounded-full object-cover border border-stone-200"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 text-xs leading-none bg-white rounded-full p-0.5 shadow-2xs">
                    {country.flag}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-stone-900 text-xs truncate">{partner.displayName}</h4>
                    {convo.lastMessageTimestamp && (
                      <span className="text-[10px] text-stone-700">
                        {new Date(convo.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-700 truncate mt-0.5">
                    {convo.lastMessageText || 'Novo match! Inicie a conversa.'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
