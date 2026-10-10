import {
  Account,
  ReelQueue,
  CarouselQueue,
  ScheduledPost,
  PublishedPost,
  ErrorLog,
  NotificationItem,
  SystemStatus,
} from "@/types";

// Estado inicial real sem dados fictícios
export const MOCK_ACCOUNTS: Account[] = [];

export const MOCK_ERRORS: ErrorLog[] = [];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [];

export const MOCK_SYSTEM_STATUS: SystemStatus = {
  metaApi: "not_configured",
  database: "not_configured",
  storage: "not_configured",
};

export const MOCK_SCHEDULED_POSTS: ScheduledPost[] = [];

export const MOCK_PUBLISHED_POSTS: PublishedPost[] = [];

export const MOCK_REEL_QUEUES: ReelQueue[] = [];

export const MOCK_CAROUSEL_QUEUES: CarouselQueue[] = [];

export const MOCK_PROFILE_MEDIA: import("@/types").MediaItem[] = [];

export const MOCK_PROFILE_CAROUSELS: import("@/types").CarouselPost[] = [];
