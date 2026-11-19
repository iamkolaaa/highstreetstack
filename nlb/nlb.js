import { BOOK_CALL_URL, FORM_URL } from './config.js'
import { validateNlbEnquiry } from './enquiry.js'

const $ = id => document.getElementById(id)

document.querySelectorAll('[data-book]').forEach(a => { a.href = BOOK_CALL_URL })

function setMsg(text, isError) {
  const m = $('form-msg')
  m.textContent = text
  m.classList.toggle('err', Boolean(isError))
  m.hidden = false
}

async function submitEnquiry(e) {
  e.preventDefault()
  const body = {
    name: $('name').value,
    email: $('email').value,
    website: $('website').value,
    social: $('social').value,
    phone: $('phone').value,
    availability: $('availability').value,
    confirm: $('confirm').checked,
    hss_ref: $('hss_ref').value,
  }
  const v = validateNlbEnquiry(body)
  if (!v.ok) {
    if (!v.silent) setMsg(v.error, true)
    return
  }
  const btn = $('send')
  btn.disabled = true
  btn.textContent = 'Sending…'
  try {
    const res = await fetch(FORM_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(v.payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!(data.success === true || data.success === 'true')) throw new Error(data.message || 'rejected')
    $('enquiry').hidden = true
    setMsg('Received. Kola will use this to arrange your call.', false)
  } catch (err) {
    console.warn('enquiry failed', err)
    btn.disabled = false
    btn.textContent = 'Send enquiry'
    setMsg('Could not send just yet. Email hello@highstreetstack.com and Kola will pick it up.', true)
  }
}

$('enquiry').addEventListener('submit', submitEnquiry)
$('enquiry').addEventListener('input', () => { $('form-msg').hidden = true })
