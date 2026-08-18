(function (global) {
  'use strict';

  function parseMinutes(timeStr) {
    const parts = String(timeStr).split(':');
    return parseInt(parts[0] || 0, 10) * 60 + parseInt(parts[1] || 0, 10);
  }

  function hoursBetween(start, end) {
    let diff = parseMinutes(end) - parseMinutes(start);
    if (diff <= 0) diff += 24 * 60;
    return diff / 60;
  }

  function formatMoney(n) {
    return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function toISODate(y, m, d) {
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function formatDateCN(iso) {
    const parts = iso.split('-');
    return parseInt(parts[1], 10) + '月' + parseInt(parts[2], 10) + '日';
  }

  function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(d);
    sunday.setDate(monday.getDate() + 6);
    return { start: toISODate(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()), end: toISODate(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()) };
  }

  function exportCSV(filename, rows) {
    const csv = ['\uFEFF品牌,日期,班次,开始,结束,工时,时薪,工资'].concat(rows.map(r => {
      const h = hoursBetween(r.start, r.end);
      return [r.brand || '未填写', r.date, r.type, r.start, r.end, h.toFixed(2), r.wage, (h * r.wage).toFixed(2)].join(',');
    })).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function showToast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function toggleTheme() {
    const html = document.documentElement;
    const current = html.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    html.classList.remove(current);
    html.classList.add(next);
    const settings = Store.loadSettings();
    settings.theme = next;
    Store.saveSettings(settings);
  }

  function initTheme() {
    const settings = Store.loadSettings();
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  }

  function debounce(fn, wait) {
    let timer;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, arguments), wait || 300);
    };
  }

  function groupBy(arr, fn) {
    const groups = {};
    arr.forEach(item => {
      const key = fn(item);
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }

  function sum(arr, fn) {
    return arr.reduce((total, item) => total + (fn ? fn(item) : item), 0);
  }

  function getMonthStats(shifts, year, month) {
    const prefix = year + '-' + String(month).padStart(2, '0');
    const monthShifts = shifts.filter(s => s.date.startsWith(prefix));
    let totalHours = 0;
    let totalSalary = 0;
    const brandStats = {};
    const typeStats = {};
    monthShifts.forEach(s => {
      const h = hoursBetween(s.start, s.end);
      const salary = h * s.wage;
      totalHours += h;
      totalSalary += salary;
      const brand = s.brand || '未填写';
      if (!brandStats[brand]) brandStats[brand] = { hours: 0, salary: 0, count: 0 };
      brandStats[brand].hours += h;
      brandStats[brand].salary += salary;
      brandStats[brand].count++;
      if (!typeStats[s.type]) typeStats[s.type] = { hours: 0, salary: 0, count: 0 };
      typeStats[s.type].hours += h;
      typeStats[s.type].salary += salary;
      typeStats[s.type].count++;
    });
    return {
      shifts: monthShifts,
      totalHours: totalHours,
      totalSalary: totalSalary,
      count: monthShifts.length,
      brandStats: brandStats,
      typeStats: typeStats,
      avgWage: monthShifts.length > 0 ? totalSalary / totalHours : 0
    };
  }

  global.Utils = {
    parseMinutes: parseMinutes,
    hoursBetween: hoursBetween,
    formatMoney: formatMoney,
    toISODate: toISODate,
    formatDateCN: formatDateCN,
    getWeekRange: getWeekRange,
    exportCSV: exportCSV,
    showToast: showToast,
    toggleTheme: toggleTheme,
    initTheme: initTheme,
    debounce: debounce,
    groupBy: groupBy,
    sum: sum,
    getMonthStats: getMonthStats
  };
})(window);
