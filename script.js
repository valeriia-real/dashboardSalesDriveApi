const dateRangeSelect = document.getElementById('dateRangeSelect')
const customDateRange = document.getElementById('customDateRange')
const startDateInput = document.getElementById('startDate')
const endDateInput = document.getElementById('endDate')
const headerMonth = document.querySelector('.header-month')
const monthPickerContainer = document.getElementById('monthPickerContainer')
const yearPickerContainer = document.getElementById('yearPickerContainer')
const monthPickerInput = document.getElementById('monthPicker')
const yearSelect = document.getElementById('yearSelect')
const ordersCountHeader = document.querySelector('.status-badge')

let orders = []

const EXCLUDED_STATUSES = [6, 7, 77]

/* ---------------------- */
/* Завантаження замовлень */
/* ---------------------- */
async function loadOrders() {
  try {
    const response = await fetch('https://dashboardsalesdriveapi.onrender.com/api/orders')
    orders = await response.json()

    updateDashboard('last_day')
  } catch (error) {
    console.error(error)
  }
}

/* ---------------------- */
/* Парсер дати */
/* ---------------------- */
function parseDate(dateString) {
  const [day, month, year] = dateString.split('.')
  return new Date(year, month - 1, day)
}

/* ---------------------- */
/* 🔥 ФОРМАТ ТІЛЬКИ ДАТИ */
/* ---------------------- */
function formatDateOnly(date) {
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

/* ---------------------- */
/* Фільтр періодів */
/* ---------------------- *

/* ---------------------- */
/* Оновлення дашборду */
/* ---------------------- */
async function updateDashboard(range) {
  const { start, end, title } = getDateRange(range)

  headerMonth.textContent = title

  const startStr = formatDateOnly(start)
  const endStr = formatDateOnly(end)

  const response = await fetch(`/api/orders?from=${startStr}&to=${endStr}`)
  const filtered = await response.json()

  updateMetrics(filtered)
  updateHeaderOrders(filtered)
}

function updateHeaderOrders(filteredOrders) {
  const validOrders = filteredOrders.filter(order => !EXCLUDED_STATUSES.includes(Number(order.statusId)))

  ordersCountHeader.textContent = validOrders.length.toLocaleString('uk-UA')
}

/* ---------------------- */
/* Метрики */
/* ---------------------- */
function updateMetrics(filtered) {
  const validOrders = filtered.filter(order => !EXCLUDED_STATUSES.includes(Number(order.statusId)))

  const count = validOrders.length

  const turnover = validOrders.reduce((sum, order) => {
    return sum + (Number(order.paymentAmount) || 0)
  }, 0)

  const avgCheck = count > 0 ? turnover / count : 0

  const profit = validOrders.reduce((sum, order) => {
    return sum + (Number(order.profitAmount) || 0)
  }, 0)

  // 🔥 ОБОРОТ (тепер правильно)
  document.querySelector('.neon-cyan .metric-value').textContent = turnover.toLocaleString('uk-UA') + ' ₴'

  // 🔥 КІЛЬКІСТЬ
  document.querySelector('.neon-yellow .metric-subtext').textContent = `${count} замовлень`

  // 🔥 СЕРЕДНІЙ ЧЕК
  document.querySelector('.neon-teal .metric-value').textContent =
    avgCheck.toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴'

  // 🔥 ПРИБУТОК
  document.querySelector('.neon-yellow .metric-value').textContent = profit.toLocaleString('uk-UA') + ' ₴'
}

/* ---------------------- */
/* Select логіка */
/* ---------------------- */
dateRangeSelect.addEventListener('change', e => {
  const value = e.target.value

  clearAllPickers()

  customDateRange.style.display = 'none'
  monthPickerContainer.style.display = 'none'
  yearPickerContainer.style.display = 'none'

  if (value === 'custom') customDateRange.style.display = 'block'

  if (value === 'month') {
    monthPickerContainer.style.display = 'block'
    setTimeout(() => monthPickerInput._flatpickr.open(), 0)
  }

  if (value === 'year') {
    yearPickerContainer.style.display = 'block'
  }

  if (['last_day', 'last_week', 'last_7_days', 'last_14_days'].includes(value)) {
    updateDashboard(value)
  }
})

/* ---------------------- */
/* Flatpickr */
/* ---------------------- */
flatpickr(startDateInput, { dateFormat: 'd.m.Y' })
flatpickr(endDateInput, { dateFormat: 'd.m.Y' })

flatpickr(monthPickerInput, {
  plugins: [
    new monthSelectPlugin({
      shorthand: false,
      dateFormat: 'm.Y',
      altFormat: 'F Y',
    }),
  ],
  onChange: function (selectedDates) {
    if (!selectedDates.length) return

    const date = selectedDates[0]
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)

    const monthName = date.toLocaleString('uk-UA', { month: 'long' }).toUpperCase()
    const year = date.getFullYear()

    headerMonth.textContent = `${monthName} ${year}`

    updateDashboardCustom(start, end)
  },
})

yearSelect.addEventListener('change', () => {
  const year = parseInt(yearSelect.value)
  const start = new Date(year, 0, 1)
  const end = new Date(year, 11, 31)

  headerMonth.textContent = year.toString()
  updateDashboardCustom(start, end)
})

function populateYearSelect(startYear = 2020, endYear = new Date().getFullYear()) {
  yearSelect.innerHTML = ''
  for (let y = endYear; y >= startYear; y--) {
    const option = document.createElement('option')
    option.value = y
    option.textContent = y
    yearSelect.appendChild(option)
  }
}

populateYearSelect()

/* ---------------------- */
/* Custom dashboard */
/* ---------------------- */
function updateDashboardCustom(start, end) {
  const startStr = formatDateOnly(start)
  const endStr = formatDateOnly(end)

  const filtered = orders.filter(order => {
    if (!order.orderTime) return false

    const orderDate = new Date(order.orderTime)

    return orderDate >= start && orderDate <= end
  })

  updateMetrics(filtered)
  updateHeaderOrders(filtered)
}

/* ---------------------- */
/* Custom date inputs */
/* ---------------------- */
;[startDateInput, endDateInput].forEach(input => {
  input.addEventListener('change', () => {
    updateDashboard('custom')
  })
})

function clearAllPickers() {
  startDateInput.value = ''
  endDateInput.value = ''
  monthPickerInput.value = ''

  if (startDateInput._flatpickr) startDateInput._flatpickr.clear()
  if (endDateInput._flatpickr) endDateInput._flatpickr.clear()
  if (monthPickerInput._flatpickr) monthPickerInput._flatpickr.clear()

  yearSelect.selectedIndex = -1
}
function formatDisplayDate(date) {
  return new Date(date).toLocaleDateString('uk-UA')
}
function getDateRange(range) {
  const now = new Date()
  let start = new Date()
  let end = new Date()
  let title = ''

  switch (range) {
    case 'last_day':
      start = new Date()
      start.setHours(0, 0, 0, 0)

      end = new Date()
      end.setHours(23, 59, 59, 999)

      title = 'СЬОГОДНІ'
      break

    case 'last_7_days':
      start = new Date(now)
      start.setDate(now.getDate() - 7)

      end = now
      title = 'ОСТАННІ 7 ДНІВ'
      break

    case 'last_14_days':
      start = new Date(now)
      start.setDate(now.getDate() - 14)

      end = now
      title = 'ОСТАННІ 14 ДНІВ'
      break

    case 'last_week': {
      const day = now.getDay()

      const lastSunday = new Date(now)
      lastSunday.setDate(now.getDate() - day)

      const lastMonday = new Date(lastSunday)
      lastMonday.setDate(lastSunday.getDate() - 6)

      start = lastMonday
      end = lastSunday

      title = 'ПОПЕРЕДНІЙ ТИЖДЕНЬ'
      break
    }

    case 'custom': {
      const startVal = startDateInput.value
      const endVal = endDateInput.value

      start = parseDate(startVal)
      end = parseDate(endVal)

      title = `${formatDisplayDate(start)} — ${formatDisplayDate(end)}`
      break
    }
  }

  return { start, end, title }
}

/* ---------------------- */
/* INIT */
/* ---------------------- */
loadOrders()
