document.documentElement.classList.add('js');
const toggle = document.querySelector('.menu-toggle'),
  nav = document.querySelector('#navigation');
toggle?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav?.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && nav?.classList.contains('open')) {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.focus();
  }
});
document.querySelectorAll('[data-public-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'),
      status = form.querySelector('[role="status"]');
    button.disabled = true;
    status.classList.remove('error');
    status.textContent = 'Sending your request…';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams(new FormData(form)),
        signal: AbortSignal.timeout(20000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Please try again.');
      status.textContent = result.message;
      form.reset();
      button.textContent = 'Request received';
      status.focus();
    } catch (error) {
      status.classList.add('error');
      status.textContent =
        error.name === 'TimeoutError'
          ? 'The connection timed out. You can retry safely using this form; the same request will not be queued twice.'
          : error.message;
      button.disabled = false;
      status.focus();
    }
  });
});
