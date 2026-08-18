import re

file_path = '/Users/a616161663/Library/Application Support/TRAE SOLO CN/ModularData/ai-agent/work-mode-projects/6a83058a8916ee23cff28a28/pink-schedule/pages/week.html'
with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

new_script = '''    <script>
      (function () {
        const weekGrid = document.getElementById('week-grid');
        const weekLabel = document.getElementById('week-label');
        const weekJump = document.getElementById('week-jump');
        const totalHoursEl = document.getElementById('total-hours');
        const totalSalaryEl = document.getElementById('total-salary');
        const shiftList = document.getElementById('shift-list');
        const shiftForm = document.getElementById('shift-form');
        const templateList = document.getElementById('template-list');
        const saveTemplateBtn = document.getElementById('save-template-btn');
        const voiceBtn = document.getElementById('voice-btn');
        const voiceStatus = document.getElementById('voice-status');

        const STORAGE_KEY = 'pink-schedule-shifts';
        const TEMPLATE_KEY = 'pink-schedule-templates';

        const DEFAULT_SHIFTS = [
          { id: 1, date: '2026-08-05', type: '早班', brand: 'A品牌', start: '08:00', end: '16:00', wage: 30 },
          { id: 2, date: '2026-08-12', type: '中班', brand: 'B品牌', start: '12:00', end: '20:00', wage: 32 },
          { id: 3, date: '2026-08-19', type: '晚班', brand: 'A品牌', start: '14:00', end: '22:00', wage: 35 },
          { id: 4, date: '2026-08-26', type: '加班', brand: 'C品牌', start: '09:00', end: '18:00', wage: 40 }
        ];

        function loadShifts() {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
              const parsed = JSON.parse(raw);
              return parsed.map(s => ({ brand: '', ...s }));
            }
          } catch (e) {}
          return DEFAULT_SHIFTS.map(s => ({ ...s }));
        }

        function saveShifts() {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
          } catch (e) {}
        }

        function loadTemplates() {
          try {
            const raw = localStorage.getItem(TEMPLATE_KEY);
            if (raw) return JSON.parse(raw);
          } catch (e) {}
          return [];
        }

        function saveTemplates(list) {
          try {
            localStorage.setItem(TEMPLATE_KEY, JSON.stringify(list));
          } catch (e) {}
        }

        let shifts = loadShifts();
        let templates = loadTemplates();

        function getWeekStart(date) {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          const day = d.getDay();
          d.setDate(d.getDate() - day);
          return d;
        }

        const today = new Date();
        let currentWeekStart = getWeekStart(today);
        let currentYear = today.getFullYear();
        let currentMonth = today.getMonth();

        function parseMinutes(timeStr) {
          const [h, m] = timeStr.split(':').map(Number);
          return h * 60 + m;
        }

        function hoursBetween(start, end) {
          let diff = parseMinutes(end) - parseMinutes(start);
          if (diff <= 0) diff += 24 * 60;
          return diff / 60;
        }

        function formatMoney(n) {
          return '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }

        function toISODate(date) {
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          return y + '-' + m + '-' + d;
        }

        function toISODateYMD(y, m, d) {
          return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        }

        function formatMonthDay(date) {
          return (date.getMonth() + 1) + '月' + date.getDate() + '日';
        }

        function updateBrandSuggestions() {
          const datalist = document.getElementById('brand-suggestions');
          if (!datalist) return;
          const brands = Array.from(new Set(shifts.map(s => s.brand).filter(Boolean))).sort();
          datalist.innerHTML = brands.map(b => '<option value="' + b + '"></option>').join('');
        }

        function renderBrandSummary(containerId, filterFn, periodLabel) {
          const tbody = document.querySelector('#' + containerId + ' tbody');
          if (!tbody) return;
          const groups = {};
          let totalHours = 0;
          shifts.filter(filterFn).forEach(s => {
            const h = hoursBetween(s.start, s.end);
            const brand = s.brand || '未填写';
            if (!groups[brand]) groups[brand] = { hours: 0, salary: 0 };
            groups[brand].hours += h;
            groups[brand].salary += h * s.wage;
            totalHours += h;
          });
          tbody.innerHTML = '';
          Object.keys(groups).sort().forEach(brand => {
            const row = document.createElement('tr');
            row.className = 'border-b border-border last:border-0';
            row.innerHTML = '<td class="py-1.5 text-foreground">' + brand + '</td><td class="py-1.5 text-right text-foreground">' + groups[brand].hours.toFixed(1) + 'h</td><td class="py-1.5 text-right font-medium text-primary">' + formatMoney(groups[brand].salary) + '</td>';
            tbody.appendChild(row);
          });
          if (totalHours === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="py-2 text-sm text-muted-foreground">' + periodLabel + '暂无记录</td></tr>';
          }
        }

        function exportCSV(filename, rows) {
          const csv = ['\\uFEFF品牌,日期,班次,开始,结束,工时,时薪,工资'].concat(rows.map(r => {
            const h = hoursBetween(r.start, r.end);
            return [r.brand || '未填写', r.date, r.type, r.start, r.end, h.toFixed(2), r.wage, (h * r.wage).toFixed(2)].join(',');
          })).join('\\n');
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

        function updateWeekJump() {
          weekJump.value = toISODate(currentWeekStart);
        }

        function renderWeek(weekStart) {
          weekGrid.innerHTML = '';
          const endDate = new Date(weekStart);
          endDate.setDate(weekStart.getDate() + 6);
          weekLabel.textContent = weekStart.getFullYear() + '年' + formatMonthDay(weekStart) + ' - ' + formatMonthDay(endDate);

          for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dateStr = toISODate(day);
            const dayShifts = shifts.filter(s => s.date === dateStr);
            const cell = document.createElement('div');
            cell.className = 'min-h-28 rounded-lg border border-border bg-background p-2 flex flex-col gap-1 hover:shadow-sm transition-shadow';
            const num = document.createElement('span');
            num.className = 'text-sm font-medium text-foreground';
            num.textContent = day.getDate();
            cell.appendChild(num);
            dayShifts.forEach(s => {
              const chip = document.createElement('span');
              chip.className = 'text-[10px] leading-tight px-1.5 py-0.5 rounded bg-primary/10 text-primary truncate';
              chip.textContent = s.brand || s.type;
              chip.title = (s.brand ? s.brand + ' ' : '') + s.type + ' ' + s.start + '-' + s.end;
              cell.appendChild(chip);
            });
            weekGrid.appendChild(cell);
          }
          updateWeekJump();
        }

        function deleteShift(id) {
          if (!confirm('确定要删除这条排班吗？')) return;
          shifts = shifts.filter(s => s.id !== id);
          saveShifts();
          renderWeek(currentWeekStart);
          renderSummary();
          renderTemplates();
        }

        function renderSummary() {
          const weekEnd = new Date(currentWeekStart);
          weekEnd.setDate(currentWeekStart.getDate() + 6);
          const startStr = toISODate(currentWeekStart);
          const endStr = toISODate(weekEnd);

          let totalHours = 0;
          let totalSalary = 0;
          shifts.forEach(s => {
            if (s.date < startStr || s.date > endStr) return;
            const h = hoursBetween(s.start, s.end);
            totalHours += h;
            totalSalary += h * s.wage;
          });
          totalHoursEl.textContent = totalHours.toFixed(1);
          totalSalaryEl.textContent = formatMoney(totalSalary);

          shiftList.innerHTML = '';
          const weekShifts = shifts.filter(s => s.date >= startStr && s.date <= endStr).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
          if (weekShifts.length === 0) {
            shiftList.innerHTML = '<li class="text-sm text-muted-foreground">本周暂无班次，添加一条开始计算吧</li>';
          } else {
            weekShifts.forEach(s => {
              const h = hoursBetween(s.start, s.end);
              const li = document.createElement('li');
              li.className = 'flex items-center justify-between text-sm p-2 rounded-lg bg-muted';
              const brandTag = s.brand ? '<span class="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-1.5">' + s.brand + '</span>' : '';
              li.innerHTML = '<span class="text-foreground flex items-center">' + brandTag + s.date.slice(5) + ' ' + s.type + ' ' + s.start + '-' + s.end + '</span><span class="flex items-center gap-2"><span class="font-medium text-primary">' + formatMoney(h * s.wage) + '</span><button type="button" data-delete-id="' + s.id + '" class="p-1 rounded hover:bg-border text-muted-foreground" aria-label="删除"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button></span>';
              shiftList.appendChild(li);
            });
            shiftList.addEventListener('click', function (e) {
              const btn = e.target.closest('[data-delete-id]');
              if (!btn) return;
              deleteShift(parseInt(btn.getAttribute('data-delete-id'), 10));
            }, { once: false });
          }
          renderBrandSummary('brand-summary', s => s.date >= startStr && s.date <= endStr, '本周');
          updateBrandSuggestions();
        }

        function applyTemplate(idx) {
          const t = templates[idx];
          if (!t) return;
          shiftForm.querySelector('[name="type"]').value = t.type;
          shiftForm.querySelector('[name="brand"]').value = t.brand;
          shiftForm.querySelector('[name="start"]').value = t.start;
          shiftForm.querySelector('[name="end"]').value = t.end;
          shiftForm.querySelector('[name="wage"]').value = t.wage;
          shiftForm.querySelector('[name="date"]').focus();
        }

        function renderTemplates() {
          templateList.innerHTML = '';
          if (templates.length === 0) {
            templateList.innerHTML = '<p class="text-sm text-muted-foreground">还没有模板</p>';
            return;
          }
          templates.forEach((t, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between text-sm p-2 rounded-lg bg-muted';
            div.innerHTML = '<span class="text-foreground truncate">' + (t.brand || '未填写') + ' · ' + t.type + ' · ' + t.start + '-' + t.end + ' · ¥' + t.wage + '</span><span class="flex items-center gap-1"><button type="button" data-apply-idx="' + idx + '" class="px-2 py-1 rounded bg-primary text-primary-foreground text-xs">使用</button><button type="button" data-del-template-idx="' + idx + '" class="px-2 py-1 rounded bg-border text-foreground text-xs">删除</button></span>';
            templateList.appendChild(div);
          });
          templateList.addEventListener('click', function (e) {
            const applyBtn = e.target.closest('[data-apply-idx]');
            const delBtn = e.target.closest('[data-del-template-idx]');
            if (applyBtn) applyTemplate(parseInt(applyBtn.getAttribute('data-apply-idx'), 10));
            if (delBtn) {
              const idx = parseInt(delBtn.getAttribute('data-del-template-idx'), 10);
              templates.splice(idx, 1);
              saveTemplates(templates);
              renderTemplates();
            }
          }, { once: false });
        }

        saveTemplateBtn.addEventListener('click', function () {
          const formData = new FormData(shiftForm);
          templates.push({
            id: Date.now(),
            type: formData.get('type'),
            brand: (formData.get('brand') || '').trim(),
            start: formData.get('start'),
            end: formData.get('end'),
            wage: parseFloat(formData.get('wage')) || 0
          });
          saveTemplates(templates);
          renderTemplates();
          alert('已保存为模板');
        });

        function parseVoiceText(text) {
          const result = { date: '', type: '', brand: '', start: '', end: '', wage: 0 };
          const t = text.replace(/，/g, ' ').replace(/\\./g, ':');

          const typeMatch = t.match(/(早班|中班|晚班|加班|自定义)/);
          if (typeMatch) result.type = typeMatch[1];

          const dateMatch = t.match(/(?:(明年|下个?月|这个?月)\\s*)?(?:(\\d{1,2})月)?(\\d{1,2})(?:[号日])/);
          if (dateMatch) {
            let y = currentYear;
            let m = currentMonth + 1;
            const relative = dateMatch[1] || '';
            const monthPart = dateMatch[2];
            const dayPart = parseInt(dateMatch[3], 10);
            if (relative.includes('明年')) y = currentYear + 1;
            if (relative.includes('下个月')) m = currentMonth + 2;
            else if (relative.includes('这个月')) m = currentMonth + 1;
            else if (monthPart) m = parseInt(monthPart, 10);
            if (m > 12) { m -= 12; y += 1; }
            result.date = toISODateYMD(y, m, dayPart);
          }

          const brandPattern = /(?:\\d{1,2}月)?\\d{1,2}[号日]\\s*([^早中晚加自\\d\\s]{2,}?)\\s*(?:早班|中班|晚班|加班|自定义)/;
          const brandMatch = t.match(brandPattern);
          if (brandMatch) result.brand = brandMatch[1].trim();

          const timeRegex = /(早上|上午|中午|下午|晚上|凌晨)?\\s*(\\d{1,2})[:点](\\d{1,2}|半)?/g;
          const times = [];
          let mch;
          while ((mch = timeRegex.exec(t)) !== null) {
            let mer = mch[1] || '';
            let h = parseInt(mch[2], 10);
            let min = mch[3];
            let minNum = 0;
            if (min === '半') minNum = 30;
            else if (min) minNum = parseInt(min, 10);
            if ((mer === '下午' || mer === '晚上') && h < 12) h += 12;
            if (mer === '中午' && h < 12) h += 12;
            if (mer === '凌晨' && h >= 12) h -= 12;
            times.push(String(h).padStart(2, '0') + ':' + String(minNum).padStart(2, '0'));
          }
          if (times.length >= 1) result.start = times[0];
          if (times.length >= 2) result.end = times[1];

          const wageMatch = t.match(/时薪?[\\s为是]?+(\\d+)/) || t.match(/(\\d+)(?:块|元)(?:一?小时|每小时|时薪)/) || t.match(/(\\d+)\\s*(?:块|元)\\s*$/);
          if (wageMatch) result.wage = parseFloat(wageMatch[1]);

          return result;
        }

        function startVoice() {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SpeechRecognition) {
            alert('你的浏览器不支持语音识别，请手动输入');
            return;
          }
          const rec = new SpeechRecognition();
          rec.lang = 'zh-CN';
          rec.interimResults = false;
          rec.maxAlternatives = 1;
          voiceStatus.classList.remove('hidden');
          voiceStatus.textContent = '正在聆听，请说话...';
          voiceBtn.classList.add('bg-primary/20');
          rec.start();
          rec.onresult = function (event) {
            const text = event.results[0][0].transcript;
            voiceStatus.textContent = '识别结果：' + text;
            const parsed = parseVoiceText(text);
            if (parsed.date) shiftForm.querySelector('[name="date"]').value = parsed.date;
            if (parsed.type) shiftForm.querySelector('[name="type"]').value = parsed.type;
            if (parsed.brand) shiftForm.querySelector('[name="brand"]').value = parsed.brand;
            if (parsed.start) shiftForm.querySelector('[name="start"]').value = parsed.start;
            if (parsed.end) shiftForm.querySelector('[name="end"]').value = parsed.end;
            if (parsed.wage) shiftForm.querySelector('[name="wage"]').value = parsed.wage;
            voiceBtn.classList.remove('bg-primary/20');
          };
          rec.onerror = function (event) {
            voiceStatus.textContent = '识别失败：' + event.error;
            voiceBtn.classList.remove('bg-primary/20');
          };
          rec.onend = function () {
            voiceBtn.classList.remove('bg-primary/20');
          };
        }

        voiceBtn.addEventListener('click', startVoice);

        shiftForm.addEventListener('submit', function (e) {
          e.preventDefault();
          const formData = new FormData(shiftForm);
          const date = formData.get('date');
          const start = formData.get('start');
          const end = formData.get('end');
          if (!date) { alert('请选择日期'); return; }
          if (hoursBetween(start, end) <= 0) {
            alert('结束时间必须晚于开始时间');
            return;
          }
          shifts.push({
            id: Date.now(),
            date,
            type: formData.get('type'),
            brand: (formData.get('brand') || '').trim(),
            start,
            end,
            wage: parseFloat(formData.get('wage')) || 0
          });
          saveShifts();
          renderWeek(currentWeekStart);
          renderSummary();
          shiftForm.reset();
          shiftForm.querySelector('[name="start"]').value = '09:00';
          shiftForm.querySelector('[name="end"]').value = '18:00';
          shiftForm.querySelector('[name="wage"]').value = '25';
          updateBrandSuggestions();
          if (window.lucide) lucide.createIcons();
        });

        document.getElementById('prev-week').addEventListener('click', function () {
          currentWeekStart.setDate(currentWeekStart.getDate() - 7);
          currentYear = currentWeekStart.getFullYear();
          currentMonth = currentWeekStart.getMonth();
          renderWeek(currentWeekStart);
          renderSummary();
        });
        document.getElementById('next-week').addEventListener('click', function () {
          currentWeekStart.setDate(currentWeekStart.getDate() + 7);
          currentYear = currentWeekStart.getFullYear();
          currentMonth = currentWeekStart.getMonth();
          renderWeek(currentWeekStart);
          renderSummary();
        });
        weekJump.addEventListener('change', function () {
          if (!weekJump.value) return;
          const d = new Date(weekJump.value);
          currentWeekStart = getWeekStart(d);
          currentYear = currentWeekStart.getFullYear();
          currentMonth = currentWeekStart.getMonth();
          renderWeek(currentWeekStart);
          renderSummary();
        });
        document.getElementById('export-week').addEventListener('click', function () {
          const weekEnd = new Date(currentWeekStart);
          weekEnd.setDate(currentWeekStart.getDate() + 6);
          const startStr = toISODate(currentWeekStart);
          const endStr = toISODate(weekEnd);
          const rows = shifts.filter(s => s.date >= startStr && s.date <= endStr).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
          exportCSV('周排班汇总_' + startStr + '_至_' + endStr + '.csv', rows);
        });

        updateWeekJump();
        renderWeek(currentWeekStart);
        renderSummary();
        renderTemplates();
      })();
    </script>
    <script>lucide.createIcons();</script>'''

pattern = re.compile(r'<script>\s*\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);\s*</script>\s*<script>lucide\.createIcons\(\);</script>')
if not pattern.search(html):
    print('Could not find main script block')
    raise SystemExit(1)

html = pattern.sub(lambda m: new_script, html)
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('week.html script replaced')
