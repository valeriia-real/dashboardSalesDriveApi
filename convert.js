const fs = require('fs')
const csv = require('csv-parser')

const STATUS_MAP = {
  Новий: 1,
  Підтверджено: 3,
  'Очікуємо оплату': 2,
  Недодзвонились: 19,
  Viber: 56,
  'Створено для відправки': 18,
  'В дорозі': 4,
  'Прибула у відділення': 17,
  'Змінено адресу': 31,
  Отримано: 5,
  Скасовано: 6,
  Повернення: 7,
  Самозакуп: 77,
}

const results = []

function parseNumber(value) {
  if (!value) return 0
  return Number(value.replace(/\s/g, '').replace(',', '.'))
}

function parseDate(value) {
  if (!value) return null

  // замінюємо ВСІ види пробілів на звичайний
  value = value.replace(/\s+/g, ' ').trim()

  const [date, time] = value.split(' ')
  if (!date || !time) return null

  const [year, month, day] = date.split('.')

  return new Date(`${year}-${month}-${day}T${time}.000Z`)
}

fs.createReadStream('orders.csv')
  .pipe(
    csv({
      separator: ';',
      mapHeaders: ({ header }) => header.trim(),
    }),
  )
  .on('data', row => {
    const rawStatus = (row['Статус'] || '').trim()

    const order = {
      id: row['Номер заявки'] ? Number(row['Номер заявки']) : null,
      orderTime: parseDate(row['Дата створення']),
      statusId: STATUS_MAP[rawStatus] ?? null,
      paymentAmount: parseNumber(row['Сума']),
      profitAmount: parseNumber(row['Прибуток']),
    }

    results.push(order)
  })
  .on('end', () => {
    fs.writeFileSync('orders.json', JSON.stringify(results, null, 2))
    console.log('✅ Done. Orders:', results.length)
  })
