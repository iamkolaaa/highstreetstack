// Set API_URL to the deployed Apps Script web app URL (ends in /exec) to go live.
// While it is empty, or when the page address has ?mock, the page runs on built-in demo data.
export const API_URL = '';
export const MOCK = !API_URL || new URLSearchParams(location.search).has('mock');
export const SITE_URL = 'https://highstreetstack.com/realestatewithmo/';
export const TZ = 'Africa/Lagos';
export const WA_FALLBACK = 'https://wa.link/zjc9ff';
export const BRAND = {
  name: 'RealEstateWithMo', sub: 'EkoShortletWithMo', owner: 'Moyinoluwa Johnson-Oladipo', short: 'Mo',
  instagram: 'https://instagram.com/realestatewithmo_', instagram_eko: 'https://instagram.com/ekoshortlets_withmo',
  tiktok: 'https://tiktok.com/@REALESTATESHORTLETWITHMO', facebook: 'https://facebook.com/MOYINOLUWA.O.TOMI.JOHNSON',
  stats: [['500+', 'Plots sold'], ['20+', 'Houses delivered'], ['100+', 'Happy clients'], ['5+', 'Years of trust']]
};
export const AREAS = ['Lekki Phase 1', 'Ikoyi', 'Victoria Island', 'Ikate', 'Oniru', 'Ajah', 'Ibeju-Lekki', 'Chevron', 'Yaba', 'Ikeja GRA', 'Sangotedo', 'Epe'];
export const AMENITIES = ['Wi-Fi', '24h power', 'Pool', 'Gym', 'Parking', 'Security', 'Netflix', 'Kitchen', 'Washer', 'Sea view', 'Generator', 'Air con', 'Elevator', 'Balcony', 'Workspace', 'Chef on request', 'Beachfront', 'Boat access'];
