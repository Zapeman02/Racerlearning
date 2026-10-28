import type { ModelRecord } from '../data/models.ts';
import { isTrained } from '../data/models.ts';
import { Race } from '../race/race.ts';
import type { CarView } from '../render/renderer.ts';
import type { Track } from '../sim/track.ts';
import { Stepper } from '../core/stepper.ts';

/** Endless background drive used behind menus. */
export class DemoDrive {
  race: Race;
  private readonly stepper = new Stepper();
  private readonly track: Track;
  private readonly models: ModelRecord[];

  constructor(track: Track, models: ModelRecord[]) {
    this.track = track;
    this.models = models.filter(isTrained).slice(0, 4);
    this.race = this.newRace();
  }

  update(dt: number): void {
    this.stepper.advance(dt, () => this.race.tick());
    if (this.race.phase === 'finished') this.race = this.newRace();
  }

  get cars(): CarView[] {
    return this.race.racers.map((r) => ({ car: r.agent.car, paint: r.entry }));
  }

  get leader() {
    return this.race.standings()[0].agent.car;
  }

  private newRace(): Race {
    const race = new Race(
      this.track,
      this.models.map((m) => ({ id: m.id, name: m.name, color: m.color, accent: m.accent, livery: m.livery, weights: m.weights! })),
      50,
    );
    race.countdown = 0;
    return race;
  }
}
