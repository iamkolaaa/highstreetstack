/* WhatsApp message texts Mo sends to clients. Plain functions, no DOM.
   Every function takes the booking (admin shape) and a small context:
   { settings: { check_in, check_out }, property: { check_in, check_out, title } | null, site_url } */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function day(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return DAYS[d.getUTCDay()] + ' ' + (+m[3]) + ' ' + MONTHS[+m[2] - 1];
}

export function naira(n) {
  const v = Math.round(Number(n));
  if (!isFinite(v) || n === '' || n === null || n === undefined) return '';
  return '₦' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function first(name) {
  const n = String(name || '').trim().split(/\s+/)[0];
  return n || 'there';
}

function title(b, c) {
  return b.property_title || (c && c.property && c.property.title) || (b.kind === 'consultation' ? 'a consultation' : 'the property');
}

function times(b, c) {
  const s = (c && c.settings) || {};
  const p = (c && c.property) || {};
  return { inT: p.check_in || s.check_in || '14:00', outT: p.check_out || s.check_out || '11:00' };
}

function when(b) {
  if (b.kind === 'stay') {
    const n = b.nights ? ' (' + b.nights + (b.nights === 1 ? ' night' : ' nights') + ')' : '';
    return day(b.check_in) + ' to ' + day(b.check_out) + n;
  }
  return day(b.slot_date) + ' at ' + (b.slot_time || '');
}

function sign() { return '\n\nMo'; }

export function received(b, c) {
  return 'Hello ' + first(b.name) + ', thank you for your request ' + b.ref + ' for ' + title(b, c) + ', ' + when(b) +
    '. I am checking it now and will confirm shortly.' + sign();
}

export function confirmStay(b, c) {
  const t = times(b, c);
  const quote = b.quote_ngn ? ' The total is ' + naira(b.quote_ngn) + '.' : '';
  const guests = b.guests ? ', ' + b.guests + (Number(b.guests) === 1 ? ' guest' : ' guests') : '';
  return 'Hello ' + first(b.name) + ', good news. Your stay is confirmed.\n\nRef: ' + b.ref + '\n' + title(b, c) + '\n' + when(b) + guests +
    '.' + quote + '\nCheck-in from ' + t.inT + ', check-out by ' + t.outT + '.\n\nI will send the address and entry details before you arrive. Reply here if you need anything.' + sign();
}

export function declineStay(b, c) {
  return 'Hello ' + first(b.name) + ', thank you for asking about ' + title(b, c) + ' for ' + when(b) +
    '. I am sorry, those dates are not available. I can suggest other places that are free for you, just say the word.' + sign();
}

export function confirmInspection(b, c) {
  return 'Hello ' + first(b.name) + ', your inspection is confirmed.\n\nRef: ' + b.ref + '\n' + title(b, c) + '\n' + when(b) +
    '\n\nI will send the exact location the day before. Please tell me if you need to change the time.' + sign();
}

export function declineInspection(b, c) {
  return 'Hello ' + first(b.name) + ', thank you for asking to see ' + title(b, c) + ' on ' + when(b) +
    '. That slot is not available. Let me know another day that suits you and I will fit you in.' + sign();
}

export function confirmConsultation(b) {
  const mode = b.mode === 'online' ? 'online (I will send the link)' : b.mode === 'in_person' ? 'in person (I will send the address)' : '';
  return 'Hello ' + first(b.name) + ', your consultation is confirmed.\n\nRef: ' + b.ref + '\n' + when(b) + (mode ? ', ' + mode : '') +
    '.\n\nSend me anything you would like me to look at beforehand.' + sign();
}

export function declineConsultation(b) {
  return 'Hello ' + first(b.name) + ', thank you for booking a consultation. That time is not available. Please send me another day and time that works and I will confirm.' + sign();
}

export function remind(b, c) {
  const t = times(b, c);
  if (b.kind === 'stay') {
    return 'Hello ' + first(b.name) + ', a friendly reminder that your stay at ' + title(b, c) + ' starts on ' + day(b.check_in) +
      '. Check-in is from ' + t.inT + ' and check-out is by ' + t.outT + ' on ' + day(b.check_out) + '. Ref ' + b.ref + '. See you soon.' + sign();
  }
  if (b.kind === 'inspection') {
    return 'Hello ' + first(b.name) + ', a reminder of your inspection of ' + title(b, c) + ' on ' + when(b) + '. Ref ' + b.ref + '. Tell me if you are running late.' + sign();
  }
  return 'Hello ' + first(b.name) + ', a reminder of our consultation on ' + when(b) + '. Ref ' + b.ref + '.' + sign();
}

export function cancelled(b, c) {
  return 'Hello ' + first(b.name) + ', I have cancelled ' + b.ref + ' (' + title(b, c) + ', ' + when(b) + '). Message me if you would like to rebook or choose another place.' + sign();
}

export function thanks(b, c) {
  return 'Hello ' + first(b.name) + ', thank you for choosing us' + (b.kind === 'stay' ? ' for your stay at ' + title(b, c) : '') +
    '. I hope it went well. If you could leave a short review or send a photo, it would mean a lot.' + sign();
}

export function expired(b, c) {
  return 'Hello ' + first(b.name) + ', your request ' + b.ref + ' for ' + title(b, c) + ' timed out before I could confirm it. If you still want it, tell me and I will check the dates again.' + sign();
}

export function shareLink(share, c) {
  const name = share && share.client_name ? first(share.client_name) : 'there';
  const url = (share && share.url) || '';
  const note = share && share.note ? '\n\n' + share.note : '';
  const dates = share && share.check_in && share.check_out ? ' for ' + day(share.check_in) + ' to ' + day(share.check_out) : '';
  return 'Hello ' + name + ', here are my picks for you' + dates + '. Open the link to see photos, prices and what is free, and book straight from there.' + note + '\n\n' + url + sign();
}

/* The right text for a booking in its current status. */
export function forBooking(b, c) {
  const k = b.kind;
  switch (b.status) {
    case 'pending': return received(b, c);
    case 'confirmed': return k === 'stay' ? confirmStay(b, c) : k === 'inspection' ? confirmInspection(b, c) : confirmConsultation(b, c);
    case 'declined': return k === 'stay' ? declineStay(b, c) : k === 'inspection' ? declineInspection(b, c) : declineConsultation(b, c);
    case 'cancelled': return cancelled(b, c);
    case 'done': return thanks(b, c);
    case 'expired': return expired(b, c);
    default: return received(b, c);
  }
}

/* wa.me link to a client's number with text. phone is stored as +234... */
export function waClient(phone, text) {
  const digits = String(phone || '').replace(/\D/g, '');
  return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
}

/* wa.me link with no recipient (Mo picks the chat). */
export function waPick(text) {
  return 'https://wa.me/?text=' + encodeURIComponent(text || '');
}
