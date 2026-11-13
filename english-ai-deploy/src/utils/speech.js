// 语音合成 + 语音识别 封装

/**
 * 朗读英语句子
 * @param {string} text
 * @param {object} opts
 * @param {number} opts.rate - 语速 0.5-2, 默认0.9
 * @param {() => void} opts.onEnd - 朗读结束回调
 */
export function speak(text, opts = {}) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported')
      resolve()
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = opts.rate ?? 0.9
    utter.pitch = 1
    utter.onend = () => {
      opts.onEnd?.()
      resolve()
    }
    utter.onerror = () => resolve()
    window.speechSynthesis.cancel() // 取消上一次
    window.speechSynthesis.speak(utter)
  })
}

export function speakAll(sentences, opts = {}) {
  return sentences.reduce(
    (promise, s) => promise.then(() => speak(s, opts).then(() => sleep(600))),
    Promise.resolve()
  )
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * 语音识别（语音转文字）
 * @returns {Promise<string>} 识别结果文字
 */
export function startListening() {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      resolve('') // 不支持则返回空，UI会降级为文字输入
      return
    }
    const rec = new SR()
    rec.lang = 'en-US'
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript
      resolve(text)
    }
    rec.onerror = () => resolve('')
    rec.onend = () => resolve('')
    rec.start()
  })
}

export function isSpeechSupported() {
  return 'speechSynthesis' in window
}

export function isRecognitionSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}
