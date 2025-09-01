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
