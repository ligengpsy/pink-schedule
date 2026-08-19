(function (global) {
  'use strict';

  function createPanel() {
    if (document.getElementById('ai-panel')) return;
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.className = 'ai-panel';
    panel.innerHTML = `
      <div class="flex items-center justify-between p-4 border-b" style="border-color: var(--sakura-border)">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background: var(--sakura-primary); color: var(--sakura-primary-foreground)">
            <i data-lucide="sparkles" class="w-4 h-4"></i>
          </div>
          <div>
            <p class="text-sm font-semibold" style="color: var(--sakura-foreground)">AI 排班助手</p>
            <p class="text-xs" style="color: var(--sakura-muted-foreground)">智能分析 · 自然语言添加</p>
          </div>
        </div>
        <button id="ai-panel-close" class="btn-ghost p-2 rounded-md">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
      <div id="ai-messages" class="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar"></div>
      <div class="p-4 border-t" style="border-color: var(--sakura-border)">
        <div class="flex gap-2 mb-2 flex-wrap">
          <button class="ai-quick-btn text-xs px-2 py-1 rounded-full" style="background: var(--sakura-muted); color: var(--sakura-muted-foreground)" data-prompt="本月工资分析">本月工资</button>
          <button class="ai-quick-btn text-xs px-2 py-1 rounded-full" style="background: var(--sakura-muted); color: var(--sakura-muted-foreground)" data-prompt="排班优化建议">优化建议</button>
          <button class="ai-quick-btn text-xs px-2 py-1 rounded-full" style="background: var(--sakura-muted); color: var(--sakura-muted-foreground)" data-prompt="检查时间冲突">冲突检测</button>
        </div>
        <div class="flex gap-2">
          <input id="ai-input" type="text" placeholder='如 "今天6-10点 珀莱雅 时薪200"' class="input-field flex-1" style="height: 36px">
          <button id="ai-send" class="btn-primary px-3 rounded-md" style="height: 36px">
            <i data-lucide="send" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    document.getElementById('ai-panel-close').addEventListener('click', () => toggle());
    document.getElementById('ai-send').addEventListener('click', send);
    document.getElementById('ai-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') send();
    });
    document.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('ai-input').value = btn.dataset.prompt;
        send();
      });
    });

    addBotMessage('你好！我是你的AI排班助手，有什么可以帮你？\n\n你可以：\n- 用自然语言添加班次（如"今天6-10点 珀莱雅 时薪200"）\n- 查询工资（如"本月工资多少"）\n- 获取排班建议（如"帮我优化下排班"）');
    if (window.lucide) lucide.createIcons();
  }

  function toggle() {
    const panel = document.getElementById('ai-panel');
    if (!panel) { createPanel(); }
    document.getElementById('ai-panel').classList.toggle('open');
  }

  function addUserMessage(text) {
    const messages = document.getElementById('ai-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = 'ai-message-user fade-in';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addBotMessage(text) {
    const messages = document.getElementById('ai-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.className = 'ai-message-bot fade-in whitespace-pre-wrap';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addLoading() {
    const messages = document.getElementById('ai-messages');
    if (!messages) return;
    const div = document.createElement('div');
    div.id = 'ai-loading';
    div.className = 'ai-message-bot loading-dots';
    div.textContent = '思考中';
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function removeLoading() {
    const el = document.getElementById('ai-loading');
    if (el) el.remove();
  }

  function showAddShiftButton(shiftData, userMessage) {
    const messages = document.getElementById('ai-messages');
    if (!messages || !shiftData) return;

    // Date correction: if user said 今天/明天/后天, override AI's date
    if (userMessage) {
      var now = new Date();
      if (/今天|今日/.test(userMessage)) {
        shiftData.date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      } else if (/明天|明日/.test(userMessage)) {
        var d = new Date(now.getTime() + 86400000);
        shiftData.date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      } else if (/后天/.test(userMessage)) {
        var d = new Date(now.getTime() + 86400000 * 2);
        shiftData.date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
    }

    const hours = Utils.hoursBetween(shiftData.start, shiftData.end || '18:00');
    const earn = hours * (shiftData.wage || 0);

    const info = document.createElement('div');
    info.className = 'ai-message-bot fade-in';
    info.style.background = 'rgba(244,111,174,.08)';
    info.style.border = '1px solid rgba(244,111,174,.2)';
    info.innerHTML =
      '<div style="font-size:12px; color:var(--sakura-muted-foreground); margin-bottom:4px">识别到班次</div>' +
      '<div style="font-weight:600; margin-bottom:6px; color:var(--sakura-foreground)">' +
        Utils.formatDateCN(shiftData.date) + ' · ' + (shiftData.brand || '未填写') +
      '</div>' +
      '<div style="font-size:13px; color:var(--sakura-ink-2); margin-bottom:2px">' +
        (shiftData.type || '自定义') + ' · ' + shiftData.start + ' - ' + (shiftData.end || '未填写') +
      '</div>' +
      '<div style="font-size:13px; color:var(--sakura-primary); font-weight:600">' +
        '时薪¥' + (shiftData.wage || 0) + ' · ' + hours.toFixed(1) + 'h · 预计¥' + earn.toFixed(0) +
      '</div>';
    messages.appendChild(info);

    const addBtn = document.createElement('button');
    addBtn.className = 'btn-primary px-3 py-1.5 rounded-md text-xs mt-2';
    addBtn.textContent = '添加到日历';
    addBtn.addEventListener('click', () => {
      try {
        const shifts = Store.loadShifts();
        shifts.push({
          id: Date.now(),
          date: shiftData.date,
          type: shiftData.type || '自定义',
          brand: shiftData.brand || '',
          start: shiftData.start,
          end: shiftData.end || '18:00',
          wage: shiftData.wage || 25
        });
        Store.saveShifts(shifts);
        Utils.showToast('班次已添加');
        if (typeof refreshApp === 'function') refreshApp();
        addBtn.textContent = '已添加 ✓';
        addBtn.disabled = true;
        addBtn.style.opacity = '0.6';
      } catch (e) {
        Utils.showToast('添加失败: ' + e.message);
      }
    });
    messages.appendChild(addBtn);
    messages.scrollTop = messages.scrollHeight;
  }

  async function send() {
    const input = document.getElementById('ai-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addUserMessage(text);

    try {
      addLoading();
      const shifts = Store.loadShifts();
      const result = await AI.chat(text, { shifts: shifts });
      removeLoading();

      if (result.success) {
        addBotMessage(result.reply);
        if (result.shift) {
          showAddShiftButton(result.shift, text);
        }
      } else if (result.fallback) {
        addBotMessage(result.fallback);
        const parsed = AI.parseScheduleText(text);
        if (parsed.date && parsed.start) {
          showAddShiftButton(parsed, text);
        }
      } else {
        addBotMessage('出错了: ' + (result.error || '未知错误'));
      }
    } catch (e) {
      removeLoading();
      addBotMessage('发送失败: ' + (e.message || '未知错误'));
    }
  }

  global.AIPanel = {
    create: createPanel,
    toggle: toggle
  };
})(window);
