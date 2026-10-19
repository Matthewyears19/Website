import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const business = Object.freeze({
  name: 'Moston Pharmacy',
  company: 'Moston Pharmacy Services Ltd',
  phone: '01270 758779',
  tel: '+441270758779',
  email: 'pharmacy.fma50@nhs.net',
  address: 'G4, Dragon’s Lane, Sandbach, CW11 3PA',
  domain: 'https://mostonpharmacy.co.uk',
  facebook: 'https://www.facebook.com/profile.php?id=61579751310589',
});
export const seed = {
  prices: [
    ...['2.5 mg', '5 mg', '7.5 mg', '10 mg', '12.5 mg', '15 mg'].map((dose, i) => ({
      id: `m${i}`,
      product: 'Mounjaro',
      dose,
      price: [199, 259, 349, 349, 415, 415][i],
    })),
    ...['0.25 mg', '0.5 mg', '1 mg', '1.7 mg', '2.4 mg'].map((dose, i) => ({
      id: `w${i}`,
      product: 'Wegovy',
      dose,
      price: [149, 179, 179, 195, 259][i],
    })),
    ...['0.25 mg', '0.5 mg', '1 mg'].map((dose, i) => ({
      id: `o${i}`,
      product: 'Ozempic',
      dose,
      price: [149, 179, 199][i],
    })),
    { id: 'x28', product: 'Xenical', dose: '28 days', price: 60 },
    { id: 'x84', product: 'Xenical', dose: '84 days', price: 160 },
    { id: 'or28', product: 'Orlistat', dose: '28 days', price: 50 },
    { id: 'or84', product: 'Orlistat', dose: '84 days', price: 120 },
  ],
  news: [
    {
      id: 'weight-launch',
      date: '2025-08-01',
      title: 'Weight Loss and Management Service Launched',
      body: 'We are introducing an exciting and promising treatment and support to guide patients within the community to a healthier life.',
      published: true,
    },
    {
      id: 'contraception',
      date: '2025-09-01',
      title: 'Pharmacy First - Contraception',
      body: 'Introducing NHS backed treatments for emergency contraception, with full anonymity with our discreet service.',
      published: true,
    },
  ],
};
