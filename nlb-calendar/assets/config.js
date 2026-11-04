// Set API_URL to the deployed Apps Script web app URL (ends in /exec) to go live.
// While it is empty, or when the page address has ?mock, the page runs on built-in demo data.
export const API_URL = 'https://script.google.com/macros/s/AKfycbx4k4Q3vVnRgR3lfkAk_QBzg1G6ugXERs81MUFdSNPJ9Dxlwul-UqOwL-bLTHPgkAin/exec';
export const MOCK = !API_URL || new URLSearchParams(location.search).has('mock');
export const PUBLIC_URL = 'https://highstreetstack.com/nlb-calendar/';
