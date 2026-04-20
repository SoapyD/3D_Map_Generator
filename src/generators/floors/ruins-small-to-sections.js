export function ruinsToSections(building) {
  if (building.floorOrientation === 'H') {
    return [
      { x: building.x, z: building.z,                       w: building.w, d: building.d / 2 },
      { x: building.x, z: building.z + building.d / 2,      w: building.w, d: building.d / 2 },
    ];
  }
  return [
    { x: building.x,                       z: building.z, w: building.w / 2, d: building.d },
    { x: building.x + building.w / 2,      z: building.z, w: building.w / 2, d: building.d },
  ];
}
