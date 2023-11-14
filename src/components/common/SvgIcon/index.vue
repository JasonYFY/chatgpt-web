<script setup lang='ts'>
import { computed, useAttrs } from 'vue'
import { Icon } from '@iconify/vue'
import type { IconifyIcon } from '@iconify/vue/dist/iconify.d'

interface Props {
  icon?: string | IconifyIcon
}

const props = defineProps<Props>()

const attrs = useAttrs()

const bindAttrs = computed<{ class: string; style: string }>(() => ({
  class: (attrs.class as string) || '',
  style: (attrs.style as string) || '',
}))
</script>

<template>
  <Icon :icon="props.icon!" v-bind="bindAttrs" />
</template>
