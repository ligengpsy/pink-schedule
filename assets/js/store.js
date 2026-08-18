(function (global) {
  'use strict';

  function getUser() {
    const s = Auth.getSession();
    return s ? s.account : 'guest';
  }

  function key(name) {
    return 'pink-schedule-' + getUser() + '-' + name;
  }

  function load(name, fallback) {
    try {
      const raw = localStorage.getItem(key(name));
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return fallback !== undefined ? fallback : [];
  }

  function save(name, data) {
    try {
      localStorage.setItem(key(name), JSON.stringify(data));
    } catch (e) {
      console.error('存储失败:', e);
    }
  }

  function remove(name) {
    localStorage.removeItem(key(name));
  }

  function loadShifts() {
    return load('shifts', []);
  }

  function saveShifts(shifts) {
    save('shifts', shifts);
  }

  function loadTemplates() {
    return load('templates', []);
  }

  function saveTemplates(list) {
    save('templates', list);
  }

  function loadSettings() {
    const defaults = {
      aiApiUrl: '',
      aiApiKey: '',
      aiModel: 'gpt-4o-mini',
      overtimeThreshold: 8,
      overtimeRate: 1.5,
      taxRate: 0,
      theme: 'light',
      weekStartDay: 0
    };
    return Object.assign(defaults, load('settings', {}));
  }

  function saveSettings(settings) {
    save('settings', settings);
  }

  function exportAll() {
    return {
      shifts: loadShifts(),
      templates: loadTemplates(),
      settings: loadSettings(),
      exportedAt: new Date().toISOString()
    };
  }

  function importAll(data) {
    if (data.shifts) saveShifts(data.shifts);
    if (data.templates) saveTemplates(data.templates);
    if (data.settings) saveSettings(data.settings);
  }

  function clearAll() {
    remove('shifts');
    remove('templates');
    remove('settings');
  }

  global.Store = {
    load: load,
    save: save,
    loadShifts: loadShifts,
    saveShifts: saveShifts,
    loadTemplates: loadTemplates,
    saveTemplates: saveTemplates,
    loadSettings: loadSettings,
    saveSettings: saveSettings,
    exportAll: exportAll,
    importAll: importAll,
    clearAll: clearAll
  };
})(window);
