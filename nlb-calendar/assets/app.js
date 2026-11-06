/* Entry point. ?admin opens the admin page; otherwise this is the client booking page (?c=<link key>). */
import { MOCK } from './config.js?v=202611061900';

const q = new URLSearchParams(location.search);
if (q.has('admin')) {
  import('./admin.js?v=202611061900').then(m => m.start());
} else {
  import('./client.js?v=202611061900').then(m => m.start(q.get('c') || ''));
}
if (MOCK) document.documentElement.dataset.mock = '1';
