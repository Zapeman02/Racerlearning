# Racerlearning – game idea

## Concept
A mobile game where you train your own AI driver with reinforcement learning and race it against a pre-trained base model that ships with the app.
The player never drives. **The whole game is reward design**: tweak sliders for what gives positive/negative reward, hit train, watch the car learn.

## Game loop
1. **Garage** – pick a starting point: train from scratch, or start from a copy of the base model.
2. **Reward sliders** – e.g.:
   - Progress along track (checkpoints) `+`
   - Speed `+`
   - Crash / leaving track `-`
   - Time per lap `-`
   - Jerky steering `-`
   - Standing still `-`
3. **Training** – runs on the fixed training track. Watch cars learn live (sped up), with a simple graph of reward/lap time per generation.
4. **Race** – when happy, generate a new random track and race against the base model. Your model has never seen the track, so generalization is what matters.
5. **Save tracks** – save a generated track you like (stored as a seed).

## Technical core

### The car's "brain"
- Input: ~5–7 distance rays to the track edge + speed (+ angle to next checkpoint).
- Network: small MLP, e.g. 8 → 16 → 16 → 2 (steer, throttle). A few hundred weights.
- Small enough that training and inference run easily on an iPhone, no GPU needed.

### Training method
| Method | Pros | Cons |
|---|---|---|
| **Neuroevolution** (genetic algorithm, many cars at once) | Simple, stable, very visual (30 cars learning at the same time), fast on mobile | Not "real" gradient-based RL |
| **PPO / REINFORCE** | Real RL | More code, slower and less stable convergence, one car at a time is less fun to watch |

**Recommendation:** start with neuroevolution. Your reward sliders become the fitness function, so the game idea works the same. PPO can be added later as "advanced mode".

### Base model
- Trained offline on a computer (Python or the same code in Node) with good reward settings over many generations and many tracks.
- Exported as JSON with the weights (a few KB), bundled with the app.
- Used as (a) the opponent and (b) the optional starting point for the player's model (copy weights → mutate onward).

### Track generation
- Random points around a center → sort by angle → smooth closed spline → road with fixed width.
- Checkpoints sampled along the spline (used for both reward and lap timing).
- A track = a seed + parameters, so saving is trivial.

### Physics
- Simple 2D top-down car physics (velocity, steering angle, friction). No physics engine needed.
- Fixed timestep so training is deterministic and can run faster than real time (no rendering during fast-forward).

## UI: HTML or Swift?

| | HTML/TS + Canvas | Swift + SpriteKit |
|---|---|---|
| Iteration speed | Very fast, test in browser | Slower, Xcode + simulator |
| Runs on iPhone | Yes, via Safari / add to home screen. Can be wrapped as a real app later | Native |
| Performance | Plenty for this scale | Best |
| Training offline + in app | Same code in Node and browser | Need to duplicate logic in Python/Swift |
| App Store | Needs a wrapper | Direct |

**Recommendation:** HTML/TypeScript + Canvas for the first version. The model is so small that performance isn't an issue, and the same simulation code can train the base model in Node. If the game feels good, either wrap it or port it to Swift later; the logic is small.

## First draft (MVP)
1. One fixed training track, a car, ray sensors, physics.
2. MLP + neuroevolution with 3 sliders (progress, crash, speed).
3. Train button + fast-forward + generation counter.
4. Track generator + race vs a hard-coded base model.
5. Save model + tracks to localStorage.
6. Export/import model as a `.json` file (backup, move between devices, share).

Skip in v1: PPO, Web Workers, multiple car types, online leaderboards, saving multiple models.

## Decisions
- **Pure web game**, no server. Simulation, training and rendering run in the browser (desktop + iPhone). Static hosting (e.g. GitHub Pages).
- **Neuroevolution** for training.
- Base model trained with the same TS code in Node, shipped as JSON.
- **Saving:** a model = weights + the slider values it was trained with (a few KB JSON). Stored in localStorage, plus export/import to file because Safari may wipe localStorage after 7 days of non-use (unless added to home screen). A track = seed + params.
- **Performance:** CPU-bound, not RAM. Later: spread cars over cores with Web Workers.

## Open questions
- Should training also happen in the background, or only while the app is open?
- Which slider values count as cheating? (e.g. can you only win with exactly one setting?)
