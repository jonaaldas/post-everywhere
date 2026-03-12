<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
</script>

<template>
  <section class="flex flex-1 items-center justify-center py-20">
    <Card class="w-full max-w-lg border-border/70 bg-card/90 text-center shadow-[0_20px_60px_-44px_rgba(15,23,42,0.5)]">
      <CardHeader>
        <CardTitle class="text-3xl tracking-[-0.04em]">Page not found</CardTitle>
        <CardDescription>
          The route exists in the file system only when there is a matching page component.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button as-child class="rounded-full px-5">
          <RouterLink to="/">Back to overview</RouterLink>
        </Button>
      </CardContent>
    </Card>
  </section>
</template>
