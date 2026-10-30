import { LINES, ui } from './i18n.js';
import { Character } from './character.js';
import { Driver } from './npc.js';
import { CITIES, HIGHWAYS } from './world.js';

const KEY = 'fta1_progress';
const PORTO = CITIES[0];

export class Missions {
  constructor(g) {
    this.g = g;
    try { this.stage = +(localStorage.getItem(KEY) || 0); } catch (e) { this.stage = 0; }
  }
  save(n) { this.stage = n; try { localStorage.setItem(KEY, String(n)); } catch (e) { /* ignora */ } }
  t(k, v) { return ui(k, this.g.settings.get('lang'), v); }

  async start(fresh) {
    if (fresh) this.save(0);
    const g = this.g;
    if (this.stage < 1) { await this.intro(); await this.retry(() => this.ride()); this.save(1); await this.arrival(); }
    else this.setupGarage(true);
    if (this.stage < 2) { await this.retry(() => this.race()); this.save(2); }
    this.freeRoam();
    g.hud.objective(this.t('freeRoam'));
  }

  async retry(fn) {
    const g = this.g;
    for (;;) {
      g.token = {};
      try { await fn(g.token); g.clearMission(); return; }
      catch (e) {
        if (e !== 'fail') throw e;
        g.clearMission();
        g.hud.timer(null);
        g.audio.failed();
        g.hud.big(this.t('missionFailed'), this.t(g.failReason), 4000, 'fail');
        await g.wait(4);
      }
    }
  }

  // ------------------------------------------------ abertura
  async intro() {
    const g = this.g, L = LINES;
    g.env.time = 17.1;
    g.lock(true);
    g.hud.letterbox(true);
    g.placePlayer(389.3, 645, -Math.PI / 2);
    const taxi = g.spawnVehicle('taxi', 0xf2c014, 383.3, 651, Math.PI);
    taxi.locked = true; taxi.driver = 'ai';
    const tc = new Character({ skin: 0xe0ac69, shirt: 0xe8d5b0, pants: 0x5a4632, hair: 0x5a3a1e, scale: 1.05 });
    taxi.setRider(tc); tc.animate(0, 0, 'drive');
    this.bike = g.spawnVehicle('bike', 0xd7263d, 386.6, 634, Math.PI);
    g.cineTitle('FTA 1', 'Porto Sereno · 1993');
    await g.cineTo([1380, 150, 1000], [780, 70, 640], [800, 40, 520], [560, 10, 560], 7);
    g.cineTitle(null);
    await g.cineTo([470, 70, 720], [399, 3.2, 655], [389, 0, 645], [387, 4.2, 646], 4);
    g.cineSet([396, 5.1, 655], [386.5, 4.4, 645.5]);
    await g.say('leo', L.intro1, g.player.char);
    g.cineSet([388.5, 5, 643], [383, 4.2, 651]);
    await g.say('taxi', L.intro2, tc);
    g.cineSet([384.5, 5.1, 655], [389.3, 4.5, 645]);
    await g.say('leo', L.intro3, g.player.char);
    await g.say('taxi', L.intro4, tc);
    taxi.ai = new Driver(taxi, { city: PORTO, cur: [1, 5], prev: [1, 6], cruise: 12 });
    taxi.ai.route.push({ x: 383.3, z: 600 });
    taxi.traffic = true;
    g.traffic.cars.push(taxi);
    // o Duda chega de bicicleta
    const duda = (this.duda = new Character({ skin: 0x5c3a1e, shirt: 0x2f6b3a, pants: 0x1b1b1b, cap: 0x2f6b3a, hair: 0x111111, scale: 0.95 }));
    const db = (this.dbike = g.spawnVehicle('bike', 0x2a8fbd, 376.7, 575, 0));
    db.locked = true; db.driver = 'ai'; db.setRider(duda);
    db.ai = new Driver(db, { path: [[376.7, 637]], cruise: 7.5 });
    g.cineSet([382, 4.6, 620], [377, 3.8, 600]);
    const t0 = g.simTime;
    await g.until(() => db.ai.done || g.simTime - t0 > 12);
    g.cineSet([393.5, 5, 641], [380, 4.1, 640]);
    await g.say('duda', L.duda1, duda);
    await g.say('leo', L.leo1, g.player.char);
    await g.say('duda', L.duda2, duda);
    g.cine = null;
    g.hud.letterbox(false);
    g.lock(false);
    g.camYawTo(Math.PI);
  }

  async ride(token) {
    const g = this.g, L = LINES, db = this.dbike, bike = this.bike, of = g.world.oficina;
    if (g.player.vehicle !== bike) {
      if (g.player.vehicle) g.exitVehicle(true);
      if (bike.pos.distanceTo(g.player.pos) > 30 || bike.health <= 0) {
        bike.pos.set(386.6, 3, 634); bike.heading = Math.PI; bike.vel.set(0, 0, 0); bike.health = 1000;
        g.placePlayer(389.3, 640, Math.PI);
      }
    }
    db.pos.set(376.7, 3, 637); db.heading = 0; db.vel.set(0, 0, 0); db.ai = null;
    g.addBlip({ id: 'bike', x: bike.pos.x, z: bike.pos.z, color: '#5fa8ff', follow: bike });
    g.hud.objective(this.t('objBike'));
    await g.until(() => g.player.vehicle === bike);
    g.removeBlip('bike');
    g.addBlip({ id: 'duda', color: '#5fa8ff', follow: db });
    g.hud.objective(this.t('objFollow'));
    db.ai = new Driver(db, {
      path: [[376.7, 758], [392, 773.3], [560, 773.3], [of.x - 12, 773.3], [of.x - 2, 784]], cruise: 8.8,
      waitFor: () => { const d = db.pos.distanceTo(g.player.pos); return d > 32 ? 0.01 : d > 20 ? 4 : 0; },
    });
    (async () => {
      await g.wait(5); if (token !== g.token) return;
      await g.say('duda', L.ride1, this.duda); if (token !== g.token) return;
      await g.wait(3); if (token !== g.token) return;
      await g.say('duda', L.ride2, this.duda); if (token !== g.token) return;
      await g.say('leo', L.ride3, g.player.char); if (token !== g.token) return;
      await g.wait(4); if (token !== g.token) return;
      await g.say('duda', L.ride4, this.duda);
    })();
    let warned = 0;
    await g.until(
      () => db.ai.done && g.player.pos.distanceTo(db.pos) < 16,
      () => {
        const d = db.pos.distanceTo(g.player.pos);
        if (d > 70 && g.simTime - warned > 8) { warned = g.simTime; g.hud.hint(this.t('losing'), 3000); g.say('duda', L.dudaFar, this.duda, { ambient: true }); }
        return d > 200 ? 'lostDuda' : null;
      },
    );
    g.money += 100;
    g.audio.passed();
    g.hud.big(this.t('missionPassed'), `$100 · ${this.t('respect')}`, 4500);
  }

  setupGarage(cont) {
    const g = this.g, of = g.world.oficina;
    if (!this.faisca) {
      this.faisca = g.spawnVehicle('sport', 0xb3201c, of.carX, of.carZ, Math.PI);
      this.faisca.locked = this.stage < 2 && !cont;
    }
    if (!this.nando) {
      this.nando = g.addActor(new Character({ skin: 0x8d5524, shirt: 0x7a7a7a, pants: 0x2b3a67, hair: 0x9a9a9a, sleeves: true, scale: 1.05 }), of.x + 6, of.carZ - 2, Math.PI);
    }
    if (cont) g.placePlayer(of.x - 4, of.z + 6, Math.PI);
  }

  async arrival() {
    const g = this.g, L = LINES, of = g.world.oficina;
    this.setupGarage(false);
    if (g.player.vehicle) g.exitVehicle(true);
    g.lock(true);
    g.hud.letterbox(true);
    g.placePlayer(of.x - 2, of.carZ - 6, Math.PI / 2 + 0.3);
    this.dbike.pos.set(of.x - 9, 3, of.carZ - 7);
    this.dbike.vel.set(0, 0, 0);
    g.cineSet([of.x - 6, of.y0 + 2.4, of.carZ - 13], [of.x + 3, of.y0 + 1.5, of.carZ - 1]);
    await g.say('nando', L.arrive1, this.nando.ch);
    g.cineSet([of.x + 6, of.y0 + 2.2, of.carZ - 9], [of.x - 2, of.y0 + 1.6, of.carZ - 6]);
    await g.say('leo', L.arrive2, g.player.char);
    g.cineSet([of.x - 7, of.y0 + 1.8, of.carZ + 4], [of.x, of.y0 + 0.8, of.carZ]);
    await g.say('nando', L.arrive3, this.nando.ch);
    await g.say('duda', L.arrive4, this.duda);
    g.cineSet([of.x - 3, of.y0 + 2, of.carZ - 9], [of.x - 2, of.y0 + 1.6, of.carZ - 6]);
    await g.say('leo', L.arrive5, g.player.char);
    g.cine = null;
    g.hud.letterbox(false);
    g.lock(false);
  }

  async race() {
    const g = this.g, car = this.faisca, of = g.world.oficina;
    if (car.health <= 0 || car.pos.distanceTo(g.player.pos) > 200) {
      car.health = 1000; car.pos.set(of.carX, 3, of.carZ); car.heading = Math.PI; car.vel.set(0, 0, 0); car.yawRate = 0;
    }
    if (g.player.vehicle && g.player.vehicle !== car) g.exitVehicle(true);
    car.locked = false;
    g.addBlip({ id: 'car', color: '#5fa8ff', follow: car });
    g.hud.objective(this.t('objCar'));
    await g.until(() => g.player.vehicle === car);
    g.removeBlip('car');
    const H = HIGHWAYS[0];
    const hp = (t) => { const k = Math.floor(H.N * t); return [H.px[k], H.pz[k]]; };
    const cps = [[560, 770], [380, 770], [380, 590], [290, 500], hp(0.3), hp(0.6), hp(0.85), [-490, 640], [-574, 608], [-658, 608]];
    g.hud.objective(this.t('objRace'));
    let left = 150;
    g.say('duda', { pt: 'Vai, Léo! Acelera!', en: 'Go, Leo! Floor it!' }, this.duda, { ambient: true });
    for (let i = 0; i < cps.length; i++) {
      const [x, z] = cps[i];
      const last = i === cps.length - 1;
      const mk = g.addMarker(x, z, last ? 0xffd23f : 0xff3030, 9);
      g.addBlip({ id: 'cp', x, z, color: last ? '#f0c419' : '#ff4040' });
      if (cps[i + 1]) g.addBlip({ id: 'cp2', x: cps[i + 1][0], z: cps[i + 1][1], color: '#7a1a1a', r: 6 });
      let tPrev = g.simTime;
      await g.until(
        () => Math.hypot(g.focus.x - x, g.focus.z - z) < 11,
        () => {
          left -= g.simTime - tPrev; tPrev = g.simTime;
          g.hud.timer(left);
          if (left <= 0) return 'timeUp';
          if (car.health <= 0) return 'carWrecked';
          return null;
        },
      );
      g.removeMarker(mk); g.removeBlip('cp'); g.removeBlip('cp2');
      g.audio.checkpoint();
      left += 4;
    }
    g.hud.timer(null);
    g.money += 500;
    g.audio.passed();
    g.hud.big(this.t('missionPassed'), `$500 · ${this.t('respect')}`, 5000);
    g.say('leo', LINES.raceWin, g.player.char);
  }

  freeRoam() {
    const g = this.g, of = g.world.oficina;
    g.addBlip({ id: 'garage', x: of.x, z: of.z, color: '#f0c419', shape: 'sq', label: 'O', keep: true });
  }
}
