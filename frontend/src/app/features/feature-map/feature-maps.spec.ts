import { NAV_GROUPS } from '../../layout/nav-items';
import { FEATURE_MAPS, featureMapOf, layoutOf } from './feature-maps';

const MENU_PATHS = new Set(NAV_GROUPS.flatMap((g) => g.links.map((l) => l.path)));
// Pages a sơ đồ may point to that are not in the menu (opened from inside another page).
const EXTRA_PATHS = new Set(['/ke-toan/but-toan']);

describe('Sơ đồ phân hệ', () => {
  it('has a map for every group whose name opens one, under the same key as its menu hub', () => {
    const hubs = NAV_GROUPS.filter((g) => g.hub).map((g) => g.hub);
    expect(hubs.length).toBeGreaterThan(0);
    for (const hub of hubs) expect(featureMapOf(hub!.replace('/so-do/', ''))).toBeDefined();
    expect(FEATURE_MAPS.map((m) => `/so-do/${m.key}`).sort()).toEqual([...hubs].sort());
  });

  for (const m of FEATURE_MAPS) {
    describe(m.title, () => {
      it('every box leads to a page of the menu, and no two boxes share a place', () => {
        const places = new Set<string>();
        for (const n of m.nodes) {
          expect(MENU_PATHS.has(n.path) || EXTRA_PATHS.has(n.path), `${n.id} → ${n.path}`).toBe(true);
          expect(n.stage).toBeGreaterThanOrEqual(0);
          expect(n.stage).toBeLessThan(m.stages.length);
          const at = `${n.stage}/${n.lane}`;
          expect(places.has(at), `${n.id} sits on ${at}`).toBe(false);
          places.add(at);
        }
      });

      it('every arrow joins two boxes of the map and never runs from right to left', () => {
        const byId = new Map(m.nodes.map((n) => [n.id, n]));
        expect(byId.size).toBe(m.nodes.length);
        for (const e of m.edges) {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          expect(a && b, `${e.from} → ${e.to}`).toBeTruthy();
          expect(b!.stage, `${e.from} → ${e.to}`).toBeGreaterThanOrEqual(a!.stage);
        }
      });

      it('lays out inside its frame', () => {
        const l = layoutOf(m);
        expect(l.nodes).toHaveLength(m.nodes.length);
        expect(l.edges).toHaveLength(m.edges.length);
        for (const n of l.nodes) {
          expect(n.x).toBeGreaterThanOrEqual(0);
          expect(n.y).toBeGreaterThanOrEqual(0);
          expect(n.x).toBeLessThan(l.width);
          expect(n.y).toBeLessThan(l.height);
        }
      });
    });
  }
});
