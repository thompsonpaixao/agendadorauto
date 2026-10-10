/**
 * Configuração Central de Retenção de Dados do AgendadorAuto
 * 
 * Define prazos e políticas para expiração e expurgo de dados históricos,
 * logs de erros, notificações e métricas, em conformidade com as diretrizes da Meta e LGPD.
 */

export interface DataRetentionConfig {
  /** Dias para retenção de logs de erro técnicos (padrão: 30 dias) */
  errorLogsRetentionDays: number;
  /** Dias para retenção de notificações lidas do sistema (padrão: 60 dias) */
  notificationsRetentionDays: number;
  /** Dias para retenção do histórico de publicações concluídas (padrão: 180 dias) */
  publishedPostsHistoryDays: number;
  /** Dias para retenção de relatórios e métricas de desempenho (padrão: 90 dias) */
  analyticsHistoryDays: number;
  /** Se contas desativadas/excluídas sofrem expurgo imediato de dados (padrão: true) */
  immediatePurgeOnAccountDeletion: boolean;
}

export const DATA_RETENTION_POLICY: DataRetentionConfig = {
  errorLogsRetentionDays: 30,
  notificationsRetentionDays: 60,
  publishedPostsHistoryDays: 180,
  analyticsHistoryDays: 90,
  immediatePurgeOnAccountDeletion: true,
};

/**
 * Calcula a data limite de corte (ISO string) para expurgo com base na janela em dias.
 */
export function getRetentionCutoffDate(days: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff.toISOString();
}

/**
 * Verifica se um registro com timestamp ISO ultrapassou o período de retenção permitido.
 */
export function isExpiredByRetention(timestamp: string, retentionDays: number): boolean {
  try {
    const recordDate = new Date(timestamp).getTime();
    const cutoffDate = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    return recordDate < cutoffDate;
  } catch {
    return false;
  }
}
