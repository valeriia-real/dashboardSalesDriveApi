const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(__dirname))

// 🔥 PORT для Render
const PORT = process.env.PORT || 3000

// 🔐 ENV
const API_KEY = process.env.API_KEY
const MONGO_URL = process.env.MONGO_URL
const DOMAIN = 'geo-market.salesdrive.me'

// ----------------------
// MongoDB підключення
// ----------------------
mongoose
  .connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ Mongo error:', err))

// ----------------------
// Модель (гнучка)
// ----------------------
const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

// ----------------------
// Отримати замовлення з API
// ----------------------

let isFetching = false
const MAX_PAGES = 20 // обмеження щоб не спамити API

async function fetchOrders() {
  if (isFetching) return
  isFetching = true

  let page = 1
  let hasMore = true
  let newOrders = []

  console.log('🌐 Завантаження замовлень...')

  try {
    while (hasMore && page <= MAX_PAGES) {
      const url = `https://${DOMAIN}/api/order/list/?page=${page}&limit=100`

      const res = await fetch(url, {
        headers: { 'X-Api-Key': API_KEY },
      })

      const data = await res.json()

      if (data.status === 'error') {
        console.log('❌ API LIMIT:', data.message)
        break
      }

      const orders = data.data || []

      if (!orders.length) break

      // 👉 додаємо тільки ті, яких ще немає в базі
      for (const order of orders) {
        const exists = await Order.findOne({ id: order.id })

        if (!exists) {
          newOrders.push(order)
        }
      }

      page++

      // якщо менше 100 — це остання сторінка
      if (orders.length < 100) break

      // 🔥 затримка між запитами
      await new Promise(res => setTimeout(res, 6000))
    }

    if (!newOrders.length) {
      console.log('📭 Нових замовлень немає')
      return
    }

    // ----------------------
    // Збереження в MongoDB
    // ----------------------
    await Order.insertMany(newOrders, { ordered: false })

    const total = await Order.countDocuments()

    console.log(`➕ Додано нових: ${newOrders.length}`)
    console.log(`📦 Всього в базі: ${total}`)
  } catch (err) {
    console.error('❌ Помилка:', err.message)
  } finally {
    isFetching = false
  }
}

// ----------------------
// API
// ----------------------
app.get('/api/orders', async (req, res) => {
  try {
    const data = await Order.find().sort({ _id: -1 })
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

// ----------------------
// Старт сервера
// ----------------------
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`)

  // 🔥 перший запуск
  await fetchOrders()

  // 🔁 раз на 24 години
  setInterval(fetchOrders, 24 * 60 * 60 * 1000)

  console.log('🚀 Сервер запущено')
})
