export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]) {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === "string") return c.split(" ");
      return Object.entries(c)
        .filter(([, val]) => Boolean(val))
        .map(([key]) => key);
    })
    .filter(Boolean)
    .join(" ");
}

export function formatCompactNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(".", ",") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(".", ",") + "k";
  }
  return num.toString();
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat("pt-BR").format(num);
}

export function formatPercent(num?: number | null): string {
  if (num == null || isNaN(num)) return "—";
  return (
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(num) + "%"
  );
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)).toString().replace(".", ",") + " " + sizes[i];
}

const SAO_PAULO_TZ = "America/Sao_Paulo";

export function getSaoPauloDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isDateInSaoPauloInterval(
  timestampStr?: string | null,
  startDateStr?: string,
  endDateStr?: string
): boolean {
  if (!timestampStr) return false;
  const d = new Date(timestampStr);
  if (isNaN(d.getTime())) return false;

  const itemDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

  if (startDateStr && itemDateStr < startDateStr) return false;
  if (endDateStr && itemDateStr > endDateStr) return false;
  return true;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: SAO_PAULO_TZ,
  });
}

export function formatTime(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SAO_PAULO_TZ,
  });
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return `${formatDate(dateString)} às ${formatTime(dateString)}`;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
