// Finds the nearest usable interactable in front of the player and shows the prompt.
import { G } from '../core/context.js';
import { angleDiff } from '../core/utils.js';

export class Interact {
  constructor() { this.current = null; }
  update() {
    const P = G.player;
    if (G.ui.blocksGameplay() || P.dead || P.busy()) { this.current = null; G.ui.showPrompt(null); return; }
    let best = null, bs = Infinity;
    for (const it of G.world.interactables) {
      const p = it.pos ? it.pos() : it;
      const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
      if (Math.abs(dx) > it.r + 1 || Math.abs(dz) > it.r + 1) continue;
      const d = Math.hypot(dx, dz);
      if (d > it.r || Math.abs((p.y || 0) - P.pos.y) > 3.5) continue;
      if (!it.can()) continue;
      const facing = Math.abs(angleDiff(P.yaw, Math.atan2(dx, dz)));
      const score = d + facing * 0.8;
      if (score < bs) { bs = score; best = it; }
    }
    this.current = best;
    G.ui.showPrompt(best ? best.label() : null);
    if (best && G.input.consume('interact')) best.act();
  }
}
