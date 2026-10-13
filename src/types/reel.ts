export interface ReelPublishRequest {
  videoUrl: string;
  caption: string;
  scheduledTime?: string | null;
  coverUrl?: string;
  shareToFeed?: boolean;
}

export interface ReelPublishResponse {
  success: boolean;
  message: string;
  containerId?: string;
  creationTime: string;
  data: {
    videoUrl: string;
    caption: string;
    status: "simulated" | "published" | "scheduled";
    scheduledTime?: string | null;
  };
}
