import React, { useState, useEffect } from 'react';
import { 
  GmailService, 
  GmailMessageSummary, 
  GmailMessageFull, 
  GmailUserProfile, 
  googleSignIn, 
  logoutGmail, 
  getAccessToken 
} from '../services/gmail';
import { 
  Mail, 
  X, 
  RefreshCw, 
  Send, 
  Trash2, 
  Search, 
  Inbox, 
  SendHorizontal, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  ShieldCheck,
  Sparkles,
  LogOut,
  User,
  Plus
} from 'lucide-react';

interface GmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRecipient?: string;
  initialSubject?: string;
  initialBody?: string;
}

export const GmailModal: React.FC<GmailModalProps> = ({
  isOpen,
  onClose,
  initialRecipient = '',
  initialSubject = '',
  initialBody = ''
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<GmailUserProfile | null>(null);
  const [activeView, setActiveView] = useState<'inbox' | 'sent' | 'compose' | 'read'>('inbox');
  
  // Messages state
  const [messages, setMessages] = useState<GmailMessageSummary[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageFull | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Compose state
  const [toInput, setToInput] = useState<string>(initialRecipient);
  const [subjectInput, setSubjectInput] = useState<string>(initialSubject);
  const [bodyInput, setBodyInput] = useState<string>(initialBody);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendSuccess, setSendSuccess] = useState<boolean>(false);

  // Destructive Confirmation Dialog State
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: 'send' | 'trash';
    messageId?: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const gmailService = GmailService.getInstance();

  // Check auth state on open
  useEffect(() => {
    if (!isOpen) return;

    const checkToken = async () => {
      setIsLoadingAuth(true);
      setAuthError(null);
      try {
        const token = await getAccessToken();
        if (token) {
          setIsAuthenticated(true);
          await loadUserProfileAndMessages('inbox');
        } else {
          setIsAuthenticated(false);
        }
      } catch (err: any) {
        console.error('Error checking auth:', err);
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    checkToken();
  }, [isOpen]);

  // Sync initial compose props
  useEffect(() => {
    if (initialRecipient || initialSubject || initialBody) {
      setToInput(initialRecipient);
      setSubjectInput(initialSubject);
      setBodyInput(initialBody);
      if (initialRecipient) {
        setActiveView('compose');
      }
    }
  }, [initialRecipient, initialSubject, initialBody]);

  const loadUserProfileAndMessages = async (view: 'inbox' | 'sent' = 'inbox') => {
    setIsLoadingMessages(true);
    try {
      const userProfile = await gmailService.getProfile();
      setProfile(userProfile);

      const labelIds = view === 'sent' ? ['SENT'] : ['INBOX'];
      const res = await gmailService.listMessages({
        labelIds,
        q: searchQuery || undefined,
        maxResults: 15
      });
      setMessages(res.messages);
    } catch (err: any) {
      console.error('Failed to load Gmail messages:', err);
      if (err.message === 'AUTH_EXPIRED' || err.message === 'AUTH_REQUIRED') {
        setIsAuthenticated(false);
      } else {
        setAuthError(err.message || 'Erro ao carregar e-mails.');
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        setIsAuthenticated(true);
        await loadUserProfileAndMessages('inbox');
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        // User voluntarily closed or cancelled popup, no error needed
        return;
      }
      console.error('Sign in failed:', err);
      setAuthError(err.message || 'Não foi possível autorizar o acesso ao Gmail.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logoutGmail();
    setIsAuthenticated(false);
    setProfile(null);
    setMessages([]);
    setSelectedMessage(null);
  };

  const handleSelectMessage = async (msg: GmailMessageSummary) => {
    setIsLoadingDetails(true);
    setActiveView('read');
    try {
      const full = await gmailService.getMessageFull(msg.id);
      setSelectedMessage(full);
      if (msg.isUnread) {
        await gmailService.markAsRead(msg.id).catch(() => {});
        // Update local list
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isUnread: false } : m));
      }
    } catch (err: any) {
      console.error('Failed to load message body:', err);
      setAuthError('Não foi possível carregar o conteúdo completo do e-mail.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Trigger Send with explicit user confirmation
  const handleRequestSend = () => {
    if (!toInput.trim() || !subjectInput.trim() || !bodyInput.trim()) {
      setAuthError('Por favor preencha o destinatário, assunto e mensagem.');
      return;
    }

    setPendingConfirmation({
      type: 'send',
      description: `Enviar e-mail para "${toInput}" com o assunto "${subjectInput}" através da sua conta Gmail?`,
      onConfirm: async () => {
        setIsSending(true);
        try {
          await gmailService.sendEmail({
            to: toInput.trim(),
            subject: subjectInput.trim(),
            body: bodyInput.trim()
          });
          setSendSuccess(true);
          setToInput('');
          setSubjectInput('');
          setBodyInput('');
          setTimeout(() => {
            setSendSuccess(false);
            setActiveView('inbox');
            loadUserProfileAndMessages('inbox');
          }, 1500);
        } catch (err: any) {
          console.error('Send error:', err);
          setAuthError(err.message || 'Falha ao enviar e-mail.');
        } finally {
          setIsSending(false);
        }
      }
    });
  };

  // Trigger Trash with explicit user confirmation
  const handleRequestTrash = (messageId: string) => {
    setPendingConfirmation({
      type: 'trash',
      messageId,
      description: 'Tem certeza que deseja mover esta mensagem para a lixeira do Gmail?',
      onConfirm: async () => {
        try {
          await gmailService.trashMessage(messageId);
          setMessages(prev => prev.filter(m => m.id !== messageId));
          setSelectedMessage(null);
          setActiveView('inbox');
        } catch (err: any) {
          console.error('Trash error:', err);
          setAuthError('Falha ao mover mensagem para a lixeira.');
        }
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Gmail Integration</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                  Google Workspace
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                {profile?.emailAddress ? profile.emailAddress : 'Comunicação oficial ÉNós · CPLP'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
                title="Desconectar conta Google"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-[380px] bg-stone-50">
          {isLoadingAuth ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-stone-500">
              <RefreshCw className="w-6 h-6 animate-spin text-rose-600 mb-2" />
              <p className="text-xs">A verificar credenciais Google...</p>
            </div>
          ) : !isAuthenticated ? (
            /* Unauthenticated View: Sign In with Google */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center mb-4 text-red-500">
                <Mail className="w-8 h-8" />
              </div>
              
              <h3 className="text-base font-bold text-stone-900 mb-1">
                Conectar ao Gmail
              </h3>
              <p className="text-xs text-stone-600 max-w-sm mb-6 leading-relaxed">
                Acesse suas mensagens, envie convites para conexões da comunidade CPLP ou entre em contato com o suporte diretamente pela sua conta Google com segurança.
              </p>

              {authError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2 text-left max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Official Google Sign-In Material Button */}
              <button
                type="button"
                id="btn-google-signin-gmail"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="flex items-center gap-3 px-5 py-2.5 bg-white hover:bg-stone-50 text-stone-700 font-medium text-sm rounded-xl border border-stone-300 shadow-xs active:scale-98 transition cursor-pointer disabled:opacity-60"
              >
                {isSigningIn ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-stone-500" />
                ) : (
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                )}
                <span>{isSigningIn ? 'A conectar...' : 'Iniciar sessão com o Google'}</span>
              </button>

              <div className="mt-6 flex items-center gap-1.5 text-[11px] text-stone-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Permissões concedidas exclusivamente com a sua autorização</span>
              </div>
            </div>
          ) : (
            /* Authenticated Gmail View */
            <div className="flex-1 flex flex-col">
              
              {/* Navigation Subheader */}
              <div className="bg-white border-b border-stone-200 px-4 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('inbox');
                      loadUserProfileAndMessages('inbox');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                      activeView === 'inbox' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Inbox className="w-3.5 h-3.5" />
                    <span>Entrada</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('sent');
                      loadUserProfileAndMessages('sent');
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                      activeView === 'sent' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    <span>Enviados</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('compose')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                      activeView === 'compose' ? 'bg-white text-rose-700 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Escrever</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => loadUserProfileAndMessages(activeView === 'sent' ? 'sent' : 'inbox')}
                  disabled={isLoadingMessages}
                  className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition"
                  title="Atualizar lista"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Error Banner */}
              {authError && (
                <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{authError}</span>
                  </div>
                  <button onClick={() => setAuthError(null)} className="text-red-800 font-bold text-xs">✕</button>
                </div>
              )}

              {/* Main Content by Active View */}
              {activeView === 'compose' ? (
                /* Compose View */
                <div className="p-4 flex-1 flex flex-col space-y-3">
                  {sendSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>E-mail enviado com sucesso através da sua conta Gmail!</span>
                    </div>
                  )}

                  {/* Quick Templates */}
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block mb-1.5">
                      Modelos Rápidos CPLP
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectInput('Convite para conexão · ÉNós');
                          setBodyInput('Olá! Gostei muito de te encontrar na rede ÉNós e gostaria de manter contato. Um abraço fraterno!');
                        }}
                        className="px-2 py-1 bg-white border border-stone-200 hover:border-rose-300 rounded-lg text-[11px] text-stone-700 flex items-center gap-1 transition"
                      >
                        <Sparkles className="w-3 h-3 text-rose-500" />
                        <span>Convite Amigável</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setToInput('suporte@enos-cplp.org');
                          setSubjectInput('Dúvida / Feedback · Plataforma ÉNós');
                          setBodyInput('Olá equipe ÉNós,\n\nGostaria de compartilhar o seguinte feedback sobre a experiência na comunidade:\n\n');
                        }}
                        className="px-2 py-1 bg-white border border-stone-200 hover:border-rose-300 rounded-lg text-[11px] text-stone-700 flex items-center gap-1 transition"
                      >
                        <Mail className="w-3 h-3 text-blue-500" />
                        <span>Suporte ÉNós</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Para (E-mail)</label>
                    <input
                      type="email"
                      value={toInput}
                      onChange={e => setToInput(e.target.value)}
                      placeholder="destinatario@exemplo.com"
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Assunto</label>
                    <input
                      type="text"
                      value={subjectInput}
                      onChange={e => setSubjectInput(e.target.value)}
                      placeholder="Assunto da mensagem..."
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>

                  <div className="flex-1 flex flex-col">
                    <label className="block text-[11px] font-semibold text-stone-700 mb-1">Mensagem</label>
                    <textarea
                      value={bodyInput}
                      onChange={e => setBodyInput(e.target.value)}
                      rows={6}
                      placeholder="Escreva a sua mensagem..."
                      className="w-full flex-1 px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                    <button
                      type="button"
                      onClick={() => setActiveView('inbox')}
                      className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-200 transition"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestSend}
                      disabled={isSending || !toInput || !subjectInput || !bodyInput}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSending ? 'A enviar...' : 'Enviar E-mail'}</span>
                    </button>
                  </div>
                </div>
              ) : activeView === 'read' && selectedMessage ? (
                /* Read Message View */
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                    <button
                      type="button"
                      onClick={() => setActiveView('inbox')}
                      className="flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 font-medium"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setToInput(selectedMessage.from || '');
                          setSubjectInput(`Re: ${selectedMessage.subject}`);
                          setBodyInput(`\n\n--- Em resposta a ---\n${selectedMessage.bodyText?.slice(0, 200)}...`);
                          setActiveView('compose');
                        }}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 rounded-lg text-xs text-stone-700 font-medium flex items-center gap-1 transition"
                      >
                        <Send className="w-3 h-3" />
                        <span>Responder</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRequestTrash(selectedMessage.id)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Mover para o Lixo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="py-3">
                    <h3 className="text-sm font-bold text-stone-900 mb-1.5">
                      {selectedMessage.subject}
                    </h3>
                    <div className="text-xs text-stone-600 space-y-0.5">
                      <div><strong className="text-stone-800">De:</strong> {selectedMessage.from}</div>
                      {selectedMessage.to && <div><strong className="text-stone-800">Para:</strong> {selectedMessage.to}</div>}
                      {selectedMessage.date && <div className="text-[11px] text-stone-500">{selectedMessage.date}</div>}
                    </div>
                  </div>

                  <div className="flex-1 bg-white p-3.5 rounded-xl border border-stone-200 overflow-y-auto text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                    {isLoadingDetails ? (
                      <div className="flex items-center justify-center p-6 text-stone-400">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      </div>
                    ) : (
                      selectedMessage.bodyText || selectedMessage.snippet
                    )}
                  </div>
                </div>
              ) : (
                /* List Messages View (Inbox / Sent) */
                <div className="flex-1 flex flex-col">
                  {/* Search bar */}
                  <div className="p-3 border-b border-stone-200 bg-white">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && loadUserProfileAndMessages(activeView === 'sent' ? 'sent' : 'inbox')}
                        placeholder="Pesquisar e-mails no Gmail..."
                        className="w-full pl-8 pr-8 py-1.5 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            loadUserProfileAndMessages(activeView === 'sent' ? 'sent' : 'inbox');
                          }}
                          className="absolute right-2.5 top-2 text-stone-400 hover:text-stone-700 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Message List */}
                  <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
                    {isLoadingMessages ? (
                      <div className="flex flex-col items-center justify-center p-8 text-stone-400">
                        <RefreshCw className="w-5 h-5 animate-spin text-rose-600 mb-2" />
                        <span className="text-xs">A carregar e-mails...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="p-8 text-center text-stone-500 text-xs">
                        Nenhuma mensagem encontrada {searchQuery ? 'para esta pesquisa' : 'nesta pasta'}.
                      </div>
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg.id}
                          onClick={() => handleSelectMessage(msg)}
                          className={`p-3.5 hover:bg-stone-100/80 transition cursor-pointer flex items-start justify-between gap-3 ${
                            msg.isUnread ? 'bg-white font-semibold' : 'bg-stone-50/50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {msg.isUnread && (
                                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                              )}
                              <span className="text-xs text-stone-900 truncate font-semibold">
                                {msg.from ? msg.from.split('<')[0].replace(/"/g, '').trim() : 'Desconhecido'}
                              </span>
                            </div>
                            <div className="text-xs text-stone-800 truncate mt-0.5">
                              {msg.subject}
                            </div>
                            <div className="text-[11px] text-stone-500 truncate mt-0.5">
                              {msg.snippet}
                            </div>
                          </div>

                          <div className="text-[10px] text-stone-400 shrink-0 text-right">
                            {msg.date ? new Date(msg.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) : ''}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Explicit Mandatory User Confirmation Dialog (Destructive / Sending) */}
        {pendingConfirmation && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-stone-200 shadow-2xl space-y-3">
              <div className="flex items-center gap-2.5 text-stone-900">
                <div className={`p-2 rounded-xl ${pendingConfirmation.type === 'trash' ? 'bg-red-100 text-red-600' : 'bg-rose-100 text-rose-600'}`}>
                  {pendingConfirmation.type === 'trash' ? <Trash2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                </div>
                <h4 className="font-bold text-sm">
                  {pendingConfirmation.type === 'trash' ? 'Confirmar Exclusão' : 'Confirmar Envio'}
                </h4>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                {pendingConfirmation.description}
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingConfirmation(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const action = pendingConfirmation.onConfirm;
                    setPendingConfirmation(null);
                    await action();
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs transition cursor-pointer ${
                    pendingConfirmation.type === 'trash'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {pendingConfirmation.type === 'trash' ? 'Sim, Mover para Lixeira' : 'Sim, Enviar Agora'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
