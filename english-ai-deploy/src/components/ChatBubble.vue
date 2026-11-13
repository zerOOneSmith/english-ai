<template>
  <!-- AI消息气泡 -->
  <div v-if="role === 'ai'" class="flex gap-2 my-2 justify-start">
    <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
      <span class="text-base">👩‍🏫</span>
    </div>
    <div class="flex flex-col gap-1 max-w-[75%]">
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2 text-gray-800 text-base"
      >
        {{ line }}
      </div>
      <button
        v-if="lines.length > 0"
        class="self-start text-xs text-indigo-500 px-2 py-1 flex items-center gap-1 hover:text-indigo-700"
        @click="$emit('replay', lines)"
      >
        <Play class="w-3 h-3" /> 🔊 再听一次
      </button>
    </div>
  </div>

  <!-- 用户消息气泡 -->
  <div v-else class="flex gap-2 my-2 justify-end">
    <div class="max-w-[75%]">
      <div class="bg-indigo-500 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-base">
        {{ text }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { Play } from 'lucide-vue-next'
defineProps({
  role: { type: String, required: true }, // 'ai' | 'user'
  text: { type: String, default: '' },
  lines: { type: Array, default: () => [] },
})
defineEmits(['replay'])
</script>
