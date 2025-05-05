// YouTube API Response Types

export interface YouTubeSearchResponse {
  items: YouTubeSearchItem[];
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