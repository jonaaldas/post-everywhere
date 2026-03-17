export type TiktokPrivacyLevel =
  | 'PUBLIC_TO_EVERYONE'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'SELF_ONLY';

export interface TiktokSettings {
  privacyLevel: TiktokPrivacyLevel;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  videoCoverTimestampMs: number | null;
  brandContentToggle: boolean;
  brandOrganicToggle: boolean;
  isAigc: boolean;
  consentConfirmed: boolean;
}

export interface TiktokCreatorInfo {
  creatorUsername: string;
  creatorNickname: string;
  creatorAvatarUrl: string;
  privacyLevelOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
  canPost: boolean;
  fetchedAt: string;
}

export interface TiktokProxyState {
  provider: 'evomi';
  country: 'US';
  sessionId: string;
  exitIp: string | null;
  verifiedAt: string | null;
}

export interface TiktokState {
  creatorInfo: TiktokCreatorInfo | null;
  publishId: string | null;
  publishStatus: string | null;
  failReason: string | null;
  proxy: TiktokProxyState | null;
}
