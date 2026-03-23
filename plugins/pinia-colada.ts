import { PiniaColada } from '@pinia/colada';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(PiniaColada, {
    queryOptions: {
      staleTime: 30_000,
      gcTime: 300_000,
    },
  });
});
