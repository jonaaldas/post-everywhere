import { defineStore } from 'pinia';

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    draftTitle: 'Spring launch brief',
    selectedChannel: 'web',
    previewCount: 3,
  }),
  getters: {
    draftSummary: (state) => `${state.draftTitle} is queued for ${state.selectedChannel.toUpperCase()}.`,
  },
  actions: {
    selectChannel(channelId: string) {
      this.selectedChannel = channelId;
    },
    setDraftTitle(value: string | number) {
      this.draftTitle = String(value);
    },
    bumpPreviewCount() {
      this.previewCount += 1;
    },
  },
});
