<template>
  <div class="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex flex-col max-w-md mx-auto">
    <!-- 顶部状态栏 -->
    <header class="px-4 py-3 flex items-center justify-between bg-white/80 backdrop-blur sticky top-0 z-10 shadow-sm">
      <div class="flex items-center gap-2">
        <span class="text-xl">📚</span>
        <h1 class="text-lg font-semibold text-gray-800">英语陪练</h1>
      </div>
      <div class="text-xs text-gray-500 text-right">
        <div>今日 {{ todayCount }} 次</div>
        <div>🔥 连续 {{ streak }} 天</div>
      </div>
    </header>

    <!-- 场景标签 -->
    <div v-if="currentScene" class="px-4 py-2">
      <div class="inline-flex items-center gap-1 bg-indigo-100 text-indigo-700 text-sm px-3 py-1 rounded-full">
        <MapPin class="w-4 h-4" />
        📍 {{ sceneLabel }}（{{ currentScene.description }}）
      </div>
    </div>

    <!-- 对话区 -->
    <main ref="chatRef" class="flex-1 overflow-y-auto px-4 py-2 chat-scroll">
      <!-- 空状态引导 -->
      <div v-if="messages.length === 0" class="text-center py-16 px-6">
        <div class="text-5xl mb-4">📷</div>
        <h2 class="text-lg font-medium text-gray-700 mb-2">拍一下你的场景</h2>
        <p class="text-sm text-gray-500">地铁、咖啡、办公室、家里……<br>AI会根据你拍的东西说简单英语</p>
      </div>

      <ChatBubble
        v-for="(msg, idx) in messages"
        :key="idx"
        :role="msg.role"
        :text="msg.text"
        :lines="msg.lines"
        @replay="handleReplay"
      />

      <!-- 加载中状态 -->
      <div v-if="loading" class="flex items-center gap-2 my-2 justify-start">
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
          <span class="text-base">👩‍🏫</span>
        </div>
        <div class="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-2">
          <Loader2 class="w-5 h-5 text-gray-400 animate-spin" />
        </div>
      </div>
    </main>

    <!-- 输入框（语音不可用时降级） -->
    <div v-if="!recognitionSupported" class="px-4 py-2">
      <div class="flex gap-2">
        <input
          v-model="textInput"
          @keyup.enter="sendText"
          type="text"
          placeholder="打字也可以练英语~"
          class="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-indigo-400"
        />
        <button
          @click="sendText"
          class="bg-indigo-500 text-white rounded-full px-4 py-2 text-sm hover:bg-indigo-600"
        >
          发送
        </button>
      </div>
    </div>

    <!-- 底部操作区 -->
    <footer class="px-4 py-4 bg-white/90 backdrop-blur border-t border-gray-100 pb-6">
      <div class="flex gap-3">
        <!-- 拍照按钮 -->
        <label class="flex-1 flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full py-3 font-medium active:scale-95 transition cursor-pointer">
          <Camera class="w-5 h-5" />
          拍一下
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            @change="handlePhoto"
          />
        </label>

        <!-- 语音按钮 -->
        <button
          v-if="recognitionSupported"
          @mousedown="startRecognition"
          @mouseup="stopRecognition"
          @mouseleave="stopRecognition"
          @touchstart.prevent="startRecognition"
          @touchend.prevent="stopRecognition"
          :class="[
            'flex items-center justify-center gap-2 rounded-full py-3 font-medium active:scale-95 transition min-w-[120px]',
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          ]"
        >
          <Mic class="w-5 h-5" />
          {{ isRecording ? '松开发送' : '按住说' }}
        </button>
      </div>

      <!-- 手动场景（识别失败备选） -->
      <div v-if="!currentScene && !loading" class="mt-3">
        <p class="text-xs text-gray-400 text-center mb-2">或手动选场景试试</p>
        <div class="flex gap-2 overflow-x-auto">
          <button
            v-for="s in presetScenes"
            :key="s.key"
            @click="selectPreset(s.key)"
            class="shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full"
          >
            {{ s.emoji }} {{ s.label }}
          </button>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { Camera, Mic, MapPin, Loader2 } from 'lucide-vue-next'
import ChatBubble from './components/ChatBubble.vue'
import { recognizeScene, generateEnglish } from './utils/api.js'
import { speak, speakAll, startListening, isRecognitionSupported } from './utils/speech.js'
import { getTodayCount, incrementToday, getStreak } from './utils/storage.js'

// ========== 状态 ==========
const messages = ref([])
const currentScene = ref(null)
const loading = ref(false)
const isRecording = ref(false)
const textInput = ref('')
const chatRef = ref(null)
const fileInputRef = ref(null)
const recognitionSupported = ref(false)
const todayCount = ref(0)
const streak = ref(0)

// 手动预设场景（识别失败时用）
const presetScenes = [
  { key: 'subway', label: '地铁', emoji: '🚇' },
  { key: 'coffee_shop', label: '咖啡', emoji: '☕' },
  { key: 'office', label: '办公室', emoji: '💼' },
  { key: 'restaurant', label: '餐厅', emoji: '🍽️' },
  { key: 'home', label: '家里', emoji: '🏠' },
]

const sceneLabel = computed(() => {
  const found = presetScenes.find(s => s.key === currentScene.value?.scene)
  return found ? `${found.emoji} ${found.label}` : currentScene.value?.scene || ''
})

// ========== 生命周期 ==========
onMounted(() => {
  recognitionSupported.value = isRecognitionSupported()
  todayCount.value = getTodayCount()
  streak.value = getStreak()
})

// ========== 滚动到底部 ==========
async function scrollBottom() {
  await nextTick()
  if (chatRef.value) {
    chatRef.value.scrollTop = chatRef.value.scrollHeight
  }
}

// ========== 拍照处理 ==========
async function handlePhoto(e) {
  const file = e.target.files?.[0]
  if (!file) return
  await processImage(file)
  // 重置input
  e.target.value = ''
}

async function processImage(file) {
  loading.value = true
  await scrollBottom()

  // 转base64
  const base64 = await fileToBase64(file)

  // 场景识别
  try {
    const scene = await recognizeScene(base64)
    currentScene.value = scene

    if (scene.confidence < 0.6) {
      messages.value.push({ role: 'ai', lines: ['Hmm, I am not sure what this is. Let\'s try a simple greeting!'] })
    }

    // AI生成英语
    const sentences = await generateEnglish(scene.scene, { description: scene.description })
    messages.value.push({ role: 'ai', lines: sentences })
    incrementToday()
    todayCount.value = getTodayCount()
    streak.value = getStreak()

    loading.value = false
    await scrollBottom()

    // 朗读
    await speakAll(sentences)
  } catch (err) {
    console.error(err)
    loading.value = false
    messages.value.push({ role: 'ai', lines: ['Sorry, something went wrong. Let\'s try again!'] })
    await scrollBottom()
  }
}

function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      // 去掉 data:image/xxx;base64, 前缀
      const result = e.target.result || ''
      resolve(result.split(',')[1] || result)
    }
    reader.readAsDataURL(file)
  })
}

// ========== 手动选场景 ==========
async function selectPreset(sceneKey) {
  loading.value = true
  await scrollBottom()

  currentScene.value = { scene: sceneKey, description: presetScenes.find(s => s.key === sceneKey)?.label || '', confidence: 1 }

  const sentences = await generateEnglish(sceneKey)
  messages.value.push({ role: 'ai', lines: sentences })
  incrementToday()
  todayCount.value = getTodayCount()
  streak.value = getStreak()

  loading.value = false
  await scrollBottom()
  await speakAll(sentences)
}

// ========== 语音交互 ==========
let listeningPromise = null

function startRecognition() {
  if (!recognitionSupported.value || isRecording.value) return
  isRecording.value = true
  listeningPromise = startListening()
}

async function stopRecognition() {
  if (!isRecording.value) return
  isRecording.value = false
  if (listeningPromise) {
    const text = await listeningPromise
    listeningPromise = null
    if (text?.trim()) {
      await handleUserReply(text.trim())
    }
  }
}

async function sendText() {
  const text = textInput.value.trim()
  if (!text) return
  textInput.value = ''
  await handleUserReply(text)
}

async function handleUserReply(text) {
  messages.value.push({ role: 'user', text })
  loading.value = true
  await scrollBottom()

  try {
    // 继续对话：用户说→AI根据之前场景+用户回复生成新内容
    const sceneKey = currentScene.value?.scene || 'unknown'
    const sentences = await generateEnglish(sceneKey, {
      description: currentScene.value?.description || '',
      userReply: text,
    })
    messages.value.push({ role: 'ai', lines: sentences })

    loading.value = false
    await scrollBottom()
    await speakAll(sentences)
  } catch (err) {
    console.error(err)
    loading.value = false
    messages.value.push({ role: 'ai', lines: ['Sorry, let\'s try again!'] })
    await scrollBottom()
  }
}

// ========== 重听 ==========
async function handleReplay(lines) {
  await speakAll(lines)
}
</script>
