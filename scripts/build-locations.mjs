// Generates data/locations.json (commercetools Channel drafts) for the 37 Nuffield Health hospitals.
// Address/geo/hours are TODO: crawl each location page later.
import { writeFileSync, mkdirSync } from 'node:fs';

const H = [
  ['Bournemouth','Bournemouth','south-west'],['Brentwood','Brentwood','east'],['Brighton','Brighton','south-east'],
  ['Bristol','Clifton, Bristol','south-west'],['Cambridge','Cambridge','east'],['Cardiff and Vale','Cardiff','wales'],
  ['Cheltenham','Cheltenham','south-west'],['Chester','Chester','north-west'],['Chichester','Chichester','south-east'],
  ['Derby','Derby','midlands'],['Exeter','Exeter','south-west'],['Glasgow','Glasgow','scotland'],
  ['Guildford','Guildford','south-east'],['Haywards Heath','Haywards Heath','south-east'],['Hereford','Hereford','midlands'],
  ['Ipswich','Ipswich','east'],['Leeds','Leeds','north'],['Leicester','Leicester','midlands'],
  ['Manchester Diagnostic Suite','Manchester','north-west','diagnostic-suite'],
  ['Manchester Institute of Health & Performance','Manchester','north-west','diagnostic-suite','mihp'],
  ['Newcastle upon Tyne','Newcastle upon Tyne','north'],['North Staffordshire','Newcastle-under-Lyme','midlands'],
  ['Oxford','Headington, Oxford','south-east'],['Plymouth','Plymouth','south-west'],['Shrewsbury','Shrewsbury','midlands'],
  ['Taunton','Taunton','south-west'],['Tees','Norton, Stockton on Tees','north'],['Tunbridge Wells','Tunbridge Wells','south-east'],
  ['Warwickshire','Leamington Spa','midlands'],['Wessex','Chandlers Ford, Eastleigh','south-east'],['Woking','Woking','south-east'],
  ['Wolverhampton','Tettenhall, Wolverhampton','midlands'],['York','York','north'],
  ['Parkside','Wimbledon, London','london'],['Highgate','Highgate, London','london'],
  ['Edinburgh','Edinburgh','scotland'],['The Holly','Buckhurst Hill, Essex','london'],
];

const GEO = {
  'Bournemouth':[50.74,-1.87],'Brentwood':[51.62,0.30],'Brighton':[50.84,-0.14],'Bristol':[51.46,-2.62],'Cambridge':[52.19,0.15],
  'Cardiff and Vale':[51.48,-3.18],'Cheltenham':[51.90,-2.07],'Chester':[53.19,-2.89],'Chichester':[50.84,-0.78],'Derby':[52.92,-1.48],
  'Exeter':[50.72,-3.53],'Glasgow':[55.86,-4.25],'Guildford':[51.24,-0.57],'Haywards Heath':[51.00,-0.10],'Hereford':[52.06,-2.72],
  'Ipswich':[52.06,1.15],'Leeds':[53.80,-1.55],'Leicester':[52.64,-1.13],'Manchester Diagnostic Suite':[53.48,-2.24],
  'Manchester Institute of Health & Performance':[53.46,-2.20],'Newcastle upon Tyne':[54.98,-1.61],'North Staffordshire':[53.01,-2.23],
  'Oxford':[51.76,-1.21],'Plymouth':[50.38,-4.14],'Shrewsbury':[52.71,-2.75],'Taunton':[51.02,-3.10],'Tees':[54.58,-1.31],
  'Tunbridge Wells':[51.13,0.26],'Warwickshire':[52.29,-1.53],'Wessex':[50.98,-1.37],'Woking':[51.32,-0.56],'Wolverhampton':[52.60,-2.17],
  'York':[53.96,-1.08],'Parkside':[51.42,-0.22],'Highgate':[51.57,-0.15],'Edinburgh':[55.95,-3.19],'The Holly':[51.62,0.04],
};
// Extra sample London sites (approximate coords, TODO replace with crawled data)
const EXTRA = [
  ['Moorgate','medical-centre',[51.519,-0.087]],['Barbican','medical-centre',[51.520,-0.094]],
  ['West End (Queen Anne Street)','medical-centre',[51.519,-0.148]],['City','gym',[51.514,-0.083]],
];
const slug = s => s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const channels = H.map(([name, town, region, type = 'hospital', urlSlug]) => {
  const s = urlSlug ?? slug(name);
  return {
    key: `loc-${type === 'hospital' ? 'hospital' : 'diagnostic'}-${slug(name)}`,
    roles: ['InventorySupply', 'ProductDistribution'],
    geoLocation: { type: 'Point', coordinates: [GEO[name][1], GEO[name][0]] },
    name: { 'en-GB': type === 'hospital' ? `Nuffield Health ${name} Hospital` : `Nuffield Health ${name}` },
    custom: {
      type: { typeId: 'type', key: 'nh-location' },
      fields: {
        locationType: type,
        town,
        region,
        pricingRegion: region === 'london' ? 'london' : 'outside-london',
        timezone: 'Europe/London',
        calendarResourceId: `cal-${slug(name)}`,
        url: `https://www.nuffieldhealth.com/${urlSlug === 'mihp' ? 'mihp' : 'hospitals/' + s}`,
        addressTodo: true,
        geoApprox: true,
      },
    },
  };
});

for (const [name, type, [lat, lng]] of EXTRA) {
  channels.push({
    key: `loc-${type}-${slug(name)}`,
    roles: ['InventorySupply', 'ProductDistribution'],
    geoLocation: { type: 'Point', coordinates: [lng, lat] },
    name: { 'en-GB': `Nuffield Health ${name}` + (type === 'gym' ? ' Fitness & Wellbeing Gym' : ' Medical Centre') },
    custom: { type: { typeId: 'type', key: 'nh-location' }, fields: { locationType: type, town: 'London', region: 'london', pricingRegion: 'london', timezone: 'Europe/London', calendarResourceId: `cal-${slug(name)}`, addressTodo: true, geoApprox: true } },
  });
}
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/locations.json', import.meta.url), JSON.stringify(channels, null, 2));
console.log(`wrote ${channels.length} channels`);
