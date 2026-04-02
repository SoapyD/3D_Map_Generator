export const fileSizeRules = [
  { dir: 'src/core', ext: '.js', limit: 80, area: 'Core utility' },
  { dir: 'src/generators', ext: '.js', limit: 200, area: 'Generator stage' },
  { dir: 'src/export', ext: '.js', limit: 200, area: 'Exporter' },
  { dir: 'src/preview', ext: '.js', limit: 80, area: 'Preview' },
  { dir: 'src/tools', ext: '.js', limit: 150, area: 'Tool' },
  { file: 'src/config.js', limit: 300, area: 'Config' },
  { dir: 'src', ext: '.js', limit: 120, area: 'Root source', shallow: true },
];

export const skipPatterns = [
  '__tests__',
  '.test.',
  '.spec.',
];
