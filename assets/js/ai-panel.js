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
          <input id="ai-input" type="text" placeholder="输入消息，如"下周三八点欧莱雅早班"..." class="input-field flex-1" style="height: 36px">
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

    addBotMessage('你好！我是你的AI排班助手。你可以问我关于工资、排班的问题，或者直接用自然语言添加班次，比如"5号早班欧莱雅9点到6点时薪30"。');
    if (window.lucide) lucide.createIcons();
  }

  function toggle() {
    const panel = document.getElementById('ai-panel');
    if (!panel) { createPanel(); }
    document.getElementById('ai-panel').classList.toggle('open');
  }

  function addUserMessage(text) {
    const messages = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = 'ai-message-user fade-in';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addBotMessage(text) {
    const messages = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = 'ai-message-bot fade-in whitespace-pre-wrap';
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addLoading() {
    const messages = document.getElementById('ai-messages');
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

  async function send() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    addUserMessage(text);

    const parsed = AI.parseScheduleText(text);
    if (parsed.date && parsed.start) {
      addBotMessage('识别到班次信息：\n日期: ' + Utils.formatDateCN(parsed.date) + '\n班次: ' + (parsed.type || '未指定') + '\n品牌: ' + (parsed.brand || '未填写') + '\n时间: ' + parsed.start + ' - ' + (parsed.end || '未填写') + '\n时薪: ¥' + (parsed.wage || '未指定') + '\n\n点击下方"添加"按钮将此班次添加到日历，或在表单中手动确认。');

      const messages = document.getElementById('ai-messages');
      const addBtn = document.createElement('button');
      addBtn.className = 'btn-primary px-3 py-1.5 rounded-md text-xs mt-2';
      addBtn.textContent = '添加班次';
      addBtn.addEventListener('click', () => {
        const shifts = Store.loadShifts();
        shifts.push({
          id: Date.now(),
          date: parsed.date,
          type: parsed.type || '自定义',
          brand: parsed.brand || '',
          start: parsed.start,
          end: parsed.end || '18:00',
          wage: parsed.wage || 25
        });
        Store.saveShifts(shifts);
        Utils.showToast('班次已添加');
        if (typeof refreshApp === 'function') refreshApp();
      });
      messages.appendChild(addBtn);
      messages.scrollTop = messages.scrollHeight;
      return;
    }

    addLoading();
    const shifts = Store.loadShifts();
    const result = await AI.chat(text, { shifts: shifts });
    removeLoading();

    if (result.success) {
      addBotMessage(result.reply);
    } else if (result.fallback) {
      addBotMessage(result.fallback);
    } else {
      addBotMessage('出错了: ' + result.error);
    }
  }

  global.AIPanel = {
    create: createPanel,
    toggle: toggle
  };
})(window);
