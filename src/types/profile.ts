export interface ProfileData {
  bio: string;
  location: string;
  website: string;
  social: {
    twitter: string;
    instagram: string;
    telegram: string;
  };
  settings?: {
    notification_email: boolean;
    notification_web: boolean;
    privacy_profile: boolean;
    theme: string;
    language: string;
  };
}