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

const EXCLUDED_STATUSES = [6, 7] // Скасовано, Повернення

/* ---------------------- */
/* Завантаження замовлень */
/* ---------------------- */
async function loadOrders() {
  try {
    const response = await fetch('https://dashboardsalesdriveapi.onrender.com/api/orders')
    orders = await response.json()

    if (orders.length > 0) {
      updateDashboard('last_day')
    }
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
/* Фільтр періодів */
/* ---------------------- */
function filterOrdersByRange(range) {
  const now = new Date()
  let start = new Date()
  let end = new Date()
  let title = ''

  switch (range) {
    case 'last_day':
      start.setHours(0, 0, 0, 0)
      title = 'ОСТАННЯ ДОБА'
      break

    case 'last_week':
      start.setDate(now.getDate() - now.getDay() - 6)
      end.setDate(now.getDate() - now.getDay())
      title = 'ПОПЕРЕДНІЙ ТИЖДЕНЬ'
      break

    case 'last_7_days':
      start.setDate(now.getDate() - 7)
      title = 'ОСТАННІ 7 ДНІВ'
      break

    case 'last_14_days':
      start.setDate(now.getDate() - 14)
      title = 'ОСТАННІ 14 ДНІВ'
      break

    case 'custom':
      const startVal = startDateInput.value
      const endVal = endDateInput.value

      if (!startVal && !endVal) return []

      if (startVal && !endVal) {
        start = parseDate(startVal)
        end = new Date(start)
        end.setHours(23, 59, 59)
        title = startVal
      } else if (!startVal && endVal) {
        end = parseDate(endVal)
        start = new Date(end)
        start.setHours(0, 0, 0, 0)
        title = endVal
      } else {
        start = parseDate(startVal)
        end = parseDate(endVal)
        end.setHours(23, 59, 59)
        title = `${startVal} — ${endVal}`
      }

      break
  }

  headerMonth.textContent = title

  return orders.filter(order => {
    const orderDate = new Date(order.orderTime)
    return orderDate >= start && orderDate <= end
  })
}

/* ---------------------- */
/* Оновлення дашборду */
/* ---------------------- */
function updateDashboard(range) {
  const filtered = filterOrdersByRange(range)

  updateMetrics(filtered)
  updateHeaderOrders(filtered)
}

function updateHeaderOrders(filteredOrders) {
  ordersCountHeader.textContent = filteredOrders.length.toLocaleString('uk-UA')
}

/* ---------------------- */
/* Метрики */
/* ---------------------- */
function updateMetrics(filtered) {
  // ❗ виключаємо статуси
  const validOrders = filtered.filter(order => !EXCLUDED_STATUSES.includes(order.statusId))

  const count = validOrders.length

  // оборот
  const turnover = validOrders.reduce((sum, order) => {
    return sum + (Number(order.paymentAmount) || 0)
  }, 0)

  // середній чек
  const avgCheck = count > 0 ? turnover / count : 0

  // прибуток
  const profit = validOrders.reduce((sum, order) => {
    return sum + (Number(order.profitAmount) || 0)
  }, 0)

  document.querySelector('.neon-yellow .metric-value').textContent = turnover.toLocaleString('uk-UA') + ' ₴'

  document.querySelector('.neon-yellow .metric-subtext').textContent = `${count} замовлень`

  document.querySelector('.neon-teal .metric-value').textContent =
    avgCheck.toLocaleString('uk-UA', { maximumFractionDigits: 0 }) + ' ₴'

  document.querySelector('.neon-cyan .metric-value').textContent = profit.toLocaleString('uk-UA') + ' ₴'
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

  if (value === 'custom') {
    customDateRange.style.display = 'block'
  }

  if (value === 'month') {
    monthPickerContainer.style.display = 'block'
    setTimeout(() => {
      monthPickerInput._flatpickr.open()
    }, 0)
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
    end.setHours(23, 59, 59)

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
  end.setHours(23, 59, 59)

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
  const filtered = orders.filter(order => {
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

/* ---------------------- */
/* Init */
/* ---------------------- */
loadOrders()
