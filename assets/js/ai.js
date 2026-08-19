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
    const now = new Date();

    // 1. Parse shift type
    const typeMatch = t.match(/(早班|中班|晚班|加班|自定义)/);
    if (typeMatch) {
      result.type = typeMatch[1];
    } else if (/早上|上午|清晨|凌晨/.test(t)) {
      result.type = '早班';
    } else if (/下午/.test(t)) {
      result.type = '中班';
    } else if (/晚上|晚间|夜间/.test(t)) {
      result.type = '晚班';
    }

    // 2. Parse date - support 今天/明天/后天 and X号/X日
    if (/今天|今日/.test(t)) {
      result.date = Utils.toISODate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    } else if (/明天|明日/.test(t)) {
      const d = new Date(now.getTime() + 86400000);
      result.date = Utils.toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    } else if (/后天/.test(t)) {
      const d = new Date(now.getTime() + 86400000 * 2);
      result.date = Utils.toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    } else if (/大后天/.test(t)) {
      const d = new Date(now.getTime() + 86400000 * 3);
      result.date = Utils.toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
    } else {
      const dateMatch = t.match(/(?:(明年|下个?月|这个?月)\s*)?(?:(\d{1,2})月)?(\d{1,2})(?:[号日])/);
      if (dateMatch) {
        let y = now.getFullYear();
        let m = now.getMonth() + 1;
        const relative = dateMatch[1] || '';
        const monthPart = dateMatch[2];
        const dayPart = parseInt(dateMatch[3], 10);
        if (relative.includes('明年')) y = now.getFullYear() + 1;
        if (relative.includes('下')) m = now.getMonth() + 2;
        else if (relative.includes('这')) m = now.getMonth() + 1;
        else if (monthPart) m = parseInt(monthPart, 10);
        if (m > 12) { m -= 12; y += 1; }
        result.date = y + '-' + String(m).padStart(2, '0') + '-' + String(dayPart).padStart(2, '0');
      }
    }

    // 3. Parse time - support "6-10点", "6点-10点", "6:00-10:00", "6点到10点"
    const times = [];

    // Try range format first: X-Y点, X点-Y点, X到Y点, X至Y
    const rangeMatch = t.match(/(\d{1,2})(?:\s*[:点](\d{1,2}|半)?)?\s*[-到至]\s*(\d{1,2})(?:\s*[:点](\d{1,2}|半)?)?/);
    if (rangeMatch) {
      const beforeText = t.substring(0, t.indexOf(rangeMatch[0]));
      let h1 = parseInt(rangeMatch[1], 10);
      let h2 = parseInt(rangeMatch[3], 10);
      let min1 = 0, min2 = 0;
      if (rangeMatch[2] === '半') min1 = 30;
      else if (rangeMatch[2]) min1 = parseInt(rangeMatch[2], 10);
      if (rangeMatch[4] === '半') min2 = 30;
      else if (rangeMatch[4]) min2 = parseInt(rangeMatch[4], 10);

      // Adjust for afternoon/evening
      if (/下午|晚上|晚间/.test(beforeText)) {
        if (h1 < 12) h1 += 12;
        if (h2 < 12) h2 += 12;
      }
      times.push(String(h1).padStart(2, '0') + ':' + String(min1).padStart(2, '0'));
      times.push(String(h2).padStart(2, '0') + ':' + String(min2).padStart(2, '0'));
    }

    // If no range found, try individual times
    if (!times.length) {
      const timeRegex = /(早上|上午|中午|下午|晚上|凌晨)?\s*(\d{1,2})[:点](\d{1,2}|半)?/g;
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
    }

    if (times.length >= 1) result.start = times[0];
    if (times.length >= 2) result.end = times[1];

    // 4. Parse brand - remove known info, what remains is likely the brand
    let remaining = t;
    remaining = remaining.replace(/今天|今日|明天|明日|后天|大后天|下周|这周|本周|下个?月|这个?月|明年/g, ' ');
    remaining = remaining.replace(/早上|上午|中午|下午|晚上|凌晨|清晨|夜间|晚间/g, ' ');
    remaining = remaining.replace(/早班|中班|晚班|加班|自定义/g, ' ');
    remaining = remaining.replace(/(\d{1,2})\s*[-到至]\s*(\d{1,2})/g, ' ');
    remaining = remaining.replace(/\d{1,2}[:点](\d{1,2}|半)?/g, ' ');
    remaining = remaining.replace(/时薪?[\s为是]?\d+/g, ' ');
    remaining = remaining.replace(/每\s*小时\s*\d+/g, ' ');
    remaining = remaining.replace(/\d+\s*(?:块|元)/g, ' ');
    remaining = remaining.replace(/有个|班|的|是|在|去|来|上|下|点|号|日|月|周|到|至|时|薪/g, ' ');
    remaining = remaining.replace(/[\d\s：:,，\-]/g, ' ').trim();

    if (remaining.length >= 2) {
      const words = remaining.split(/\s+/).filter(w => w.length >= 2);
      if (words.length > 0) result.brand = words[0];
    }

    // 5. Parse wage
    const wageMatch = t.match(/时薪?[\s为是]?(\d+)/) ||
                      t.match(/(?:每|一?小时)\s*(\d+)/) ||
                      t.match(/(\d+)(?:块|元)(?:一?小时|每小时|时薪)/) ||
                      t.match(/(\d+)\s*(?:块|元)\s*$/);
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
