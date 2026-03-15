<script setup lang="ts">
import { Github, Linkedin, Twitter, Check, X, Eye, EyeOff } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxViewport,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/composables/useApi';

interface Repo {
  fullName: string;
  name: string;
  private: boolean;
  description: string | null;
  updatedAt: string | null;
  watched: boolean;
}

interface RepoOption {
  value: string;
  label: string;
  description: string | null;
}

interface SocialConnection {
  platform: string;
  username: string | null;
  connected: boolean;
}

// GitHub
const pat = ref('');
const connectingGithub = ref(false);
const githubError = ref('');
const githubChecking = ref(true); // starts true to avoid flicker
const githubConnected = ref(false);
const githubUsername = ref('');
const selectedRepo = ref<RepoOption | undefined>();
const watchLoading = ref(false);
const repoDropdownOpen = ref(false);

const { data: repos, refetch: refetchRepos } = useQuery({
  key: ['github-repos'],
  query: () => api<Repo[]>('/github/repos'),
  enabled: () => githubConnected.value,
});

const unwatchedRepos = computed(() => repos.value?.filter((r) => !r.watched) ?? []);
const watchedRepos = computed(() => repos.value?.filter((r) => r.watched) ?? []);
const repoOptions = computed<RepoOption[]>(() =>
  unwatchedRepos.value.map((r) => ({
    value: r.fullName,
    label: `${r.fullName}${r.private ? ' 🔒' : ''}`,
    description: r.description,
  }))
);

// Check GitHub connection on mount — don't render card content until done
onMounted(async () => {
  try {
    await api<Repo[]>('/github/repos');
    githubConnected.value = true;
  } catch {
    githubConnected.value = false;
  } finally {
    githubChecking.value = false;
  }
});

async function connectGithub() {
  githubError.value = '';
  connectingGithub.value = true;
  try {
    const data = await api<{ connected: boolean; githubUsername: string }>('/github/connect', {
      method: 'POST',
      body: { pat: pat.value },
    });
    githubConnected.value = data.connected;
    githubUsername.value = data.githubUsername;
    pat.value = '';
    toast.success(`Connected as ${data.githubUsername}`);
    refetchRepos();
  } catch (e: any) {
    githubError.value = e.data?.message || e.data?.error || 'Failed to connect';
  } finally {
    connectingGithub.value = false;
  }
}

async function watchRepo() {
  if (!selectedRepo.value) return;
  watchLoading.value = true;
  const fullName = selectedRepo.value.value;
  try {
    const [owner, name] = fullName.split('/');
    await api(`/github/repos/${owner}/${name}/watch`, { method: 'POST' });
    toast.success(`Watching ${fullName}`);
    selectedRepo.value = undefined;
    refetchRepos();
  } catch (e: any) {
    toast.error(e.data?.message || e.data?.error || 'Failed to watch repo');
  } finally {
    watchLoading.value = false;
  }
}

async function unwatchRepo(fullName: string) {
  try {
    const [owner, name] = fullName.split('/');
    await api(`/github/repos/${owner}/${name}/watch`, { method: 'DELETE' });
    toast.success(`Unwatched ${fullName}`);
    refetchRepos();
  } catch (e: any) {
    toast.error(e.data?.message || e.data?.error || 'Failed to unwatch');
  }
}

// Social Connections
const { data: connections, refetch: refetchConnections } = useQuery({
  key: ['social-connections'],
  query: () => api<SocialConnection[]>('/social/connections'),
});

async function connectSocial(platform: string) {
  try {
    const data = await api<{ authUrl: string }>(`/social/${platform}/auth`);
    window.location.href = data.authUrl;
  } catch (e: any) {
    toast.error(e.data?.message || `Failed to start ${platform} auth`);
  }
}

async function disconnectSocial(platform: string) {
  try {
    await api(`/social/${platform}`, { method: 'DELETE' });
    toast.success(`Disconnected ${platform}`);
    refetchConnections();
  } catch (e: any) {
    toast.error(e.data?.message || 'Failed to disconnect');
  }
}

const platformIcon: Record<string, any> = {
  twitter: Twitter,
  linkedin: Linkedin,
};

// Check for ?connected= query param (OAuth callback redirect)
const route = useRoute();
onMounted(() => {
  const connected = route.query.connected as string;
  if (connected) {
    toast.success(`${connected} connected successfully!`);
    refetchConnections();
  }
});
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>

    <Tabs default-value="github">
      <TabsList>
        <TabsTrigger value="github">GitHub</TabsTrigger>
        <TabsTrigger value="social">Social Accounts</TabsTrigger>
      </TabsList>

      <TabsContent value="github" class="space-y-4 pt-4">
        <Card class="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Github class="size-5" />
              GitHub Connection
            </CardTitle>
            <CardDescription> Connect your GitHub account to watch repositories for merged PRs. </CardDescription>
          </CardHeader>
          <CardContent>
            <!-- Loading state — prevents flicker -->
            <div v-if="githubChecking" class="text-sm text-muted-foreground">Checking connection...</div>

            <!-- Connected state -->
            <div v-else-if="githubConnected" class="space-y-6">
              <div class="flex items-center gap-2">
                <Badge variant="default">Connected</Badge>
                <span v-if="githubUsername" class="text-sm text-muted-foreground"
                  >as <strong>{{ githubUsername }}</strong></span
                >
              </div>

              <!-- Watch a repo -->
              <div class="space-y-3">
                <Label>Watch a repository</Label>
                <div class="flex items-center gap-3">
                  <Combobox
                    v-model="selectedRepo"
                    by="value"
                    :open="repoDropdownOpen"
                    @update:open="repoDropdownOpen = $event"
                    :filter-function="
                      (list: RepoOption[], term: string) =>
                        term ? list.filter((r) => r.value.toLowerCase().includes(term.toLowerCase())) : list
                    "
                    class="relative w-[400px]"
                  >
                    <ComboboxAnchor>
                      <ComboboxInput
                        :display-value="(val: any) => val?.value ?? ''"
                        placeholder="Search repositories..."
                        @focus="repoDropdownOpen = true"
                      />
                    </ComboboxAnchor>
                    <ComboboxList side="bottom" align="start" class="w-[var(--reka-combobox-trigger-width)]">
                      <ComboboxViewport>
                        <ComboboxEmpty>No repositories found.</ComboboxEmpty>
                        <ComboboxGroup>
                          <ComboboxItem v-for="repo in repoOptions" :key="repo.value" :value="repo">
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-sm">{{ repo.value }}</p>
                              <p v-if="repo.description" class="truncate text-xs text-muted-foreground">
                                {{ repo.description }}
                              </p>
                            </div>
                            <ComboboxItemIndicator>
                              <Check class="ml-2 size-4 shrink-0" />
                            </ComboboxItemIndicator>
                          </ComboboxItem>
                        </ComboboxGroup>
                      </ComboboxViewport>
                    </ComboboxList>
                  </Combobox>
                  <Button :disabled="!selectedRepo || watchLoading" @click="watchRepo">
                    <Eye class="mr-1.5 size-4" />
                    {{ watchLoading ? 'Watching...' : 'Watch' }}
                  </Button>
                </div>
                <p v-if="selectedRepo?.description" class="text-xs text-muted-foreground">
                  {{ selectedRepo.description }}
                </p>
              </div>

              <!-- Watched repos -->
              <div v-if="watchedRepos.length" class="space-y-3">
                <Separator />
                <Label>Watched repositories</Label>
                <div
                  v-for="repo in watchedRepos"
                  :key="repo.fullName"
                  class="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium">{{ repo.fullName }}</p>
                    <p v-if="repo.description" class="truncate text-xs text-muted-foreground">{{ repo.description }}</p>
                  </div>
                  <Button size="sm" variant="outline" class="ml-3 shrink-0" @click="unwatchRepo(repo.fullName)">
                    <EyeOff class="mr-1.5 size-3.5" />
                    Unwatch
                  </Button>
                </div>
              </div>
            </div>

            <!-- Not connected — PAT form -->
            <form v-else class="space-y-3" @submit.prevent="connectGithub">
              <div class="space-y-2">
                <Label for="pat">Personal Access Token</Label>
                <Input id="pat" v-model="pat" type="password" placeholder="ghp_..." required />
                <p class="text-xs text-muted-foreground">
                  Needs <code>repo</code> and <code>admin:repo_hook</code> scopes.
                </p>
              </div>
              <p v-if="githubError" class="text-sm text-destructive">{{ githubError }}</p>
              <Button type="submit" :disabled="connectingGithub">
                {{ connectingGithub ? 'Connecting...' : 'Connect GitHub' }}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="social" class="space-y-4 pt-4">
        <Card v-for="conn in connections" :key="conn.platform" class="border-border/70 bg-card/85">
          <CardHeader>
            <CardTitle class="flex items-center gap-2 capitalize">
              <component :is="platformIcon[conn.platform]" class="size-5" />
              {{ conn.platform }}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="conn.connected" class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Badge variant="default">
                  <Check class="mr-1 size-3" />
                  Connected
                </Badge>
                <span v-if="conn.username" class="text-sm text-muted-foreground"> @{{ conn.username }} </span>
              </div>
              <Button variant="outline" size="sm" @click="disconnectSocial(conn.platform)">
                <X class="mr-1.5 size-3.5" />
                Disconnect
              </Button>
            </div>
            <div v-else>
              <Button @click="connectSocial(conn.platform)"> Connect {{ conn.platform }} </Button>
            </div>
          </CardContent>
        </Card>

        <p v-if="!connections?.length" class="text-sm text-muted-foreground">Loading connections...</p>
      </TabsContent>
    </Tabs>
  </div>
</template>
