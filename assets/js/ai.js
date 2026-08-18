(function (global) {
  'use strict';

  function getSettings() {
    return Store.loadSettings();
  }

  async function chat(userMessage, context) {
    const settings = getSettings();

    if (!settings.aiApiUrl || !settings.aiApiKey) {
      return {
        success: false,
        error: '请先在设置页面配置 AI API 地址和密钥',
        fallback: localAnalyze(userMessage, context)
      };
    }

    const systemPrompt = buildSystemPrompt(context);
    const body = {
      model: settings.aiModel || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 800
    };

    try {
      const res = await fetch(settings.aiApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + settings.aiApiKey
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: 'API返回错误 ' + res.status + ': ' + err.slice(0, 200) };
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || data.content || '未获取到回复';
      return { success: true, reply: reply };
    } catch (e) {
      return { success: false, error: '网络请求失败: ' + e.message };
    }
  }

  function buildSystemPrompt(context) {
    let prompt = '你是一个排班助手AI，帮助用户管理排班、计算工资、分析工作情况。';
    prompt += '用户使用中文交流。请简洁地回答问题。';

    if (context && context.shifts && context.shifts.length > 0) {
      const now = new Date();
      const monthPrefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const monthShifts = context.shifts.filter(s => s.date.startsWith(monthPrefix));
      let totalHours = 0;
      let totalSalary = 0;
      monthShifts.forEach(s => {
        const h = Utils.hoursBetween(s.start, s.end);
        totalHours += h;
        totalSalary += h * s.wage;
      });
      prompt += '\n\n当前用户本月排班数据：';
      prompt += '\n- 本月班次数: ' + monthShifts.length;
      prompt += '\n- 本月总工时: ' + totalHours.toFixed(1) + '小时';
      prompt += '\n- 本月预估工资: ¥' + totalSalary.toFixed(2);
      if (monthShifts.length > 0) {
        const brands = {};
        monthShifts.forEach(s => {
          const b = s.brand || '未填写';
          if (!brands[b]) brands[b] = { hours: 0, salary: 0 };
          const h = Utils.hoursBetween(s.start, s.end);
          brands[b].hours += h;
          brands[b].salary += h * s.wage;
        });
        prompt += '\n- 品牌分布: ' + Object.keys(brands).map(b => b + '(' + brands[b].hours.toFixed(0) + 'h)').join(', ');
      }
    }

    return prompt;
  }

  function localAnalyze(message, context) {
    const lower = message.toLowerCase();
    if (lower.includes('工资') || lower.includes('薪') || lower.includes('赚')) {
      if (context && context.shifts) {
        const now = new Date();
        const prefix = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const monthShifts = context.shifts.filter(s => s.date.startsWith(prefix));
        let totalHours = 0, totalSalary = 0;
        monthShifts.forEach(s => {
          const h = Utils.hoursBetween(s.start, s.end);
          totalHours += h;
          totalSalary += h * s.wage;
        });
        return '本月共排班' + monthShifts.length + '天，总工时' + totalHours.toFixed(1) + '小时，预估工资¥' + totalSalary.toFixed(2) + '。\n\n如需更详细的AI分析，请在设置页配置AI API。';
      }
    }
    if (lower.includes('建议') || lower.includes('优化') || lower.includes('推荐')) {
      return '基于您当前的排班数据，建议：\n1. 合理分配早班和晚班，避免连续晚班后接早班\n2. 关注工时是否超过法定上限\n3. 优先安排高时薪的品牌班次\n\n如需更智能的AI建议，请在设置页配置AI API。';
    }
    return '收到您的消息："' + message + '"\n\n如需使用AI对话功能，请在设置页面配置AI API地址和密钥。配置后将获得完整的智能排班建议、工时分析、冲突检测等功能。';
  }

  function parseScheduleText(text) {
    const result = { date: '', type: '', brand: '', start: '', end: '', wage: 0 };
    const t = text.replace(/，/g, ' ').replace(/\./g, ':');

    const typeMatch = t.match(/(早班|中班|晚班|加班|自定义)/);
    if (typeMatch) result.type = typeMatch[1];

    const now = new Date();
    const dateMatch = t.match(/(?:(明年|下个?月|这个?月)\s*)?(?:(\d{1,2})月)?(\d{1,2})(?:[号日])/);
    if (dateMatch) {
      let y = now.getFullYear();
      let m = now.getMonth() + 1;
      const relative = dateMatch[1] || '';
      const monthPart = dateMatch[2];
      const dayPart = parseInt(dateMatch[3], 10);
      if (relative.includes('明年')) y = now.getFullYear() + 1;
      if (relative.includes('下个月')) m = now.getMonth() + 2;
      else if (relative.includes('这个月')) m = now.getMonth() + 1;
      else if (monthPart) m = parseInt(monthPart, 10);
      if (m > 12) { m -= 12; y += 1; }
      result.date = y + '-' + String(m).padStart(2, '0') + '-' + String(dayPart).padStart(2, '0');
    }

    const brandPattern = /(?:\d{1,2}月)?\d{1,2}[号日]\s*([^早中晚加自\d\s：:,，]{2,}?)\s*(?:早班|中班|晚班|加班|自定义)/;
    const brandMatch = t.match(brandPattern);
    if (brandMatch) result.brand = brandMatch[1].trim();

    const timeRegex = /(早上|上午|中午|下午|晚上|凌晨)?\s*(\d{1,2})[:点](\d{1,2}|半)?/g;
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
      times.push(String(h).padStart(2, '0') + ':' + String(minNum).padStart(2, '0'));
    }
    if (times.length >= 1) result.start = times[0];
    if (times.length >= 2) result.end = times[1];

    const wageMatch = t.match(/时薪?[\s为是]?+(\d+)/) || t.match(/(\d+)(?:块|元)(?:一?小时|每小时|时薪)/) || t.match(/(\d+)\s*(?:块|元)\s*$/);
    if (wageMatch) result.wage = parseFloat(wageMatch[1]);

    return result;
  }

  function detectConflicts(shifts) {
    const conflicts = [];
    const byDate = {};
    shifts.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });
    Object.keys(byDate).forEach(date => {
      const dayShifts = byDate[date].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 0; i < dayShifts.length - 1; i++) {
        if (dayShifts[i].end > dayShifts[i + 1].start) {
          conflicts.push({
            date: date,
            shift1: dayShifts[i],
            shift2: dayShifts[i + 1],
            message: date + ' 班次冲突: ' + dayShifts[i].brand + '(' + dayShifts[i].start + '-' + dayShifts[i].end + ') 与 ' + dayShifts[i + 1].brand + '(' + dayShifts[i + 1].start + '-' + dayShifts[i + 1].end + ')'
          });
        }
      }
    });
    return conflicts;
  }

  global.AI = {
    chat: chat,
    localAnalyze: localAnalyze,
    parseScheduleText: parseScheduleText,
    detectConflicts: detectConflicts
  };
})(window);
