(function (global) {
  'use strict';

  function getSettings() {
    return Store.loadSettings();
  }

  function buildSystemPrompt(context) {
    let prompt = '你是一个智能排班助手，帮助用户管理排班、计算工资、分析工作情况。\n';
    prompt += '用户使用中文交流，请用中文简洁地回答。\n\n';

    prompt += '## 你的能力\n';
    prompt += '1. 理解用户自然语言，解析班次信息（日期、时间、品牌、时薪等）\n';
    prompt += '2. 计算和分析工资、工时\n';
    prompt += '3. 检测排班冲突\n';
    prompt += '4. 给出排班优化建议\n\n';

    prompt += '## 班次解析规则\n';
    prompt += '- 日期："今天"=当天，"明天"=次日，"后天"=第三日，"X号"/"X日"=具体日期\n';
    prompt += '- 时间："6-10点"=6:00到10:00，"下午2点到6点"=14:00到18:00\n';
    prompt += '- 班次类型：早上/上午→早班，下午→中班，晚上→晚班\n';
    prompt += '- 时薪："每小时200"/"时薪200"/"200块一小时"→时薪200\n\n';

    prompt += '## 回复格式\n';
    prompt += '当用户描述的班次信息可以解析时：\n';
    prompt += '1. 先用自然语言简短确认（如"好的，帮你记一下：8月19日 珀莱雅 早班 6:00-10:00 时薪¥200，预计收入¥800"）\n';
    prompt += '2. 然后在末尾加一行结构化数据，用<shift>标签包裹JSON：\n';
    prompt += '<shift>{"date":"YYYY-MM-DD","type":"早班|中班|晚班|加班|自定义","brand":"品牌名","start":"HH:MM","end":"HH:MM","wage":数字}</shift>\n\n';
    prompt += '当用户问工资、建议等问题时，正常回复即可，不要加<shift>标签。\n\n';

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

      prompt += '## 当前用户本月数据\n';
      prompt += '- 今天: ' + now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '\n';
      prompt += '- 本月班次数: ' + monthShifts.length + '\n';
      prompt += '- 本月总工时: ' + totalHours.toFixed(1) + '小时\n';
      prompt += '- 本月预估工资: ¥' + totalSalary.toFixed(2) + '\n';

      if (monthShifts.length > 0) {
        const brands = {};
        monthShifts.forEach(s => {
          const b = s.brand || '未填写';
          if (!brands[b]) brands[b] = { hours: 0, salary: 0 };
          const h = Utils.hoursBetween(s.start, s.end);
          brands[b].hours += h;
          brands[b].salary += h * s.wage;
        });
        prompt += '- 品牌分布: ' + Object.keys(brands).map(b => b + '(' + brands[b].hours.toFixed(0) + 'h)').join(', ') + '\n';
      }

      prompt += '\n## 本月班次详情\n';
      monthShifts.sort((a, b) => a.date.localeCompare(b.date)).forEach(s => {
        const h = Utils.hoursBetween(s.start, s.end);
        prompt += s.date + ' ' + (s.brand || '') + ' ' + s.type + ' ' + s.start + '-' + s.end + ' ¥' + s.wage + '/h (' + h.toFixed(1) + 'h)\n';
      });
    }

    return prompt;
  }

  function extractShiftData(reply) {
    const match = reply.match(/<shift>\s*(\{[^}]+\})\s*<\/shift>/);
    if (!match) return null;
    try {
      const data = JSON.parse(match[1]);
      if (data.date && data.start) return data;
    } catch (e) {}
    return null;
  }

  function cleanReply(reply) {
    return reply.replace(/<shift>\s*\{[^}]+\}\s*<\/shift>/g, '').trim();
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
      model: settings.aiModel || 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1000
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
      const rawReply = data.choices?.[0]?.message?.content || data.content || '未获取到回复';
      const shiftData = extractShiftData(rawReply);
      const cleanText = cleanReply(rawReply);

      return {
        success: true,
        reply: cleanText,
        shift: shiftData
      };
    } catch (e) {
      return { success: false, error: '网络请求失败: ' + e.message };
    }
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

    if (/早上|上午|清晨|凌晨/.test(t)) result.type = '早班';
    else if (/下午/.test(t)) result.type = '中班';
    else if (/晚上|晚间|夜间/.test(t)) result.type = '晚班';
    const typeMatch = t.match(/(早班|中班|晚班|加班|自定义)/);
    if (typeMatch) result.type = typeMatch[1];

    const times = [];
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
      if (/下午|晚上|晚间/.test(beforeText)) {
        if (h1 < 12) h1 += 12;
        if (h2 < 12) h2 += 12;
      }
      times.push(String(h1).padStart(2, '0') + ':' + String(min1).padStart(2, '0'));
      times.push(String(h2).padStart(2, '0') + ':' + String(min2).padStart(2, '0'));
    }

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
