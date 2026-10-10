/**
 * Utilitário de Cálculo de Horários e Agendamento - Timezone America/Sao_Paulo
 * 
 * Garante que:
 * 1. A data inicial seja estritamente calculada na timezone de São Paulo (UTC-3).
 * 2. Horários que já passaram no dia de hoje sejam automaticamente pulados (sem posts retroativos).
 * 3. A janela de variação anti-detecção seja calculada UMA ÚNICA VEZ no momento do agendamento.
 * 4. A ordem original dos vídeos seja preservada em slots futuros sequenciais.
 */

const SAO_PAULO_TZ = "America/Sao_Paulo";

/**
 * Retorna a data atual em formato YYYY-MM-DD no fuso horário de São Paulo.
 * Evita o bug de virar o dia antecipadamente para amanhã após as 21:00 UTC-3.
 */
export function getSaoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Retorna o horário atual em formato HH:mm no fuso horário de São Paulo.
 */
export function getSaoPauloTimeString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: SAO_PAULO_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export interface ScheduleSlotOptions {
  itemsCount: number;
  startDateStr: string; // formato YYYY-MM-DD
  dailyTimes: string[]; // ex: ["09:00", "12:00", "15:00", "18:00", "21:00"]
  useRandomVariation?: boolean;
  randomVariationMinutes?: number;
  referenceNow?: Date;
}

/**
 * Calcula a lista de timestamps ISO (UTC) correspondentes a cada um dos itens da fila.
 * Cada timestamp representa a data/hora exata em que o item deve ser disparado.
 */
export function calculateScheduleSlots({
  itemsCount,
  startDateStr,
  dailyTimes,
  useRandomVariation = true,
  randomVariationMinutes = 5,
  referenceNow = new Date(),
}: ScheduleSlotOptions): string[] {
  if (itemsCount <= 0) return [];

  // Garante que haja ao menos um horário diário configurado
  const sortedTimes = (dailyTimes.length > 0 ? dailyTimes : ["18:00"])
    .filter((t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t))
    .sort();

  if (sortedTimes.length === 0) {
    sortedTimes.push("18:00");
  }

  const nowMs = referenceNow.getTime();
  const scheduledSlots: string[] = [];

  // Parse seguro da data inicial
  const [startYear, startMonth, startDay] = (startDateStr || getSaoPauloDateString(referenceNow))
    .split("-")
    .map(Number);

  // Trabalha com datas no calendário civil
  let currentYear = startYear || referenceNow.getFullYear();
  let currentMonth = startMonth || referenceNow.getMonth() + 1;
  let currentDay = startDay || referenceNow.getDate();

  // Limite de segurança de 365 dias para evitar loops infinitos
  let daysIterated = 0;
  const maxDays = 365;

  while (scheduledSlots.length < itemsCount && daysIterated < maxDays) {
    const yStr = String(currentYear).padStart(4, "0");
    const mStr = String(currentMonth).padStart(2, "0");
    const dStr = String(currentDay).padStart(2, "0");
    const datePrefix = `${yStr}-${mStr}-${dStr}`;

    for (const timeStr of sortedTimes) {
      if (scheduledSlots.length >= itemsCount) break;

      // Monta o timestamp com o offset estrito de São Paulo (-03:00)
      const candidateIsoLocal = `${datePrefix}T${timeStr}:00-03:00`;
      const baseDate = new Date(candidateIsoLocal);

      // Se o horário base configurado para hoje já passou ou é iminente (< 1 min), avança para o próximo slot
      if (baseDate.getTime() <= nowMs + 60000) {
        continue;
      }

      let scheduledMs = baseDate.getTime();

      // Aplica variação aleatória de horário apenas UMA vez no momento da criação se solicitado
      if (useRandomVariation && randomVariationMinutes > 0) {
        const deltaMinutes =
          Math.floor(Math.random() * (2 * randomVariationMinutes + 1)) - randomVariationMinutes;
        const candidateMs = scheduledMs + deltaMinutes * 60 * 1000;
        
        // Garante que a variação não torne o horário retroativo (mantém pelo menos 60s no futuro)
        if (candidateMs > nowMs + 60000) {
          scheduledMs = candidateMs;
        }
      }

      // Regra rigorosa: 1 vídeo = 1 horário único, monotonicamente crescente sem colisão
      if (scheduledSlots.length > 0) {
        const lastSlotMs = new Date(scheduledSlots[scheduledSlots.length - 1]).getTime();
        if (scheduledMs <= lastSlotMs) {
          scheduledMs = lastSlotMs + 60000;
        }
      }

      scheduledSlots.push(new Date(scheduledMs).toISOString());
    }

    // Avança 1 dia civil
    const nextDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay + 1));
    currentYear = nextDate.getUTCFullYear();
    currentMonth = nextDate.getUTCMonth() + 1;
    currentDay = nextDate.getUTCDate();
    daysIterated++;
  }

  // Fallback de segurança se por algum motivo extremo não completou (ex: todos slots descartados)
  while (scheduledSlots.length < itemsCount) {
    const lastSlotMs =
      scheduledSlots.length > 0
        ? new Date(scheduledSlots[scheduledSlots.length - 1]).getTime()
        : nowMs + 3600000;
    const nextFallback = new Date(lastSlotMs + 3600000 * 4); // a cada 4 horas
    scheduledSlots.push(nextFallback.toISOString());
  }

  return scheduledSlots;
}
