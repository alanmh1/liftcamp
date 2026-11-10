import { requireOptionalNativeModule } from 'expo';

export type TikTokShareResult = {
  /** `replaced`: another share started before TikTok answered this one. */
  status: 'shared' | 'cancelled' | 'failed' | 'denied' | 'replaced';
  errorCode?: number;
  shareState?: number;
};

type ShareTargetsModule = {
  tikTokConfigured: boolean;
  shareToInstagramStories(imageUri: string, appId: string, backgroundColor: string): Promise<boolean>;
  shareToTikTok(imageUri: string, redirectUri: string): Promise<TikTokShareResult>;
};

/** Null on Android, and on a build made before this module existed. */
export default requireOptionalNativeModule<ShareTargetsModule>('ShareTargets');
