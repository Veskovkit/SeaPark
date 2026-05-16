const fs = require('fs');
const path = require('path');

const waypoints = [
  {
    name: 'Marina Koper departure',
    lat: 45.55022,
    lng: 13.72782,
    durationSeconds: 25,
    note: 'Safe zone - Koper marina basin',
  },
  {
    name: 'Koper Bay channel',
    lat: 45.548,
    lng: 13.73,
    durationSeconds: 30,
    note: 'Open water - exiting Koper Bay',
  },
  {
    name: 'Off Zusterna',
    lat: 45.542,
    lng: 13.708,
    durationSeconds: 25,
    note: 'Coastal transit',
  },
  {
    name: 'Off Ankaran',
    lat: 45.562,
    lng: 13.678,
    durationSeconds: 35,
    note: 'Offshore - Debeli rtic approaches',
  },
  {
    name: 'Off Izola',
    lat: 45.538,
    lng: 13.638,
    durationSeconds: 30,
    note: 'Coastal transit',
  },
  {
    name: 'Strunjan Bay entrance',
    lat: 45.512,
    lng: 13.606,
    durationSeconds: 35,
    note: 'Entering Strunjan marine zone',
  },
  {
    name: 'Off Strunjan',
    lat: 45.51,
    lng: 13.608,
    durationSeconds: 30,
    note: 'Restricted zone - along coast',
  },
  {
    name: 'Off Portoroz',
    lat: 45.506,
    lng: 13.598,
    durationSeconds: 30,
    note: 'Coastal transit toward Piran Bay',
  },
  {
    name: 'Piran Bay approach',
    lat: 45.492,
    lng: 13.588,
    durationSeconds: 25,
    note: 'Entering Piran Bay',
  },
  {
    name: 'Morska oaza Piran',
    lat: 45.4882,
    lng: 13.5836,
    durationSeconds: 45,
    note: 'DANGER ZONE - YouSea artificial reef',
  },
  {
    name: 'Posidonia meadows (off Fiesa)',
    lat: 45.491,
    lng: 13.562,
    durationSeconds: 35,
    note: 'DANGER ZONE - seagrass beds',
  },
  {
    name: 'Piran Bay north',
    lat: 45.498,
    lng: 13.578,
    durationSeconds: 25,
    note: 'Leaving danger zones',
  },
  {
    name: 'Marina Portoroz',
    lat: 45.50597,
    lng: 13.5974,
    durationSeconds: 30,
    note: 'Safe mooring area',
  },
];

const out = path.join(__dirname, '..', 'simulator', 'routes', 'piran-demo.json');
fs.writeFileSync(out, `${JSON.stringify(waypoints, null, 2)}\n`, 'utf8');
console.log('Wrote', out);
