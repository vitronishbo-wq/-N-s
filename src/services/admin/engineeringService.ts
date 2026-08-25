import { EngineeringHealthStatus, EngineeringJob, EngineeringErrorEntry, AdminUser } from '../../types';
import { AuditService } from './auditService';

export class EngineeringService {
  private static instance: EngineeringService;
  private jobs: EngineeringJob[] = [
    {
      id: 'job_cache_cleanup',
      name: 'Purge & Warm Cache de Descoberta',
      type: 'cleanup',
      schedule: 'A cada 30 min',
      lastRunStatus: 'success',
      lastRunAt: Date.now() - 900000,
      durationMs: 420
    },
    {
      id: 'job_cplp_sync',
      name: 'Sincronização de Sinais CPLP & Fraude',
      type: 'sync',
      schedule: 'A cada 15 min',
      lastRunStatus: 'success',
      lastRunAt: Date.now() - 600000,
      durationMs: 1250
    },
    {
      id: 'job_ai_affinity_batch',
      name: 'Recálculo em Lote de Afinidade Cultural',
      type: 'ai_batch',
      schedule: 'A cada 6 horas',
      lastRunStatus: 'success',
      lastRunAt: Date.now() - 3600000 * 2,
      durationMs: 8400
    },
    {
      id: 'job_daily_backup',
      name: 'Backup Estruturado de Firestore / Auth',
      type: 'backup',
      schedule: 'Diário (03:00 UTC)',
      lastRunStatus: 'success',
      lastRunAt: Date.now() - 3600000 * 8,
      durationMs: 14200
    }
  ];

  private errors: EngineeringErrorEntry[] = [
    {
      id: 'err_ws_reconnect_cv',
      service: 'Realtime WebSocket CV Gateway',
      message: 'Timeout temporário em handshake de socket no gateway Praia/CV.',
      occurrences: 4,
      firstSeenAt: Date.now() - 3600000 * 5,
      lastSeenAt: Date.now() - 3600000 * 1,
      status: 'acknowledged'
    },
    {
      id: 'err_sms_dili_rate',
      service: 'SMS OTP Gateway TL',
      message: 'Rate limit excedido em operadora parceira em Díli (Timor-Leste).',
      occurrences: 2,
      firstSeenAt: Date.now() - 3600000 * 12,
      lastSeenAt: Date.now() - 3600000 * 3,
      status: 'unresolved'
    }
  ];

  public static getInstance(): EngineeringService {
    if (!EngineeringService.instance) {
      EngineeringService.instance = new EngineeringService();
    }
    return EngineeringService.instance;
  }

  /**
   * 4.14: Engineering operational observability (health, metrics, jobs, errors, versions)
   */
  public getHealthStatus(): EngineeringHealthStatus {
    return {
      status: 'healthy',
      uptimePercentage30d: 99.98,
      activeAppVersion: 'v2.1.0-control-cplp',
      lastDeploymentTimestamp: Date.now() - 14400000,
      liveMetrics: {
        timestamp: Date.now(),
        latencyP95Ms: 38,
        errorRatePercent: 0.015,
        activeSessions: 1840,
        discoveryThroughputPerMin: 410,
        memoryUsagePercent: 34.2
      },
      systemAlerts: [
        {
          id: 'alt_1',
          level: 'info',
          service: 'Discovery Engine',
          message: 'Cache de pontuação de compatibilidade com taxa de acerto de 96.1%.',
          timestamp: Date.now() - 3600000
        },
        {
          id: 'alt_2',
          level: 'info',
          service: 'Media Light-First Pipeline',
          message: 'Otimização WebP/AVIF com redução média de 81% no payload de rede.',
          timestamp: Date.now() - 7200000
        }
      ]
    };
  }

  public getJobs(): EngineeringJob[] {
    return [...this.jobs];
  }

  public triggerJob(jobId: string, actor: AdminUser): { success: boolean; error?: string } {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return { success: false, error: 'Job não encontrado' };

    job.lastRunStatus = 'running';
    setTimeout(() => {
      job.lastRunStatus = 'success';
      job.lastRunAt = Date.now();
      job.durationMs = Math.floor(Math.random() * 2000) + 300;
    }, 1500);

    AuditService.getInstance().logEvent(actor, {
      module: 'engineering',
      resourceType: 'cron_job',
      resourceId: jobId,
      action: 'MANUAL_JOB_EXECUTION',
      newState: { status: 'triggered' },
      justification: `Execução manual do job ${job.name}`
    });

    return { success: true };
  }

  public getErrors(): EngineeringErrorEntry[] {
    return [...this.errors];
  }

  public resolveError(errorId: string, actor: AdminUser): { success: boolean; error?: string } {
    const err = this.errors.find(e => e.id === errorId);
    if (!err) return { success: false, error: 'Erro não encontrado' };

    err.status = 'resolved';

    AuditService.getInstance().logEvent(actor, {
      module: 'engineering',
      resourceType: 'engineering_error',
      resourceId: errorId,
      action: 'RESOLVE_ERROR_ENTRY',
      newState: { status: 'resolved' },
      justification: `Erro resolvido manualmente por ${actor.displayName}`
    });

    return { success: true };
  }
}

