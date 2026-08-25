import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { TrustService } from '../../../services/admin/trustService';
import { RbacService } from '../../../services/admin/rbacService';
import { TaskService } from '../../../services/admin/taskService';
import { AuditService } from '../../../services/admin/auditService';
import { TrustReview, TrustDecisionOutcome } from '../../../types';
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
  Check
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

  const canDecide = rbac.can(currentAdmin, 'trust:decision');
  const canReview = rbac.can(currentAdmin, 'trust:review');

  const reload = () => {
    setReviews(trustService.getReviews());
  };

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
