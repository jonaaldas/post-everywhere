<script setup lang="ts">
definePageMeta({
  middleware: 'guest',
})

import { Send } from 'lucide-vue-next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.register(email.value, password.value)
    router.push('/')
  } catch (e: any) {
    if (e.status === 403) {
      error.value = 'Registration is closed. This is a single-user app.'
    } else {
      error.value = e.data?.message || e.message || 'Registration failed'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="flex flex-1 items-center justify-center py-20">
    <Card class="w-full max-w-md border-border/70 bg-card/90 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.5)]">
      <CardHeader class="text-center">
        <div class="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <Send class="size-5 text-primary" />
        </div>
        <CardTitle class="text-2xl tracking-tight">Create account</CardTitle>
        <CardDescription>Get started with Post Everywhere</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="handleSubmit">
          <Alert v-if="error" variant="destructive">
            <AlertDescription>{{ error }}</AlertDescription>
          </Alert>
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input id="email" v-model="email" type="email" placeholder="you@example.com" required />
          </div>
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input id="password" v-model="password" type="password" placeholder="••••••••" minlength="8" required />
          </div>
          <Button type="submit" class="w-full" :disabled="loading">
            {{ loading ? 'Creating account...' : 'Create account' }}
          </Button>
          <p class="text-center text-sm text-muted-foreground">
            Already have an account?
            <RouterLink to="/login" class="font-medium text-primary hover:underline">Sign in</RouterLink>
          </p>
        </form>
      </CardContent>
    </Card>
  </section>
</template>
