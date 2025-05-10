// YouTube API Response Types

export interface YouTubeErrorResponse {
  error: {
    code: number;
    message: string;
    errors: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
  error?: YouTubeErrorResponse['error'];
}

export interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
  };
}

export interface YouTubeVideoResponse {
  items: YouTubeVideoItem[];
  error?: YouTubeErrorResponse['error'];
}

export interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
  };
  contentDetails: {
    duration: string;
    definition: string;
  };
  status: {
    privacyStatus: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
  };
}

export interface ScoredVideo {
  id: string;
  score: number;
  title: string;
}