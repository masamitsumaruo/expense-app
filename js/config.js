const CONFIG = {
  getApiKey() {
    return localStorage.getItem('claude_api_key') || '';
  },
  setApiKey(key) {
    localStorage.setItem('claude_api_key', key);
  },
  hasApiKey() {
    const key = this.getApiKey();
    return key && key.startsWith('sk-ant-');
  }
};
