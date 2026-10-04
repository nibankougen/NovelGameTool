/** 元の配列の挿入境界へ、選択行を元の順序のまままとめて移動する。 */
export function reorderSelection(length: number, selected: ReadonlySet<number>, rawTo: number) {
  const indices = Array.from({ length }, (_, i) => i);
  const moved = indices.filter((i) => selected.has(i));
  const remaining = indices.filter((i) => !selected.has(i));
  const to = indices.filter((i) => i < rawTo && !selected.has(i)).length;
  remaining.splice(to, 0, ...moved);
  return { order: remaining, selected: new Set(moved.map((_, i) => to + i)) };
}
