// Set API_URL to the deployed Apps Script web app URL to go live.
export const API_URL = 'https://script.google.com/macros/s/AKfycbzOa8sqfMi_wkFRZ5EM9fifzRFa7ZsxR-SlVYHx_Sa2WC8Lc_3d24Nne9Vxms68UaDRnw/exec';
export const MOCK = !API_URL || new URLSearchParams(location.search).has('mock');
export const PUBLIC_URL = 'https://highstreetstack.com/cranecheck/';
export const OFFICE_PHONE_FALLBACK = '01453 811754';
