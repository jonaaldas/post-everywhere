export interface WebTiktokSettings {
  privacyLevel: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY'
  allowComment: boolean
  allowDuet: boolean
  allowStitch: boolean
  videoCoverTimestampMs: number | null
  brandContentToggle: boolean
  brandOrganicToggle: boolean
  isAigc: boolean
  consentConfirmed: boolean
}

export interface WebTiktokCreatorInfo {
  creatorUsername: string
  creatorNickname: string
  creatorAvatarUrl: string
  privacyLevelOptions: string[]
  commentDisabled: boolean
  duetDisabled: boolean
  stitchDisabled: boolean
  maxVideoPostDurationSec: number
  canPost: boolean
  fetchedAt: string
}

export interface WebTiktokState {
  creatorInfo: WebTiktokCreatorInfo | null
  publishId: string | null
  publishStatus: string | null
  failReason: string | null
  proxy: {
    provider: 'evomi'
    country: 'US'
    sessionId: string
    exitIp: string | null
    verifiedAt: string | null
  } | null
}

export function parseTiktokJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function createDefaultTiktokSettings(
  creatorInfo: WebTiktokCreatorInfo | null | undefined,
): WebTiktokSettings {
  const privacyLevel =
    creatorInfo?.privacyLevelOptions.find((value) =>
      ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'].includes(value),
    ) ?? 'SELF_ONLY'

  return {
    privacyLevel: privacyLevel as WebTiktokSettings['privacyLevel'],
    allowComment: !creatorInfo?.commentDisabled,
    allowDuet: !creatorInfo?.duetDisabled,
    allowStitch: !creatorInfo?.stitchDisabled,
    videoCoverTimestampMs: null,
    brandContentToggle: false,
    brandOrganicToggle: false,
    isAigc: true,
    consentConfirmed: false,
  }
}

export function canPublishTiktok(args: {
  mediaUrls: string[]
  settings: WebTiktokSettings | null
  creatorInfo: WebTiktokCreatorInfo | null
}): boolean {
  return Boolean(
    args.mediaUrls.length === 1 &&
      args.mediaUrls[0]?.toLowerCase().endsWith('.mp4') &&
      args.settings?.consentConfirmed &&
      args.creatorInfo?.canPost,
  )
}
