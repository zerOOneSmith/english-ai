// 本地存储 - 打卡计数 & 连续天数

const KEY = 'english_ai_checkin'

export function getTodayCount() {
  const data = JSON.parse(localStorage.getItem(KEY) || '{}')
  const today = new Date().toISOString().slice(0, 10)
  return data[today] || 0
}

export function incrementToday() {
  const data = JSON.parse(localStorage.getItem(KEY) || '{}')
  const today = new Date().toISOString().slice(0, 10)
  data[today] = (data[today] || 0) + 1
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function getStreak() {
  const data = JSON.parse(localStorage.getItem(KEY) || '{}')
  let streak = 0
  let date = new Date()
  while (true) {
    const key = date.toISOString().slice(0, 10)
    if (data[key] && data[key] > 0) {
      streak++
      date.setDate(date.getDate() - 1)
    } else {
      break
    }
  }
  return streak
}
