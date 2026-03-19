const express = require('express')
const cors = require('cors')
const fs = require('fs')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

const PORT = process.env.PORT || 3000

const API_KEY = '5tHfsz0l5Gz4xY2WfHTF-f47D6JNmlak_EGTJKJivmeGBF-aiXqtjY5JD3PwrT0eNhEIzWK2aKv3u4-qwFs3Og9x7N68lkkOqFvm'
const DOMAIN = 'geo-market.salesdrive.me'

const FILE_PATH = './orders.json'

let orders = []

/* ---------------------- */
/* Читання з файлу */
/* ---------------------- */
function loadOrdersFromFile() {
  if (fs.existsSync(FILE_PATH)) {
    const data = fs.readFileSync(FILE_PATH)
    orders = JSON.parse(data)
    console.log(`📂 Завантажено з файлу: ${orders.length} замовлень`)
  } else {
    console.log('⚠️ Файл не знайдено, буде створений')
  }
}

/* ---------------------- */
/* Запис у файл */
/* ---------------------- */
function saveOrdersToFile() {
  fs.writeFileSync(FILE_PATH, JSON.stringify(orders, null, 2))
  console.log('💾 Дані збережено у файл')
}

/* ---------------------- */
/* Завантаження з CRM */
/* ---------------------- */
async function fetchOrders() {
  let currentPage = 1
  let hasMorePages = true
  let newOrders = []
  const now = new Date()
  const last30 = new Date()
  last30.setDate(now.getDate() - 30)

  const MAX_PAGES = 10 // не впираємось в ліміт

  console.log('🌐 Завантаження з CRM...')

  try {
    const delay = ms => new Promise(res => setTimeout(res, ms))
    while (hasMorePages) {
      const url = `https://${DOMAIN}/api/order/list/?page=${currentPage}&limit=100`

      const response = await fetch(url, {
        headers: { 'X-Api-Key': API_KEY },
      })

      const data = await response.json()

      if (data.status === 'error') {
        console.log('❌ API LIMIT:', data.message)
        break
      }

      const pageOrders = data.data || []

      if (pageOrders.length === 0) break

      newOrders.push(...pageOrders)

      currentPage++

      await delay(7000) // 👈 критично

      if (pageOrders.length < 100) break
    }

    // 👉 уникаємо дублікатів
    const existingIds = new Set(orders.map(o => o.id))
    const filtered = newOrders.filter(o => !existingIds.has(o.id))

    orders = [...filtered, ...orders]

    console.log(`➕ Додано нових: ${filtered.length}`)
    console.log(`📦 Всього: ${orders.length}`)

    saveOrdersToFile()
  } catch (err) {
    console.error('❌ Помилка:', err.message)
  }
}

/* ---------------------- */
/* API */
/* ---------------------- */
app.get('/api/orders', (req, res) => {
  res.json(orders)
})

async function fetchOrdersByYear(year) {
  let page = 1
  let all = []

  while (true) {
    const url = `https://${DOMAIN}/api/order/list/?page=${page}&limit=100&year=${year}`

    const res = await fetch(url, {
      headers: { 'X-Api-Key': API_KEY },
    })

    const data = await res.json()
    const pageOrders = data.data || []

    if (!pageOrders.length) break

    all.push(...pageOrders)

    page++

    await new Promise(res => setTimeout(res, 6000))
  }

  return all
}

app.listen(PORT, async () => {
  cconsole.log(`🚀 Server running on port ${PORT}`)

  loadOrdersFromFile()

  if (orders.length === 0) {
    console.log('📦 Первинне завантаження...')

    const years = [2024, 2025, 2026]
    let all = []

    for (const year of years) {
      const data = await fetchOrdersByYear(year)
      all.push(...data)
    }

    orders = all
    saveOrdersToFile()
  }

  await fetchOrders()

  setInterval(fetchOrders, 24 * 60 * 60 * 1000)

  console.log(`🚀 Сервер запущено`)
})
