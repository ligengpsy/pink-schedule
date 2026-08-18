(function (global) {
  'use strict';

  const USERS = {
    '61': { password: '0724', name: '排班管理员', role: 'admin' }
  };

  const SESSION_KEY = 'pink-schedule-session';

  function login(account, password) {
    const user = USERS[account];
    if (!user || user.password !== password) {
      return { success: false, error: '账号或密码错误' };
    }
    const session = {
      account: account,
      name: user.name,
      role: user.role,
      loginAt: Date.now()
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { success: true, user: session };
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.href = '../index.html';
  }

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function requireAuth() {
    const session = getSession();
    if (!session) {
      const current = location.pathname.split('/').pop();
      if (current !== 'login.html' && current !== 'index.html') {
        location.href = '../index.html';
      }
      return null;
    }
    return session;
  }

  function getCurrentUser() {
    return getSession();
  }

  global.Auth = {
    login: login,
    logout: logout,
    getSession: getSession,
    requireAuth: requireAuth,
    getCurrentUser: getCurrentUser
  };
})(window);
