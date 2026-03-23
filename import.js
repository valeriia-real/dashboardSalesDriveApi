const mongoose = require('mongoose')
const fs = require('fs')

// 🔐 твій MongoDB connection string
const MONGO_URL =
  'mongodb+srv://lera2005olex_db_user:fufghYHKcsaf254cv@cluster1.dvxjrod.mongodb.net/salesDB?appName=Cluster1'

const orderSchema = new mongoose.Schema({}, { strict: false })
const Order = mongoose.model('Order', orderSchema)

async function importData() {
  try {
    await mongoose.connect(MONGO_URL)
    console.log('✅ Mongo connected')

    const raw = fs.readFileSync('orders.json')
    const data = JSON.parse(raw)

    console.log(`📦 Orders to import: ${data.length}`)

    // ❗ очистити базу (опціонально)
    await Order.deleteMany({})

    await Order.insertMany(data)

    console.log('🚀 Import completed')

    process.exit()
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

importData()
