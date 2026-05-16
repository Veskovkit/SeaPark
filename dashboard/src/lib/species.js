/** Adriatic species catalog referenced by zones and Gemini analysis. */
export const speciesCatalog = {
  'fan-mussel': {
    id: 'fan-mussel',
    nickname: 'Fan Mussel',
    scientificName: 'Pinna nobilis',
    emoji: '🐚',
    status: 'Critically Endangered',
    statusColor: '#ef4444',
    fact: 'Europe’s largest bivalve; anchoring and disease have devastated Adriatic populations.',
  },
  'spider-crab': {
    id: 'spider-crab',
    nickname: 'Spider Crab',
    scientificName: 'Maja squinado',
    emoji: '🦀',
    status: 'Vulnerable',
    statusColor: '#f97316',
    fact: 'Long-legged reef crab; trawling and habitat loss threaten rocky-bottom communities.',
  },
  'dusky-grouper': {
    id: 'dusky-grouper',
    nickname: 'Dusky Grouper',
    scientificName: 'Epinephelus marginatus',
    emoji: '🐟',
    status: 'Endangered',
    statusColor: '#ef4444',
    fact: 'Slow-growing reef sentinel; overfishing has collapsed stocks across the northern Adriatic.',
  },
  seahorse: {
    id: 'seahorse',
    nickname: 'Seahorse',
    scientificName: 'Hippocampus hippocampus',
    emoji: '🐴',
    status: 'Data Deficient',
    statusColor: '#a78bfa',
    fact: 'Seagrass dweller highly sensitive to anchor damage and coastal sedimentation.',
  },
  posidonia: {
    id: 'posidonia',
    nickname: 'Posidonia',
    scientificName: 'Posidonia oceanica',
    emoji: '🌿',
    status: 'Protected',
    statusColor: '#22c55e',
    fact: 'Mediterranean seagrass meadow builder — one anchor scar can take decades to recover.',
  },
  'loggerhead-turtle': {
    id: 'loggerhead-turtle',
    nickname: 'Loggerhead Turtle',
    scientificName: 'Caretta caretta',
    emoji: '🐢',
    status: 'Vulnerable',
    statusColor: '#f97316',
    fact: 'Nests on Slovenian beaches; boat strikes and entanglement are leading threats.',
  },
  'date-mussel': {
    id: 'date-mussel',
    nickname: 'Date Mussel',
    scientificName: 'Lithophaga lithophaga',
    emoji: '🦪',
    status: 'Protected',
    statusColor: '#22c55e',
    fact: 'Bores into limestone reefs; harvest and anchoring are strictly prohibited in EU waters.',
  },
  'common-dolphin': {
    id: 'common-dolphin',
    nickname: 'Common Dolphin',
    scientificName: 'Delphinus delphis',
    emoji: '🐬',
    status: 'Least Concern',
    statusColor: '#38bdf8',
    fact: 'Regular visitor to the Gulf of Piran; noise and speed limits protect feeding pods.',
  },
};

export function getSpecies(id) {
  return speciesCatalog[id] ?? null;
}

export function getSpeciesList(ids = []) {
  return ids.map((id) => getSpecies(id)).filter(Boolean);
}
