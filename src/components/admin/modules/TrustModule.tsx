import React, { useState } from 'react';
import { ModuleProps } from '../moduleRegistry';
import { TrustService } from '../../../services/admin/trustService';
import { RbacService } from '../../../services/admin/rbacService';
import { TrustReview, TrustDecisionOutcome } from '../../../types';
import { ShieldAlert, CheckCircle2, UserCheck, AlertTriangle, Eye, ArrowRight, Clock } from 'lucide-react';

export const TrustModule: React.FC<ModuleProps> = ({ currentAdmin }) => {
  const trustService = TrustService.getInstance();
  const rbac = RbacService.getInstance();

  const [reviews, setReviews] = useState<TrustReview[]>(() => trustService.getReviews());
  const [selectedReview, setSelectedReview] = useState<TrustReview | null>(null);
  const [outcome, setOutcome] = useState<TrustDecisionOutcome>('require_verification');
  const [justification, setJustification] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const canDecide = rbac.can(currentAdmin, 'trust:decision');
  const canReview = rbac.can(currentAdmin, 'trust:review');

  const reload = () => {
    setReviews(trustService.getReviews());
  };

  const handleAssign = (reviewId: string) => {
    if (trustService.assignReview(reviewId, currentAdmin)) {
      reload();
      if (selectedReview?.id === reviewId) {
        setSelectedReview(prev => prev ? { ...prev, status: 'in_review' } : null);
      }
    }
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
      setJustification('');
      setSelectedReview(null);
      reload();
    } else {
      alert(res.error || 'Erro ao processar decisão de moderação.');
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (filterStatus === 'all') return true;
    return r.status === filterStatus;
  });

  return (
    <div className="space-y-6 text-stone-900">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            Trust & Safety Lifecycle
          </span>
          <span className="text-xs text-stone-700">
            Signal → Detection → Review → Decision → Action → Audit
          </span>
        </div>
        <h2 className="text-base font-bold text-stone-900 mt-1">Fila de Moderação & Proteção Cultural</h2>
        <p className="text-xs text-stone-700 mt-0.5 max-w-xl">
          Denúncias e anomalias são sinais que passam por detecção heurística e deliberação humana. Nenhum utilizador é banido automaticamente por mero reporte.
        </p>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {['all', 'pending', 'in_review', 'resolved'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer ${
                filterStatus === st
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {st === 'all' && 'Todos'}
              {st === 'pending' && 'Pendentes'}
              {st === 'in_review' && 'Em Revisão'}
              {st === 'resolved' && 'Resolvidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Review Queue List */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900">Casos na Fila ({filteredReviews.length})</h3>
            <span className="text-xs text-stone-700">Selecione para inspecionar</span>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-xs font-medium text-stone-700">Nenhum caso pendente neste filtro.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredReviews.map(rev => {
                const isSelected = selectedReview?.id === rev.id;
                return (
                  <div
                    key={rev.id}
                    onClick={() => setSelectedReview(rev)}
                    className={`p-4 rounded-2xl border transition cursor-pointer text-xs ${
                      isSelected
                        ? 'bg-rose-50/50 border-rose-400 ring-1 ring-rose-400'
                        : 'bg-white border-stone-200 hover:border-stone-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rev.severity === 'high'
                              ? 'bg-rose-100 text-rose-800'
                              : rev.severity === 'medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {rev.severity}
                        </span>
                        <span className="font-semibold text-stone-900">Alvo: {rev.targetUid}</span>
                      </div>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          rev.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rev.status === 'in_review'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-stone-100 text-stone-700'
                        }`}
                      >
                        {rev.status === 'resolved' ? 'Resolvido' : rev.status === 'in_review' ? 'Em Revisão' : 'Pendente'}
                      </span>
                    </div>

                    <p className="text-stone-700 mt-2 line-clamp-2">{rev.description}</p>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-stone-700 pt-2 border-t border-stone-100">
                      <span>Categoria: <strong className="text-stone-700">{rev.category}</strong></span>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-stone-700" />
                        <span>{new Date(rev.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Case Inspection & Deliberation Panel */}
        <div className="lg:col-span-6">
          {selectedReview ? (
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4 text-xs sticky top-4">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <span className="text-[10px] font-mono uppercase text-stone-700">Revisão #{selectedReview.id}</span>
                  <h3 className="text-sm font-bold text-stone-900 mt-0.5">Alvo: {selectedReview.targetUid}</h3>
                </div>
                {selectedReview.status === 'pending' && canReview && (
                  <button
                    type="button"
                    onClick={() => handleAssign(selectedReview.id)}
                    className="px-3 py-1.5 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition cursor-pointer"
                  >
                    Assumir Caso
                  </button>
                )}
              </div>

              {/* Heuristic Detection Breakdown */}
              {selectedReview.detection && (
                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-800 text-[11px]">Detecção Heurística de Risco</span>
                    <span className="font-mono font-bold text-rose-600">
                      Score: {(selectedReview.detection.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedReview.detection.ruleMatches.map(r => (
                      <span key={r} className="text-[10px] px-2 py-0.5 bg-white border border-stone-200 rounded font-mono text-stone-700">
                        {r}
                      </span>
                    ))}
                  </div>
                  {selectedReview.detection.suggestedAction && (
                    <p className="text-[11px] text-stone-700">
                      Sugestão do modelo: <strong className="text-stone-800">{selectedReview.detection.suggestedAction}</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Deliberation Form */}
              {selectedReview.status !== 'resolved' && canDecide ? (
                <form onSubmit={handleDeliberate} className="space-y-3 pt-2">
                  <h4 className="font-bold text-stone-900 text-xs">Deliberação Administrativa</h4>
                  <div>
                    <label className="block text-stone-700 font-medium mb-1">Decisão / Ação</label>
                    <select
                      value={outcome}
                      onChange={e => setOutcome(e.target.value as TrustDecisionOutcome)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="dismiss">Arquivar (Sem infração comprovada)</option>
                      <option value="warning">Aviso Formal de Conduta</option>
                      <option value="require_verification">Exigir Verificação de Identidade CPLP</option>
                      <option value="temporary_restriction">Restrição Temporária (48h)</option>
                      <option value="permanent_ban">Banimento Permanente & Bloqueio Bilateral</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-stone-700 font-medium mb-1">Justificativa da Auditoria</label>
                    <textarea
                      required
                      rows={3}
                      value={justification}
                      onChange={e => setJustification(e.target.value)}
                      placeholder="Descreva a fundamentação da decisão para o registo imutável de auditoria..."
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-xs cursor-pointer"
                  >
                    Confirmar Decisão & Executar Ação
                  </button>
                </form>
              ) : selectedReview.status === 'resolved' ? (
                <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-200 text-emerald-800">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Caso Concluído & Auditado</span>
                  </div>
                  <p className="text-[11px] mt-1 text-emerald-700">
                    A deliberação foi executada e a mutação correspondente registrada na trilha imutável de auditoria.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="bg-stone-50 rounded-2xl p-12 border border-dashed border-stone-300 text-center text-stone-700 text-xs">
              <Eye className="w-8 h-8 text-stone-700 mx-auto mb-2" />
              <p>Selecione um caso na fila para visualizar os sinais e deliberações.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
