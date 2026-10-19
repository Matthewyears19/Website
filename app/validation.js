export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
export function text(value, label, max = 160, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
    fail(`Please check ${label}.`);
  return value.trim();
}
export function email(value) {
  const v = text(value, 'email address', 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v)) fail('Please enter a valid email address.');
  return v;
}
export function date(value, label) {
  const v = text(value, label, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    fail(`Please check ${label}.`);
  return v;
}
export function validateForm(kind, data) {
  const result = {
    email: email(data.email),
    phone: text(data.phone ?? '', 'telephone', 40, kind === 'prescription'),
  };
  if (kind === 'contact')
    return {
      ...result,
      name: text(data.name, 'name'),
      message: text(data.message, 'message', 3000),
    };
  if (kind !== 'prescription') fail('Unknown form.', 404);
  for (const [name, label, max] of [
    ['title', 'title', 30],
    ['firstName', 'first name', 100],
    ['lastName', 'surname', 100],
    ['address', 'address', 1000],
    ['postcode', 'postcode', 20],
    ['doctor', 'doctor’s name', 160],
    ['surgery', 'surgery address', 1000],
    ['surgeryPostcode', 'surgery postcode', 20],
  ])
    result[name] = text(data[name], label, max);
  result.dob = date(data.dob, 'date of birth');
  if (result.dob > new Date().toISOString().slice(0, 10) || result.dob < '1900-01-01')
    fail('Please check the date of birth.');
  for (const name of ['mobile', 'deliveryAddress', 'deliveryPostcode'])
    result[name] = text(data[name] ?? '', name, name === 'deliveryAddress' ? 1000 : 40, false);
  if (Boolean(result.deliveryAddress) !== Boolean(result.deliveryPostcode))
    fail('Include both the delivery address and postcode, or leave both blank.');
  if (data.authorisation !== 'yes')
    fail('Please confirm the prescription collection authorisation.');
  return {
    ...result,
    authorisation:
      'I hereby authorise Moston Pharmacy Services to collect, either in person or by means of electronic transfer, my prescription from the surgery shown above on my behalf. I agree to inform Moston Pharmacy Services of any changes.',
    authorisationVersion: '2026-09-30',
    submittedAt: new Date().toISOString(),
  };
}
export function validateContent(value) {
  if (
    !Number.isSafeInteger(value.revision) ||
    !Array.isArray(value.prices) ||
    !Array.isArray(value.news) ||
    value.prices.length > 100 ||
    value.news.length > 100
  )
    fail('Invalid content.');
  const ids = new Set();
  const id = (v) => {
    v = text(v, 'item ID', 80);
    if (!/^[\w-]+$/.test(v) || ids.has(v)) fail('Each item needs a unique ID.');
    ids.add(v);
    return v;
  };
  return {
    revision: value.revision,
    prices: value.prices.map((p) => {
      if (
        typeof p.price !== 'number' ||
        !Number.isFinite(p.price) ||
        p.price < 0 ||
        p.price > 10000 ||
        Math.abs(p.price * 100 - Math.round(p.price * 100)) > 0.0001
      )
        fail('Prices must be between £0 and £10,000, with at most two decimal places.');
      return {
        id: id(p.id),
        product: text(p.product, 'product', 80),
        dose: text(p.dose, 'strength or supply', 80),
        price: p.price,
      };
    }),
    news: value.news.map((n) => {
      if (typeof n.published !== 'boolean') fail('Please check publication status.');
      return {
        id: id(n.id),
        date: date(n.date, 'article date'),
        title: text(n.title, 'article title', 160),
        body: text(n.body, 'article text', 5000),
        published: n.published,
      };
    }),
  };
}
