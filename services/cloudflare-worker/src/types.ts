export interface Env {
  // Queue Bindings
  PUBLISH_QUEUE: Queue<PublishQueueMessage>;

  // Secrets & Configs
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;
  TOKEN_ENCRYPTION_KEY: string;

  // Cloudflare R2
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_REGION?: string;
  R2_READ_URL_TTL_SECONDS?: string;

  // Meta API
  META_GRAPH_VERSION?: string;
  MAX_PROCESSING_TIMEOUT_MINUTES?: string;

  // Operacional
  FEEDER_WINDOW_MINUTES?: string;
  GLOBAL_CONCURRENCY?: string;
}

export interface PublishQueueMessage {
  scheduledPostId: string;
}

export interface PublishResult {
  success: boolean;
  published?: boolean;
  processing?: boolean;
  instagramMediaId?: string;
  permalink?: string;
  error?: string;
  errorCode?: string;
  statusCode?: string;
  message?: string;
  rescheduled?: boolean;
}
