/**
 * Utilitários e Lógica de Negócio para Filas e Agendamentos
 */

export class QueueService {
  /**
   * Embaralha um array de forma imutável (Algoritmo Fisher-Yates)
   */
  static shuffleArray<T>(items: T[]): T[] {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Gera horários automáticos bem distribuídos ao longo do dia com base na quantidade
   */
  static generateDefaultTimes(count: number): string[] {
    if (count <= 0) return [];
    if (count === 1) return ["18:00"];
    if (count === 2) return ["12:00", "19:00"];
    if (count === 3) return ["09:00", "15:00", "20:00"];
    if (count === 4) return ["09:00", "13:00", "17:00", "21:00"];
    if (count === 5) return ["09:00", "12:00", "15:00", "18:00", "21:00"];
    if (count === 6) return ["08:00", "11:00", "14:00", "17:00", "20:00", "22:00"];
    if (count === 7) return ["08:00", "10:30", "13:00", "15:30", "18:00", "20:30", "22:30"];
    if (count === 8) return ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

    // Mais de 8: calcula os minutos proporcionais entre 08:00 e 22:00
    const startHour = 8;
    const totalMinutes = 14 * 60; // 840 minutos
    const interval = Math.floor(totalMinutes / (count - 1));

    const times: string[] = [];
    for (let i = 0; i < count; i++) {
      const currentMinutes = startHour * 60 + i * interval;
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const formatted = `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
      times.push(formatted);
    }
    return times;
  }

  /**
   * Calcula a data estimada de término com base na quantidade total e itens por dia
   */
  static calculateEstimatedFinishDate(
    totalItems: number,
    itemsPerDay: number,
    startDateStr: string
  ): { totalDays: number; formattedDate: string } {
    if (totalItems <= 0 || itemsPerDay <= 0) {
      return { totalDays: 0, formattedDate: "-" };
    }

    const totalDays = Math.ceil(totalItems / itemsPerDay);
    const startDate = new Date(startDateStr || Date.now());
    
    // Adiciona totalDays
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays - 1);

    const formattedDate = endDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    return { totalDays, formattedDate };
  }
}
