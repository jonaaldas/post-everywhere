import { describe, expect, it } from 'vitest'

import { canPublishTiktok, createDefaultTiktokSettings, parseTiktokJson } from './tiktok'

describe('lib/tiktok', () => {
  it('parses serialized TikTok JSON', () => {
    expect(parseTiktokJson<{ publishId: string }>('{"publishId":"pub-1"}')).toEqual({
      publishId: 'pub-1',
    })
  })

  it('creates default settings from creator capabilities', () => {
    const settings = createDefaultTiktokSettings({
      creatorUsername: 'creator',
      creatorNickname: 'Creator',
      creatorAvatarUrl: 'https://avatar.test',
      privacyLevelOptions: ['MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
      commentDisabled: true,
      duetDisabled: false,
      stitchDisabled: true,
      maxVideoPostDurationSec: 600,
      canPost: true,
      fetchedAt: '2026-03-17T10:00:00Z',
    })

    expect(settings.privacyLevel).toBe('MUTUAL_FOLLOW_FRIENDS')
    expect(settings.allowComment).toBe(false)
    expect(settings.allowDuet).toBe(true)
    expect(settings.allowStitch).toBe(false)
  })

  it('allows publish only when a creator can post, one mp4 exists, and consent is confirmed', () => {
    expect(
      canPublishTiktok({
        mediaUrls: ['https://cdn.example.com/demo.mp4'],
        settings: {
          privacyLevel: 'SELF_ONLY',
          allowComment: true,
          allowDuet: true,
          allowStitch: true,
          videoCoverTimestampMs: null,
          brandContentToggle: false,
          brandOrganicToggle: false,
          isAigc: true,
          consentConfirmed: true,
        },
        creatorInfo: {
          creatorUsername: 'creator',
          creatorNickname: 'Creator',
          creatorAvatarUrl: 'https://avatar.test',
          privacyLevelOptions: ['SELF_ONLY'],
          commentDisabled: false,
          duetDisabled: false,
          stitchDisabled: false,
          maxVideoPostDurationSec: 600,
          canPost: true,
          fetchedAt: '2026-03-17T10:00:00Z',
        },
      }),
    ).toBe(true)
  })
})
