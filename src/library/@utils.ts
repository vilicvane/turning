let lastPathNodeId = 0;

export function generatePathNodeId(): number {
  return ++lastPathNodeId;
}
