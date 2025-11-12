export const gradeOptions = [
  { label: '+++', value: 1 },
  { label: '++', value: 2 },
  { label: '+', value: 3 },
  { label: 'o', value: 4 },
  { label: '−', value: 5 },
  { label: '−−', value: 6 }
];

const anchors = [
  1.00, 1.25, 1.50, 1.75, 2.00, 2.25, 2.50, 2.75,
  3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75,
  5.00, 5.25, 5.50, 5.75, 6.00
];

const labels = {
  1.00: '1', 1.25: '1−', 1.50: '1-2', 1.75: '2+', 2.00: '2',
  2.25: '2−', 2.50: '2-3', 2.75: '3+', 3.00: '3',
  3.25: '3−', 3.50: '3-4', 3.75: '4+', 4.00: '4',
  4.25: '4−', 4.50: '4-5', 4.75: '5+', 5.00: '5',
  5.25: '5−', 5.50: '5-6', 5.75: '6+', 6.00: '6'
};

export function roundToLabel(avg) {
  if (avg == null || Number.isNaN(avg)) return '—';
  let closest = anchors[0], minDiff = Infinity;
  for (const a of anchors) {
    const d = Math.abs(avg - a);
    if (d < minDiff) { minDiff = d; closest = a; }
  }
  return labels[closest.toFixed(2)];
}

export function average(values) {
  if (!values || !values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Farbskala: 1..6 -> grün bis rot; 4 oder null -> grau
export function colorForAverage(avg) {
  if (avg == null || Math.round(avg * 100) / 100 === 4.00) {
    return getComputedStyle(document.documentElement).getPropertyValue('--tile-gray') || '#e6e6e6';
  }
  // Map 1..6 to hue 150..0 (green to red)
  const clamped = Math.max(1, Math.min(6, avg));
  const t = (clamped - 1) / 5; // 0..1
  const hue = 150 * (1 - t);    // 150 -> 0
  const light = 60; // percent
  const sat = 60;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
