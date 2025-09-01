// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
}

// Year in footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// ---- Simple “CMS”: edit your updates here ----
const updates = [
  {
    date: '2025-09-01',
    title: 'Flu jabs now available',
    body: 'Book in-store or call us. Limited slots each day.'
  },
  {
    date: '2025-09-03',
    title: 'Prescription delivery',
    body: 'Free local delivery for eligible patients — ask a team member.'
  }
];

function renderUpdates(list) {
  const root = document.getElementById('news-list');
  if (!root) return;
  root.innerHTML = '';
  list
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(item => {
      const el = document.createElement('article');
      el.className = 'news-item';
      el.innerHTML = `
        <time datetime="${item.date}">${new Date(item.date).toLocaleDateString()}</time>
        <h3>${item.title}</h3>
        <p>${item.body}</p>
      `;
      root.appendChild(el);
    });
}
renderUpdates(updates);

// ---- Contact form submit (Formspree) ----
(() => {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const status = document.getElementById('form-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  // TODO: replace with your real endpoint, e.g. "https://formspree.io/f/mvgbqbby"
  const FORMSPREE_ENDPOINT = "https://formspree.io/f/your-endpoint-id";

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // reveal status line + set initial message
    status.classList.remove('visually-hidden', 'ok', 'error');
    status.textContent = 'Sending…';
    submitBtn.disabled = true;

    try {
      const data = new FormData(form);

      // Helpful metadata
      data.append('_subject', 'New message from Moston Pharmacy website');
      data.append('page', window.location.href);

      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        form.reset();
        status.textContent = 'Thanks — your message has been sent. We’ll get back to you soon.';
        status.classList.add('ok');
      } else {
        const json = await res.json().catch(() => ({}));
        const msg = json.errors?.map(e => e.message).join(', ') || 'Please try again later.';
        status.textContent = 'Sorry, something went wrong. ' + msg;
        status.classList.add('error');
      }
    } catch (err) {
      status.textContent = 'Network error — please try again.';
      status.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      // Hide the status after a few seconds to keep the UI tidy
      setTimeout(() => status.classList.add('visually-hidden'), 6000);
    }
  });
})();
