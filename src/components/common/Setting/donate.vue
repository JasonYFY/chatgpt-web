<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue'
import { NSpin } from 'naive-ui'
const loading = ref(false)
</script>

<template>
  <NSpin :show="loading">
    <div class="p-4 space-y-4">
      <div class="p-2 space-y-2 rounded-md bg-neutral-100 dark:bg-neutral-700">
        <p>
          如果你觉得这个网站对你有帮助，并且情况允许的话，可以给我一点点支持，总之非常感谢支持～
        </p>
        <p>
					<img style="height: 270px;" src="https://cdn.jsdelivr.net/gh/JasonYFY/CDN/images/wechatReceipt.jpg" />
        </p>
      </div>
    </div>
  </NSpin>
</template>
