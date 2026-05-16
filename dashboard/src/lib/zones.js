/** Gulf of Piran marine protection zones (GeoJSON). */
export const zones = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'piran-oasis',
        name: 'Piran Oasis Artificial Reef',
        type: 'danger',
        reason:
          'Artificial reef — coral and species regrowth zone. Anchoring destroys the substrate.',
        species: ['fan-mussel', 'spider-crab', 'dusky-grouper', 'seahorse'],
        severity: 'high',
        authority: 'YourSea.org',
        established: '2023',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.544, 45.522],
            [13.549, 45.522],
            [13.549, 45.526],
            [13.544, 45.526],
            [13.544, 45.522],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'posidonia-beds',
        name: 'Posidonia Oceanica Meadows',
        type: 'danger',
        reason:
          'Protected seagrass beds — Posidonia is the lungs of the Mediterranean.',
        species: ['posidonia', 'loggerhead-turtle', 'seahorse', 'date-mussel'],
        severity: 'high',
        authority: 'Slovenian Environment Agency',
        established: '2010',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.535, 45.52],
            [13.544, 45.52],
            [13.544, 45.524],
            [13.535, 45.524],
            [13.535, 45.52],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'strunjan-reserve',
        name: 'Strunjan Nature Reserve',
        type: 'restricted',
        reason: 'Protected coastal zone — no anchoring, max 5 knots.',
        species: ['common-dolphin', 'date-mussel', 'posidonia'],
        severity: 'medium',
        authority: 'Strunjan Landscape Park',
        established: '1990',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.55, 45.527],
            [13.575, 45.527],
            [13.575, 45.534],
            [13.55, 45.534],
            [13.55, 45.527],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'koper-marina',
        name: 'Koper Marina',
        type: 'safe',
        reason: 'Designated mooring zone. Full services available.',
        species: [],
        severity: 'none',
        authority: 'Port of Koper',
        mooringFee: '€25-45/night',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.725, 45.545],
            [13.738, 45.545],
            [13.738, 45.553],
            [13.725, 45.553],
            [13.725, 45.545],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'piran-marina',
        name: 'Piran Marina',
        type: 'safe',
        reason: 'Designated mooring zone. Historic town centre nearby.',
        species: [],
        severity: 'none',
        authority: 'Marina Portorož',
        mooringFee: '€20-35/night',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [13.564, 45.526],
            [13.573, 45.526],
            [13.573, 45.531],
            [13.564, 45.531],
            [13.564, 45.526],
          ],
        ],
      },
    },
  ],
};
