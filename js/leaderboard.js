const Winners = (() => {
  const endpoint = 'api/winners.php';

  async function request(options = {}) {
    const response = await fetch(endpoint, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options
    });

    let payload = {};
    try {
      payload = await response.json();
    } catch (_) {
      throw new Error('The winners service returned an invalid response.');
    }

    if (!response.ok) {
      throw new Error(payload.error || 'The winners service is unavailable.');
    }
    return payload;
  }

  async function list() {
    const payload = await request();
    return Array.isArray(payload.winners) ? payload.winners : [];
  }

  async function save(username) {
    await request({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
  }

  return { list, save };
})();

window.Winners = Winners;
