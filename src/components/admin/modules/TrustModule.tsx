import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { TrustService } from '../../../services/admin/trustService';
import { RbacService } from '../../../services/admin/rbacService';
import { TaskService } from '../../../services/admin/taskService';
import { AuditService } from '../../../services/admin/auditService';
import { trustGraph, TRUST_ELIGIBILITY_POLICIES } from '../../../services/trustGraph';
import {
  TrustReview,
  TrustDecisionOutcome,
  TrustVerificationRequest,
  TrustEvidenceType,
  TrustBadgeType,
  UserProfile
} from '../../../types';
import {
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  AlertTriangle,
  Eye,
  ArrowRight,
  Clock,
  Ban,
  UserX,
  Lock,
  FileText,
  UserCheck2,
  ChevronRight,
  Shield,
  Search,
  Check,
  ShieldCheck,
  Sparkles,
  HeartHandshake,
  Zap,
  Layers,
  FileCheck,
  KeyRound,
  XCircle,
  HelpCircle,
  Cpu
} from 'lucide-react';

interface ActiveRestriction {
  id: string;
  userId: string;
  userName: string;
  type: 'MUTE_24H' | 'MESSAGE_BLOCK' | 'SHADOWBAN';
  reason: string;
  appliedBy: string;
  expiresAt: number;
}

interface ActiveBlock {
  id: string;
  userId: string;
  userName: string;
  reason: string;
  blockedAt: number;
  blockedBy: string;
}

const INITIAL_RESTRICTIONS: ActiveRestriction[] = [
  {
    id: 'rst_01',
    userId: 'usr_pt_09',
    userName: 'Tiago Neves',
    type: 'MESSAGE_BLOCK',
    reason: 'Comportamento spam no chat',
    appliedBy: 'Marcelo Truman (Founder)',
    expiresAt: Date.now() + 86400000 * 2
  }
];

const INITIAL_BLOCKS: ActiveBlock[] = [
  {
    id: 'blk_01',
    userId: 'usr_bot_99',
    userName: 'Conta Suspeita #812',
    reason: 'Tentativa de automação / scraping de fotos',
    blockedAt: Date.now() - 86400000 * 3,
    blockedBy: 'Marcelo Truman (Founder)'
  }
];

export const TrustModule: React.FC<ModuleProps & { activeSubmoduleId?: string }> = ({
  currentAdmin,
  activeSubmoduleId = 'denuncias'
}) => {
  const trustService = TrustService.getInstance();
  const rbac = RbacService.getInstance();

  const [reviews, setReviews] = useState<TrustReview[]>(() => trustService.getReviews());
  const [selectedReview, setSelectedReview] = useState<TrustReview | null>(null);
  const [outcome, setOutcome] = useState<TrustDecisionOutcome>('require_verification');
  const [justification, setJustification] = useState('');
  const [denunciaTab, setDenunciaTab] = useState<'novas' | 'em_analise' | 'atribuidas' | 'resolvidas'>('novas');

  const [restrictions, setRestrictions] = useState<ActiveRestriction[]>(INITIAL_RESTRICTIONS);
  const [blocks, setBlocks] = useState<ActiveBlock[]>(INITIAL_BLOCKS);

  // Trust Graph Verification & Simulation State
  const [verificationRequests, setVerificationRequests] = useState<TrustVerificationRequest[]>(() =>
    trustGraph.getVerificationRequests()
  );
  const [selectedVerifReq, setSelectedVerifReq] = useState<TrustVerificationRequest | null>(null);
  const [verifDecisionJustification, setVerifDecisionJustification] = useState('');
  const [verifFilter, setVerifFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Simulation Profile for Trust Graph Simulator
  const [simProfileBio, setSimProfileBio] = useState('Apaixonado por literatura angolana e música lusófona. Busco conexões sérias e amizades genuínas.');
  const [simPhotoCount, setSimPhotoCount] = useState(3);
  const [simHasVerifiedId, setSimHasVerifiedId] = useState(true);
  const [simSafetyTenureDays, setSimSafetyTenureDays] = useState(14);
  const [simViolations, setSimViolations] = useState(0);
  const [simReciprocalDialogue, setSimReciprocalDialogue] = useState(4);
  const [simIsOnline, setSimIsOnline] = useState(true);

  const canDecide = rbac.can(currentAdmin, 'trust:decision');
  const canReview = rbac.can(currentAdmin, 'trust:review');

  const reload = () => {
    setReviews(trustService.getReviews());
    setVerificationRequests(trustGraph.getVerificationRequests());
  };

  const handleApproveVerification = (req: TrustVerificationRequest) => {
    if (!canDecide) {
      alert('Permissão insuficiente para aprovar verificação formal.');
      return;
    }
    const just = verifDecisionJustification.trim() || 'Documento e biometria conferidos de acordo com as normas CPLP.';
    const res = trustGraph.reviewVerificationRequest(
      req.id,
      'approved',
      currentAdmin.displayName || currentAdmin.name || 'Admin',
      just
    );
    if (res.success) {
      AuditService.getInstance().logEvent(currentAdmin, {
        module: 'trust',
        resourceType: 'verification_request',
        resourceId: req.id,
        action: 'APPROVE_IDENTITY_VERIFICATION',
        justification: just
      });
      setSelectedVerifReq(null);
      setVerifDecisionJustification('');
      reload();
    } else {
      alert(res.error);
    }
  };

  const handleRejectVerification = (req: TrustVerificationRequest) => {
    if (!canDecide) {
      alert('Permissão insuficiente para rejeitar verificação formal.');
      return;
    }
    const just = verifDecisionJustification.trim() || 'Documento ilegível ou dados divergentes do registo.';
    const res = trustGraph.reviewVerificationRequest(
      req.id,
      'rejected',
      currentAdmin.displayName || currentAdmin.name || 'Admin',
      just
    );
    if (res.success) {
      AuditService.getInstance().logEvent(currentAdmin, {
        module: 'trust',
        resourceType: 'verification_request',
        resourceId: req.id,
        action: 'REJECT_IDENTITY_VERIFICATION',
        justification: just
      });
      setSelectedVerifReq(null);
      setVerifDecisionJustification('');
      reload();
    } else {
      alert(res.error);
    }
  };

  const simulatedEvaluation = React.useMemo(() => {
    const mockProfile: UserProfile = {
      uid: 'sim_user_test',
      displayName: 'Membro Teste',
      age: 28,
      gender: 'man',
      intent: 'serious',
      interests: ['Literatura', 'Música', 'Gastronomia'],
      bio: simProfileBio,
      profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      photos: Array(simPhotoCount).fill('https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400'),
      countryCode: 'AO',
      countryName: 'Angola',
      cityName: 'Luanda',
      culturalBackground: 'Cultura Kimbundu e tradições atlânticas',
      verificationStatus: simHasVerifiedId ? 'verified' : 'unverified',
      visibility: 'public',
      online: simIsOnline,
      lastActive: Date.now(),
      createdAt: Date.now() - simSafetyTenureDays * 86400000,
      updatedAt: Date.now()
    };

    return trustGraph.evaluateTrust(
      mockProfile,
      {
        uid: 'sim_user_test',
        totalSeen: 20,
        totalLikes: 10,
        totalPasses: 10,
        conversations: simReciprocalDialogue,
        meaningfulInteractions: Math.floor(simReciprocalDialogue / 2),
        lastInteractionTimestamp: Date.now()
      } as any,
      simViolations,
      0
    );
  }, [
    simProfileBio,
    simPhotoCount,
    simHasVerifiedId,
    simSafetyTenureDays,
    simViolations,
    simReciprocalDialogue,
    simIsOnline
  ]);

  const handleAssignToSelf = (reviewId: string) => {
    if (trustService.assignReview(reviewId, currentAdmin)) {
      reload();
      if (selectedReview?.id === reviewId) {
        setSelectedReview(prev => (prev ? { ...prev, status: 'in_review', assignedTo: currentAdmin.displayName } : null));
      }
    }
  };

  const handleDelegateToTask = (review: TrustReview) => {
    TaskService.getInstance().createTask(
      {
        title: `[MODERAÇÃO] Revisar denúncia para ${review.targetUid}`,
        description: `Denúncia #${review.id}: ${review.description}. Categoria: ${review.category}.`,
        category: 'trust',
        priority: review.severity === 'critical' ? 'urgent' : 'high'
      },
      currentAdmin
    );
    alert('Denúncia delegada para a fila de Tarefas da equipa!');
  };

  const handleDeliberate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReview || !justification.trim()) return;

    const res = trustService.makeDecision(
      selectedReview.id,
      {
        outcome,
        justification: justification.trim()
      },
      currentAdmin
    );

    if (res.success) {
      if (outcome === 'temporary_restriction') {
        setRestrictions(prev => [
          {
            id: `rst_${Date.now()}`,
            userId: selectedReview.targetUserId,
            userName: selectedReview.targetUserName,
            type: 'MESSAGE_BLOCK',
            reason: justification.trim(),
            appliedBy: currentAdmin.displayName || currentAdmin.name,
            expiresAt: Date.now() + 86400000
          },
          ...prev
        ]);
      } else if (outcome === 'permanent_ban') {
        setBlocks(prev => [
          {
            id: `blk_${Date.now()}`,
            userId: selectedReview.targetUserId,
            userName: selectedReview.targetUserName,
            reason: justification.trim(),
            blockedAt: Date.now(),
            blockedBy: currentAdmin.displayName || currentAdmin.name
          },
          ...prev
        ]);
      }

      setJustification('');
      setSelectedReview(null);
      reload();
    } else {
      alert(res.error || 'Erro ao processar decisão de moderação.');
    }
  };

  const handleRemoveRestriction = (id: string) => {
    setRestrictions(prev => prev.filter(r => r.id !== id));
    AuditService.getInstance().logEvent(currentAdmin, {
      module: 'trust',
      resourceType: 'user_restriction',
      resourceId: id,
      action: 'REMOVE_USER_RESTRICTION',
      justification: 'Restrição removida pelo operador'
    });
  };

  const handleRemoveBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    AuditService.getInstance().logEvent(currentAdmin, {
      module: 'trust',
      resourceType: 'user_block',
      resourceId: id,
      action: 'REMOVE_USER_BLOCK',
      justification: 'Bloqueio revogado pelo operador'
    });
  };

  const currentTab = activeSubmoduleId || 'denuncias';

  // Sub-filtering for denuncias queue
  const filteredDenuncias = reviews.filter(r => {
    if (denunciaTab === 'novas') return r.status === 'pending' && !r.assignedTo;
    if (denunciaTab === 'em_analise') return r.status === 'in_review';
    if (denunciaTab === 'atribuidas') return r.status === 'pending' && Boolean(r.assignedTo);
    if (denunciaTab === 'resolvidas') return r.status === 'resolved' || r.status === 'dismissed';
    return true;
  });

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            CONFIANÇA · Disciplina & Integridade
          </span>
          <span className="text-xs text-stone-700">Denúncias · Moderação · Restrições · Bloqueios · Políticas</span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Trust & Safety · Ciclo em 6 Etapas</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Supervisão e auditoria rigorosa de denúncias. Separação formal entre Sinal, Deteção, Revisão Humana, Decisão e Auditoria.
        </p>
      </div>

      {/* SUBMODULE: DENÚNCIAS */}
      {currentTab === 'denuncias' && (
        <div className="space-y-6">
          {/* Sub-tabs for Queue */}
          <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
            {[
              { id: 'novas', label: 'Novas', count: reviews.filter(r => r.status === 'pending' && !r.assignedTo).length },
              { id: 'em_analise', label: 'Em análise', count: reviews.filter(r => r.status === 'in_review').length },
              { id: 'atribuidas', label: 'Atribuídas', count: reviews.filter(r => r.status === 'pending' && Boolean(r.assignedTo)).length },
              { id: 'resolvidas', label: 'Resolvidas', count: reviews.filter(r => r.status === 'resolved' || r.status === 'dismissed').length }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDenunciaTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition ${
                  denunciaTab === tab.id
                    ? 'bg-rose-50 text-rose-800 border border-rose-200 font-bold'
                    : 'text-stone-700 hover:bg-stone-100 border border-transparent'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  denunciaTab === tab.id ? 'bg-rose-600 text-white' : 'bg-stone-200 text-stone-700'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reviews List */}
            <div className="lg:col-span-6 space-y-3">
              {filteredDenuncias.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-stone-200">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <h4 className="text-xs font-bold text-stone-900">Fila Limpa</h4>
                  <p className="text-xs text-stone-700 mt-1">Nenhuma denúncia nesta categoria.</p>
                </div>
              ) : (
                filteredDenuncias.map(r => (
                  <div
                    key={r.id}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedReview?.id === r.id
                        ? 'bg-rose-50/50 border-rose-300 shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                    onClick={() => setSelectedReview(r)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-stone-900">Report #{r.id.substring(0, 6)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          r.priority === 'urgent'
                            ? 'bg-red-100 text-red-800'
                            : r.priority === 'high'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}>
                          {r.priority}
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-700 font-mono uppercase">
                        {r.status}
                      </span>
                    </div>

                    <div className="mt-2 text-xs">
                      <div className="font-bold text-stone-900">Alvo: {r.targetUserName}</div>
                      <div className="text-stone-700 mt-0.5">{r.summary}</div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-700">
                      <span>Assigned: <strong className="text-stone-700">{r.assignedTo || '—'}</strong></span>
                      <div className="flex gap-2">
                        {r.status === 'pending' && canReview && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignToSelf(r.id);
                            }}
                            className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold cursor-pointer"
                          >
                            Assumir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelegateToTask(r);
                          }}
                          className="px-2 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold cursor-pointer"
                        >
                          Delegar
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Deliberation Workspace */}
            <div className="lg:col-span-6">
              {selectedReview ? (
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div>
                      <span className="font-mono text-xs text-rose-600 font-bold">Report #{selectedReview.id.substring(0, 6)}</span>
                      <h3 className="text-sm font-bold text-stone-900">Deliberação Humana de Moderação</h3>
                    </div>
                    <span className="text-xs text-stone-700">Alvo: {selectedReview.targetUserName}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs space-y-1">
                    <div><strong>Categoria:</strong> {selectedReview.category}</div>
                    <div><strong>Sumário:</strong> {selectedReview.summary}</div>
                    <div><strong>Score Heurístico de Risco:</strong> {selectedReview.riskScore}%</div>
                  </div>

                  {canDecide ? (
                    <form onSubmit={handleDeliberate} className="space-y-4 pt-2">
                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Decisão Operacional (Ação Real)
                        </label>
                        <select
                          value={outcome}
                          onChange={e => setOutcome(e.target.value as TrustDecisionOutcome)}
                          className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl font-medium focus:outline-rose-600"
                        >
                          <option value="dismiss">Arquivar (Sem infração comprovada)</option>
                          <option value="warn_user">Emitir Advertência Formal</option>
                          <option value="require_verification">Exigir Verificação de Identidade (Biometria/Passaporte)</option>
                          <option value="temporary_restriction">Aplicar Restrição Temporária (24h-7d)</option>
                          <option value="shadowban">Aplicar Shadowban Discreto</option>
                          <option value="permanent_ban">Banimento Permanente & Bloqueio CPLP</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold text-stone-700 block mb-1">
                          Justificativa Obrigatória para Auditoria
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={justification}
                          onChange={e => setJustification(e.target.value)}
                          placeholder="Fundamentação objetiva da decisão com base nas políticas da comunidade..."
                          className="w-full p-3 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-rose-600"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setSelectedReview(null)}
                          className="px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
                        >
                          Fechar
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-2xs"
                        >
                          Executar & Auditar Decisão
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs">
                      Seu perfil não possui a permissão <code className="font-mono">trust:decision</code> para deliberações.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center text-xs text-stone-700">
                  Selecione uma denúncia da lista para abrir a área de trabalho de deliberação.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: VERIFICAÇÕES (EVIDÊNCIAS DE IDENTIDADE) */}
      {currentTab === 'verificacoes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  EVIDÊNCIA & VALIDAÇÃO SEGURA
                </span>
                <span className="text-xs text-stone-700 font-medium">Verificação Formal de Identidade CPLP</span>
              </div>
              <h3 className="text-base font-bold text-stone-900 mt-1">Fila de Evidências & Provas de Identidade</h3>
              <p className="text-xs text-stone-700 mt-0.5">
                Validação estrita de documentos oficiais e biometria liveness. Decisões gravadas no log de auditoria.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 self-start sm:self-auto">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setVerifFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    verifFilter === f ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Requests List */}
            <div className="lg:col-span-6 space-y-3">
              {verificationRequests
                .filter(r => (verifFilter === 'all' ? true : r.status === verifFilter))
                .map(req => (
                  <div
                    key={req.id}
                    className={`p-4 rounded-xl border transition cursor-pointer ${
                      selectedVerifReq?.id === req.id
                        ? 'bg-emerald-50/50 border-emerald-300 shadow-2xs'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    }`}
                    onClick={() => setSelectedVerifReq(req)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-stone-900">Req #{req.id}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {req.status === 'approved' ? 'Aprovado' : req.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-700 font-mono">
                        {new Date(req.submittedAt).toLocaleDateString('pt-PT')}
                      </span>
                    </div>

                    <div className="mt-2 text-xs">
                      <div className="font-bold text-stone-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{req.userName}</span>
                        <span className="text-stone-700 font-normal">({req.userCountry})</span>
                      </div>
                      <div className="text-stone-700 mt-1 flex items-center gap-2">
                        <span className="bg-stone-100 px-2 py-0.5 rounded text-[10px] font-mono">
                          {req.evidenceType}
                        </span>
                        <span className="text-[10px] text-stone-700 font-mono truncate max-w-[200px]">
                          {req.documentHash}
                        </span>
                      </div>
                    </div>

                    {req.reviewedBy && (
                      <div className="mt-2.5 pt-2 border-t border-stone-100 text-[11px] text-stone-700 flex items-center justify-between">
                        <span>Revisto por: <strong className="text-stone-700">{req.reviewedBy}</strong></span>
                        <span className="text-stone-700">{req.justification}</span>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {/* Deliberation Detail Panel */}
            <div className="lg:col-span-6">
              {selectedVerifReq ? (
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                    <h4 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Análise de Evidência #{selectedVerifReq.id}
                    </h4>
                    <span className="text-xs text-stone-700 font-mono">
                      UID: {selectedVerifReq.userId}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-stone-700">Utilizador:</span>
                      <span className="font-bold text-stone-900">{selectedVerifReq.userName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-700">País de Emissão:</span>
                      <span className="font-bold text-stone-900">{selectedVerifReq.userCountry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-700">Tipo de Prova:</span>
                      <span className="font-mono text-stone-900 font-bold">{selectedVerifReq.evidenceType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-700">Hash de Validação:</span>
                      <span className="font-mono text-[11px] text-stone-700">{selectedVerifReq.documentHash}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-700">Estado Atual:</span>
                      <span className="font-bold text-emerald-700 uppercase">{selectedVerifReq.status}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    <div className="font-bold flex items-center gap-1.5 mb-0.5">
                      <Lock className="w-3.5 h-3.5 text-amber-700" />
                      Princípio de Autoridade Backend
                    </div>
                    O utilizador não pode atribuir o seu próprio badge. A aprovação desta evidência emite o badge público formal através do motor seguro de Trust.
                  </div>

                  {selectedVerifReq.status === 'pending' && (
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs font-bold text-stone-800 block mb-1">
                          Justificação da Decisão (Registo de Auditoria):
                        </label>
                        <input
                          type="text"
                          value={verifDecisionJustification}
                          onChange={e => setVerifDecisionJustification(e.target.value)}
                          placeholder="Ex: Documento de identidade de Angola validado com sucesso"
                          className="w-full p-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-emerald-600"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRejectVerification(selectedVerifReq)}
                          className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          Rejeitar Pedido
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApproveVerification(selectedVerifReq)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-2xs flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Aprovar & Emitir Selo</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-12 border border-stone-200 text-center text-xs text-stone-700">
                  Selecione um pedido de verificação para inspecionar os detalhes e deliberar.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: TRUST GRAPH & POLÍTICAS */}
      {currentTab === 'trust_graph' && (
        <div className="space-y-6">
          {/* Architecture Banner */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  ARQUITETURA DE CONFIANÇA
                </span>
                <h3 className="text-base font-bold text-stone-900 mt-1">Fluxo do Trust Graph ÉNós</h3>
              </div>
              <span className="text-xs font-mono text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                Modelo Não-Punitivo & Sem Score Público
              </span>
            </div>

            {/* 5-Step Visual Pipeline */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center space-y-1">
                <div className="text-[10px] font-bold text-stone-700 uppercase">1. EVIDÊNCIA</div>
                <div className="text-xs font-bold text-stone-900">Documentos & Atos</div>
                <p className="text-[10px] text-stone-700">Biometria, diálogo recíproco e histórico</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center space-y-1">
                <div className="text-[10px] font-bold text-stone-700 uppercase">2. VALIDAÇÃO</div>
                <div className="text-xs font-bold text-stone-900">Backend Authority</div>
                <p className="text-[10px] text-stone-700">Sem autoridade do frontend; regras seguras</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center space-y-1">
                <div className="text-[10px] font-bold text-stone-700 uppercase">3. SINAIS PRIVADOS</div>
                <div className="text-xs font-bold text-stone-900">Multidimensional</div>
                <p className="text-[10px] text-stone-700">Sem trust score público ou manipulável</p>
              </div>

              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center space-y-1">
                <div className="text-[10px] font-bold text-stone-700 uppercase">4. ELEGIBILIDADE</div>
                <div className="text-xs font-bold text-stone-900">Políticas Formais</div>
                <p className="text-[10px] text-stone-700">Critérios determinísticos e auditáveis</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <div className="text-[10px] font-bold text-emerald-800 uppercase">5. BADGES PÚBLICOS</div>
                <div className="text-xs font-bold text-emerald-900">Distintivos Mínimos</div>
                <p className="text-[10px] text-emerald-800">Apenas reconhecimento positivo e dignidade</p>
              </div>
            </div>

            {/* 5 Core Directives Card */}
            <div className="p-4 rounded-xl bg-stone-900 text-white space-y-2 text-xs">
              <div className="font-bold text-rose-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>5 Princípios Inegociáveis do Trust Graph:</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-stone-300 text-[11px] list-disc list-inside">
                <li><strong>O utilizador não pode atribuir o próprio badge</strong> (requer evidência backend).</li>
                <li><strong>O frontend não é a autoridade</strong> (validação e cálculo ocorrem no servidor).</li>
                <li><strong>Sem trust score manipulável</strong> (evita gamificação e julgamento superficial).</li>
                <li><strong>Decisões auditáveis</strong> (cada concessão fica registada em logs imutáveis).</li>
                <li><strong>Anti-Humilhação</strong> (feedback negativo nunca gera sistema de vergonha pública).</li>
              </ul>
            </div>
          </div>

          {/* Formal Eligibility Policies Cards */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-stone-900">Políticas Formais de Elegibilidade de Badges</h3>
              <p className="text-xs text-stone-700 mt-0.5">
                Critérios objetivos para a concessão automática e manual dos 5 distintivos públicos da Lusofonia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(TRUST_ELIGIBILITY_POLICIES).map(policy => (
                <div key={policy.badgeType} className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                      {policy.badgeType === 'identity_verified' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                      {policy.badgeType === 'authentic_profile' && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                      {policy.badgeType === 'trusted_member' && <UserCheck className="w-3.5 h-3.5 text-blue-600" />}
                      {policy.badgeType === 'respectful_dialogue' && <HeartHandshake className="w-3.5 h-3.5 text-purple-600" />}
                      {policy.badgeType === 'active_presence' && <Zap className="w-3.5 h-3.5 text-rose-500" />}
                      <span>{policy.title}</span>
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Público
                    </span>
                  </div>

                  <p className="text-xs text-stone-700 leading-snug">{policy.description}</p>

                  <div className="pt-2 border-t border-stone-200 text-[11px] space-y-1">
                    <div>
                      <span className="font-semibold text-stone-800">Critério: </span>
                      <span className="text-stone-700">{policy.criteriaSummary}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-stone-800">Dignidade Garantida: </span>
                      <span className="text-emerald-700 font-bold">Sim (Não-punitivo)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Policy Simulator */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-rose-600" />
                  Simulador Interativo de Elegibilidade do Trust Graph
                </h3>
                <p className="text-xs text-stone-700 mt-0.5">
                  Teste em tempo real como o motor de regras avalia as evidências e emite os badges públicos.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-stone-700 bg-stone-100 px-3 py-1 rounded-xl">
                Modo Sandbox
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Simulation Controls */}
              <div className="lg:col-span-6 space-y-3.5 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div>
                  <label className="text-xs font-bold text-stone-800 block mb-1">
                    Bio do Perfil (Comprimento: {simProfileBio.length} chars)
                  </label>
                  <textarea
                    rows={2}
                    value={simProfileBio}
                    onChange={e => setSimProfileBio(e.target.value)}
                    className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Nº de Fotos:</label>
                    <select
                      value={simPhotoCount}
                      onChange={e => setSimPhotoCount(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value={1}>1 Foto (Básica)</option>
                      <option value={2}>2 Fotos (Válida)</option>
                      <option value={4}>4+ Fotos (Rica)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Identidade Verificada:</label>
                    <select
                      value={simHasVerifiedId ? 'yes' : 'no'}
                      onChange={e => setSimHasVerifiedId(e.target.value === 'yes')}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="yes">Sim (Documento Validado)</option>
                      <option value="no">Não (Pendente)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Idade da Conta (Dias):</label>
                    <input
                      type="number"
                      value={simSafetyTenureDays}
                      onChange={e => setSimSafetyTenureDays(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Violações de Segurança:</label>
                    <input
                      type="number"
                      value={simViolations}
                      onChange={e => setSimViolations(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Diálogos Recíprocos:</label>
                    <input
                      type="number"
                      value={simReciprocalDialogue}
                      onChange={e => setSimReciprocalDialogue(Number(e.target.value))}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-800 block mb-1">Estado Online:</label>
                    <select
                      value={simIsOnline ? 'yes' : 'no'}
                      onChange={e => setSimIsOnline(e.target.value === 'yes')}
                      className="w-full p-2 text-xs bg-white border border-stone-200 rounded-lg"
                    >
                      <option value="yes">Online / Recente</option>
                      <option value="no">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Simulation Result */}
              <div className="lg:col-span-6 space-y-3.5 p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Resultado da Avaliação Backend
                  </span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                    {simulatedEvaluation.evaluatorAuthority}
                  </span>
                </div>

                {/* Badges Emitidos */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-stone-900 block">Badges Públicos Concedidos:</span>
                  {simulatedEvaluation.eligibleBadges.length === 0 ? (
                    <div className="p-3 bg-white rounded-lg border border-stone-200 text-xs text-stone-700">
                      Nenhum badge público emitido (critérios não atingidos ou violações pendentes).
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {simulatedEvaluation.eligibleBadges.map((b, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200 rounded-xl shadow-2xs text-xs font-bold text-stone-900"
                        >
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>{b.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sinais Privados */}
                <div className="pt-2 border-t border-stone-200 space-y-1 text-xs">
                  <span className="font-bold text-stone-900 block text-[11px] uppercase tracking-wider">
                    Sinais Privados Multidimensionais:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-stone-700 bg-white p-2.5 rounded-lg border border-stone-200">
                    <div>Identidade: <strong className="text-stone-900">{simulatedEvaluation.signals.identityEvidenceLevel}</strong></div>
                    <div>Autenticidade: <strong className="text-stone-900">{simulatedEvaluation.signals.profileAuthenticityLevel}</strong></div>
                    <div>Tenure Segurança: <strong className="text-stone-900">{simulatedEvaluation.signals.safetyTenureDays}d</strong></div>
                    <div>Violações: <strong className={simViolations > 0 ? 'text-red-600' : 'text-stone-900'}>{simViolations}</strong></div>
                  </div>
                </div>

                {/* Anti-humiliation Note */}
                {simViolations > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Garantia Anti-Humilhação</div>
                      <p className="text-[11px] text-rose-800">
                        O utilizador teve os badges retidos internamente, mas o seu perfil público NÃO exibe selos negativos, rótulos de punição ou notas depreciativas.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: MODERAÇÃO */}
      {currentTab === 'moderacao' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-2">Painel Geral de Moderação</h3>
            <p className="text-xs text-stone-700 mb-4">
              Métricas de conformidade e histórico de deliberações efetuadas pela equipa de moderadores CPLP.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Tempo Médio de Resposta</span>
                <span className="text-lg font-bold font-mono text-stone-900 mt-1 block">14.2 min</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Taxa de Falso Positivo</span>
                <span className="text-lg font-bold font-mono text-emerald-600 mt-1 block">2.1%</span>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-xs text-stone-700 block">Total Deliberações (30d)</span>
                <span className="text-lg font-bold font-mono text-stone-900 mt-1 block">142</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBMODULE: RESTRIÇÕES */}
      {currentTab === 'restricoes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              Restrições Operacionais Ativas
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Lista de utilizadores sob restrições temporárias (bloqueio de mensagens, mutes ou shadowbans).
            </p>

            {restrictions.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-700">Nenhuma restrição ativa no momento.</div>
            ) : (
              <div className="space-y-3">
                {restrictions.map(rst => (
                  <div key={rst.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-stone-900">{rst.userName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">
                          {rst.type}
                        </span>
                      </div>
                      <p className="text-xs text-stone-700 mt-1">Motivo: {rst.reason}</p>
                      <span className="text-[11px] text-stone-700 mt-1 block">
                        Aplicado por: {rst.appliedBy} · Expira em: {new Date(rst.expiresAt).toLocaleString('pt-PT')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveRestriction(rst.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 cursor-pointer self-start sm:self-auto"
                    >
                      Remover Restrição
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE: BLOQUEIOS */}
      {currentTab === 'bloqueios' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
            <h3 className="text-sm font-bold text-stone-900 mb-2 flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-600" />
              Bloqueios Permanentes & Banimentos
            </h3>
            <p className="text-xs text-stone-700 mb-4">
              Registo de contas banidas permanentemente da rede por infrações graves de segurança ou termos.
            </p>

            {blocks.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-700">Nenhum utilizador bloqueado.</div>
            ) : (
              <div className="space-y-3">
                {blocks.map(blk => (
                  <div key={blk.id} className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="font-bold text-xs text-stone-900">{blk.userName}</span>
                      <p className="text-xs text-stone-700 mt-1">Motivo: {blk.reason}</p>
                      <span className="text-[11px] text-stone-700 mt-1 block">
                        Banido por: {blk.blockedBy} em {new Date(blk.blockedAt).toLocaleDateString('pt-PT')}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveBlock(blk.id)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-xs font-semibold text-stone-700 cursor-pointer self-start sm:self-auto"
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMODULE: POLÍTICAS */}
      {currentTab === 'politicas' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-600" />
              Políticas da Comunidade & Termos de Uso
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="font-bold text-stone-900">1. Respeito Cultural & Lusofonia Sem Preconceito</div>
                <p className="text-stone-700 mt-1">Tolerância zero a xenofobia, racismo ou preconceito de sotaque e origem territorial.</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="font-bold text-stone-900">2. Autenticidade de Perfis & Anti-Catfish</div>
                <p className="text-stone-700 mt-1">Perfis devem representar indivíduos reais. Exigência de biometria para perfis denunciados.</p>
              </div>
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200">
                <div className="font-bold text-stone-900">3. Proteção Financeira Anti-Fraude</div>
                <p className="text-stone-700 mt-1">Proibição de solicitação de dinheiro, empréstimos ou esquemas de pirâmide no chat.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
