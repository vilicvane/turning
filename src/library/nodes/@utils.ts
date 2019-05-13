let lastNodeId = 0;

export function generateNodeId(): number {
  return ++lastNodeId;
}
