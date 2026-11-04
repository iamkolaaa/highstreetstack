/* Demo data for the offline demo and for the admin "Load demo listings" button.
   Every property carries demo: 'yes' so "Remove demo listings" can clear them in one go.
   Bookings, blocks and the share are dated relative to today (Africa/Lagos) so the demo always looks current. */
import { SITE_URL } from './config.js?v=202611040820';

const U = id => ({ url: `https://images.unsplash.com/photo-${id}?w=1600&q=80` });

// Interior, apartment, house and land photos reused across listings.
const IMG = {
  flat1: '1502672260266-1c1ef2d93688', flat2: '1522708323590-d24dbb6b0267', flat3: '1493809842364-78817add7ffb',
  tower: '1545324418-cc1a3fa10c00', living1: '1586023492125-27b2c045efd7', living2: '1560448204-e02f11c3d0e2',
  living3: '1600607687939-ce8a6c25118c', kitchen1: '1484154218962-a197022b5858', kitchen2: '1556911220-bff31c812dba',
  bed1: '1505691938895-1758d7feb511', bed2: '1540518614846-7eded433c457', bed3: '1536376072261-38c75010e6c9',
  bed4: '1507089947368-19c1da9775ae', house1: '1564013799919-ab600027ffc6', house2: '1600585154340-be6161a56a0c',
  house3: '1600566753190-17f0baa2a6c3', house4: '1568605114967-8130f3a36994', house5: '1570129477492-45c003edd2be',
  pool1: '1512917774080-9991f1c4c750', pool2: '1600596542815-ffad4c1539a9', villa: '1613490493576-7fde63acd811',
  beach1: '1499793983690-e29da59ef1c2', beach2: '1507525428034-b723cf961d3e', land1: '1500382017468-9049fed747ef',
  land2: '1500076656116-558758c991c1', site: '1558036117-15d82a90b9b1', office: '1486406146926-c627a92ad1ab',
  office2: '1486325212027-8081e485255e'
};
const photos = (...keys) => keys.map(k => U(IMG[k]));

/* Lagos-time helpers (kept local so seed.js has no dependency on format.js) */
function lagosParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const today = lagosParts().date;
const stamp = (d = new Date()) => { const p = lagosParts(d); return `${p.date} ${p.time}`; };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dow = s => new Date(s + 'T00:00:00Z').getUTCDay();
const nextWeekday = (from, allowed) => { let d = from; while (!allowed.includes(dow(d))) d = addDays(d, 1); return d; };

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

function prop(p) {
  const kind = p.kind;
  return {
    status: 'live', brand: kind === 'shortlet' ? 'eko' : 'mo', address: '', bedrooms: null, bathrooms: null, max_guests: null,
    price_note: '', min_nights: null, check_in: '', check_out: '', amenities: [], featured: false, demo: 'yes',
    ...p, slug: slugify(p.title.replace(/,.*$/, '') + ' ' + p.area), photo_count: p.photos.length, cover: p.photos[0]
  };
}

export const DEMO_PROPERTIES = [
  // Shortlets (EkoShortletWithMo)
  prop({
    id: 'p_dm2lk1ab', kind: 'shortlet', title: 'Bright 2-bed with pool, Lekki Phase 1', area: 'Lekki Phase 1',
    address: 'Admiralty Way, Lekki Phase 1, Lagos', lat: 6.4474, lng: 3.4701,
    summary: 'Two bedrooms, 24h power, pool and gym.',
    description: 'A light, airy two-bedroom flat on a quiet street just off Admiralty Way. Both bedrooms have air con and ensuite bathrooms. The living room opens onto a balcony, and the pool and gym are shared with the other residents. Restaurants, supermarkets and the Lekki-Ikoyi Link Bridge are all a short drive away.',
    bedrooms: 2, bathrooms: 2, max_guests: 4, price_ngn: 85000, price_unit: 'night', min_nights: 2,
    amenities: ['Wi-Fi', '24h power', 'Pool', 'Gym', 'Parking', 'Security', 'Netflix', 'Kitchen', 'Air con', 'Balcony'],
    photos: photos('flat1', 'living1', 'bed1', 'kitchen1', 'pool2'), featured: true, sort: 1
  }),
  prop({
    id: 'p_dm3ik2cd', kind: 'shortlet', title: 'Ikoyi penthouse with city views', area: 'Ikoyi',
    address: 'Bourdillon Road, Ikoyi, Lagos', lat: 6.4549, lng: 3.4346,
    summary: 'Top-floor penthouse, three bedrooms, private terrace.',
    description: 'The top floor of a quiet Ikoyi block, with three bedrooms, a large living room and a private terrace that looks over the lagoon. There is a lift to your door, a generator that switches over in seconds, and a concierge on the ground floor. A chef can be arranged on request.',
    bedrooms: 3, bathrooms: 3, max_guests: 6, price_ngn: 350000, price_unit: 'night', min_nights: 2, check_in: '15:00',
    amenities: ['Wi-Fi', '24h power', 'Generator', 'Parking', 'Security', 'Elevator', 'Kitchen', 'Air con', 'Balcony', 'Workspace', 'Chef on request', 'Netflix'],
    photos: photos('tower', 'living3', 'bed2', 'kitchen2', 'living2'), featured: true, sort: 2
  }),
  prop({
    id: 'p_dm4vi3ef', kind: 'shortlet', title: 'Smart studio on Victoria Island', area: 'Victoria Island',
    address: 'Adetokunbo Ademola Street, Victoria Island, Lagos', lat: 6.4281, lng: 3.4219,
    summary: 'Compact studio close to the business district.',
    description: 'A neat studio for one or two people who want to be close to the offices and restaurants of Victoria Island. It has a proper desk, fast Wi-Fi and a full kitchenette. The building has round-the-clock security and power.',
    bedrooms: 1, bathrooms: 1, max_guests: 2, price_ngn: 65000, price_unit: 'night', min_nights: 1,
    amenities: ['Wi-Fi', '24h power', 'Security', 'Kitchen', 'Air con', 'Workspace', 'Elevator', 'Netflix'],
    photos: photos('flat3', 'bed3', 'kitchen1', 'living1'), featured: true, sort: 3
  }),
  prop({
    id: 'p_dm5kt4gh', kind: 'shortlet', title: 'Spacious 3-bed in Ikate', area: 'Ikate',
    address: 'Ikate Elegushi, Lekki, Lagos', lat: 6.4402, lng: 3.4620,
    summary: 'Three bedrooms, secure estate, room for a family.',
    description: 'A roomy three-bedroom flat in a gated Ikate complex, good for families or a group travelling together. The kitchen is fully equipped, there is a washer in the flat, and the beach and Lekki Arts and Crafts Market are minutes away.',
    bedrooms: 3, bathrooms: 3, max_guests: 6, price_ngn: 120000, price_unit: 'night', min_nights: 2,
    amenities: ['Wi-Fi', '24h power', 'Pool', 'Parking', 'Security', 'Kitchen', 'Washer', 'Air con', 'Netflix', 'Generator'],
    photos: photos('living2', 'bed4', 'kitchen2', 'flat2', 'pool1'), featured: true, sort: 4
  }),
  prop({
    id: 'p_dm6aj5jk', kind: 'shortlet', title: 'Family house in Ajah', area: 'Ajah',
    address: 'Off Lekki-Epe Expressway, Ajah, Lagos', lat: 6.4698, lng: 3.5852,
    summary: 'Four-bedroom detached house with a garden and parking.',
    description: 'A detached four-bedroom house in a gated Ajah estate, with a garden, space for four cars and a large open-plan kitchen and living area. A good base for a family event or an extended stay.',
    bedrooms: 4, bathrooms: 4, max_guests: 8, price_ngn: 180000, price_unit: 'night', min_nights: 2,
    amenities: ['Wi-Fi', '24h power', 'Generator', 'Parking', 'Security', 'Kitchen', 'Washer', 'Air con', 'Netflix'],
    photos: photos('house1', 'living3', 'bed1', 'kitchen1', 'house4'), sort: 5
  }),
  prop({
    id: 'p_dm7ib6lm', kind: 'shortlet', title: 'Beach house at Ibeju-Lekki', area: 'Ibeju-Lekki',
    address: 'Eleko Beach Road, Ibeju-Lekki, Lagos', lat: 6.4380, lng: 3.9650,
    summary: 'Five-bedroom beachfront house with boat access.',
    description: 'A five-bedroom house right on the sand, with a wide deck, a plunge pool and its own jetty. It suits weekend groups, birthdays and quiet working retreats. Boat trips and a chef can be arranged through Mo.',
    bedrooms: 5, bathrooms: 5, max_guests: 10, price_ngn: 250000, price_unit: 'night', min_nights: 2,
    amenities: ['Wi-Fi', 'Generator', 'Pool', 'Parking', 'Security', 'Kitchen', 'Sea view', 'Beachfront', 'Boat access', 'Chef on request', 'Air con'],
    photos: photos('beach1', 'villa', 'bed2', 'pool2', 'beach2'), featured: true, sort: 6
  }),
  prop({
    id: 'p_dm8on7no', kind: 'shortlet', title: 'Cosy 1-bed in Oniru', area: 'Oniru',
    address: 'Oniru Estate, Victoria Island, Lagos', lat: 6.4290, lng: 3.4510,
    summary: 'One bedroom, five minutes from Oniru Beach.',
    description: 'A calm one-bedroom flat with a good-sized living room and a balcony. Oniru Beach and the Landmark centre are a short walk away. The flat has its own generator and a reliable water supply.',
    bedrooms: 1, bathrooms: 1, max_guests: 2, price_ngn: 75000, price_unit: 'night', min_nights: 1,
    amenities: ['Wi-Fi', '24h power', 'Security', 'Kitchen', 'Air con', 'Balcony', 'Netflix', 'Generator'],
    photos: photos('flat2', 'bed3', 'living1', 'kitchen2'), sort: 7
  }),
  prop({
    id: 'p_dm9ch8pq', kind: 'shortlet', title: 'Modern 2-bed near Chevron', area: 'Chevron',
    address: 'Chevron Drive, Lekki, Lagos', lat: 6.4396, lng: 3.5290,
    summary: 'Two bedrooms with a workspace and gym access.',
    description: 'A modern two-bedroom flat in a gated block near Chevron Drive. There is a dedicated workspace, a gym on site and secure parking. The Lekki Toll Gate and Jakande are both within a few minutes.',
    bedrooms: 2, bathrooms: 2, max_guests: 4, price_ngn: 95000, price_unit: 'night', min_nights: 2,
    amenities: ['Wi-Fi', '24h power', 'Gym', 'Parking', 'Security', 'Kitchen', 'Air con', 'Workspace', 'Washer', 'Netflix'],
    photos: photos('flat1', 'living2', 'bed4', 'kitchen1'), sort: 8
  }),
  // For sale (RealEstateWithMo)
  prop({
    id: 'p_dmaib9rs', kind: 'land', title: 'Serviced plots at Ibeju-Lekki', area: 'Ibeju-Lekki',
    address: 'Off Lekki-Epe Expressway, Ibeju-Lekki, Lagos', lat: 6.4850, lng: 3.9300,
    summary: '600 sqm plots with title documents and fenced estate.',
    description: 'Dry, level 600 sqm plots in a fenced estate with graded roads and a gatehouse. Documents available for review, and an inspection can be booked any day except Sunday. Payment plans can be discussed on WhatsApp.',
    price_ngn: 12000000, price_unit: 'per_plot', price_note: '',
    photos: photos('land1', 'land2', 'site'), featured: true, sort: 9
  }),
  prop({
    id: 'p_dmbsg0tu', kind: 'residential', title: 'Four-bedroom duplex in Sangotedo', area: 'Sangotedo',
    address: 'Sangotedo, Ajah, Lagos', lat: 6.4700, lng: 3.6400,
    summary: 'Newly built duplex with boys quarters in a gated estate.',
    description: 'A newly finished four-bedroom duplex with a boys quarters, a fitted kitchen and space for three cars. The estate has 24-hour security, tarred roads and an active residents association. Title documents are ready.',
    bedrooms: 4, bathrooms: 5, price_ngn: 145000000, price_unit: 'total',
    amenities: ['Parking', 'Security', 'Generator', 'Kitchen', 'Air con'],
    photos: photos('house2', 'house3', 'living3', 'kitchen2', 'bed1'), featured: true, sort: 10
  }),
  prop({
    id: 'p_dmclk1vw', kind: 'commercial', title: 'Commercial land on the Lekki corridor', area: 'Lekki Phase 1',
    address: 'Lekki-Epe Expressway, Lagos', lat: 6.4580, lng: 3.5650,
    summary: '1,800 sqm with road frontage, suited to offices or retail.',
    description: 'A corner plot of about 1,800 sqm with direct frontage on the expressway, suited to an office block, showroom or retail centre. Documents available on request. Contact Mo for a site visit.',
    price_ngn: 380000000, price_unit: 'total',
    photos: photos('office', 'site', 'office2'), featured: true, sort: 11
  }),
  prop({
    id: 'p_dmdep2xy', kind: 'land', title: 'Affordable plots in Epe', area: 'Epe',
    address: 'Epe, Lagos', lat: 6.5840, lng: 3.9750,
    summary: '450 sqm plots with flexible payment plans.',
    description: 'Good-value 450 sqm plots on a growing road, with a payment plan over up to 12 months. A first-time buyer option for building later or holding as an investment.',
    price_ngn: 4500000, price_unit: 'per_plot',
    photos: photos('land2', 'land1', 'site'), sort: 12
  })
];

const P = DEMO_PROPERTIES;
const pid = n => P[n].id;
const ptitle = n => P[n].title;
const nowStamp = stamp();
const holdUntil = stamp(new Date(Date.now() + 24 * 3600 * 1000));
const ago = days => stamp(new Date(Date.now() - days * 86400000));
const inspDay = nextWeekday(addDays(today, 1), [1, 2, 3, 4, 5, 6]);
const consultDay = nextWeekday(addDays(today, 2), [1, 2, 3, 4, 5]);

const bk = b => ({
  kind: 'stay', status: 'pending', check_in: '', check_out: '', nights: 0, guests: 0, slot_date: '', slot_time: '', mode: '',
  email: '', note: '', quote_ngn: null, source: 'site', share_code: '', hold_until: '', admin_note: '',
  created_at: nowStamp, updated_at: nowStamp, ...b,
  property_title: b.property_id ? P.find(p => p.id === b.property_id).title : ''
});

export const DEMO_BOOKINGS = [
  bk({ ref: 'RM-7K3F2', kind: 'stay', status: 'pending', property_id: pid(0), check_in: addDays(today, 3), check_out: addDays(today, 6), nights: 3, guests: 2, name: 'Tunde A.', phone: '+2348031234567', note: 'Late arrival, around 10pm.', quote_ngn: 255000, hold_until: holdUntil }),
  bk({ ref: 'RM-4HQ9X', kind: 'stay', status: 'confirmed', property_id: pid(1), check_in: addDays(today, 7), check_out: addDays(today, 10), nights: 3, guests: 4, name: 'Amara O.', phone: '+2347061112233', email: 'amara@example.com', quote_ngn: 1050000, source: 'share', share_code: 'K7M3QX', updated_at: ago(1) }),
  bk({ ref: 'RM-B2N8D', kind: 'inspection', status: 'pending', property_id: pid(9), slot_date: inspDay, slot_time: '12:00', name: 'Chidi E.', phone: '+2348095557788', note: 'Coming with my wife.' }),
  bk({ ref: 'RM-9TW5M', kind: 'stay', status: 'done', property_id: pid(3), check_in: addDays(today, -20), check_out: addDays(today, -17), nights: 3, guests: 3, name: 'Funmi K.', phone: '+2348023344556', quote_ngn: 360000, created_at: ago(25), updated_at: ago(17) }),
  bk({ ref: 'RM-6RC3J', kind: 'stay', status: 'declined', property_id: pid(2), check_in: addDays(today, 14), check_out: addDays(today, 16), nights: 2, guests: 2, name: 'David M.', phone: '+447700900123', quote_ngn: 130000, admin_note: 'Not available, owner using it.', created_at: ago(2), updated_at: ago(1) }),
  bk({ ref: 'RM-3YE7P', kind: 'consultation', status: 'pending', mode: 'online', slot_date: consultDay, slot_time: '15:00', name: 'Ngozi U.', phone: '+2348064449900', note: 'Thinking about land for a family home.' })
];

export const DEMO_BLOCKS = [
  { id: 'b_dm000001', property_id: pid(0), from: addDays(today, 20), to: addDays(today, 23), reason: 'Owner visit', source: 'admin', created_at: nowStamp },
  { id: 'b_dm000002', property_id: pid(4), from: addDays(today, 30), to: addDays(today, 35), reason: 'Repainting', source: 'admin', created_at: nowStamp }
];

export const DEMO_SHARES = [
  {
    code: 'K7M3QX', status: 'active', featured_id: pid(0), pick_ids: [pid(3), pid(7), pid(6)],
    note: 'Hi Tunde, this is the one I mentioned. Three others close by if you want to compare.', client_name: 'Tunde A.',
    check_in: addDays(today, 3), check_out: addDays(today, 6), expires: addDays(today, 14), views: 3, last_viewed: ago(0),
    created_at: ago(1), url: SITE_URL + 'share.html?s=K7M3QX'
  }
];

// Every Settings key except PHOTOS_FOLDER_ID, as stored (text values).
export const DEMO_SETTINGS = {
  WHATSAPP_NUMBER: '', WHATSAPP_LINK: 'https://wa.link/zjc9ff', NOTIFY_EMAIL: '', CHECK_IN: '14:00', CHECK_OUT: '11:00',
  MIN_NIGHTS: '1', MAX_NIGHTS: '30', CLEANING_BUFFER_DAYS: '0', HOLD_HOURS: '24', MAX_ADVANCE_DAYS: '365',
  INSPECTION_DAYS: '1,2,3,4,5,6', INSPECTION_SLOTS: '10:00,12:00,14:00,16:00', CONSULT_DAYS: '1,2,3,4,5',
  CONSULT_SLOTS: '10:00,12:00,15:00,17:00', SHARE_EXPIRY_DAYS: '14', SITE_URL, ICAL_IMPORT: 'no',
  LAST_ICAL_SYNC: '', LAST_ICAL_ERROR: '', ALERT_EMAIL: ''
};
