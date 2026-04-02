/**
 * Parse command-line arguments for the building preview tool.
 */
export function parsePreviewArgs(argv) {
  const args = {
    type: 'small',
    shape: 'full',
    seed: 42,
    tiers: 4,
    interiorWalls: false,
    textureSet: 'base',
    debug: false,
    format: 'both',  // 'glb', 'obj', 'both'
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) args.type = argv[++i];
    else if (arg === '--shape' && argv[i + 1]) args.shape = argv[++i];
    else if (arg === '--seed' && argv[i + 1]) args.seed = parseInt(argv[++i]);
    else if (arg === '--tiers' && argv[i + 1]) args.tiers = parseInt(argv[++i]);
    else if (arg === '--interior-walls') args.interiorWalls = true;
    else if (arg === '--format' && argv[i + 1]) args.format = argv[++i];
    else if (arg === '--glb') args.format = 'glb';
    else if (arg === '--obj') args.format = 'obj';
    else if (arg === '--texture-set' && argv[i + 1]) args.textureSet = argv[++i];
    else if (arg === '--debug') args.debug = true;
  }

  return args;
}
