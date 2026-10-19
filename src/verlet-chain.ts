export interface SphereCollider {
	center: Vector3;
	radius: number;
}

export interface VerletChainOptions {
	gravity?: Vector3;
	// fraction of velocity kept each step
	damping?: number;
	// pull toward the rest shape each step, 0 = rope, closer to 1 = stiff tail
	stiffness?: number;
	iterations?: number;
	timestep?: number;
	maxSteps?: number;
	// direction the chain rests in, in the root's space
	restDirection?: Vector3;
}

// Rope/tail/cape chain: verlet integration on a fixed timestep with distance constraints relaxed a few
// times per step. Point 0 is pinned to the root frame.
export class VerletChain {
	public readonly colliders: SphereCollider[] = [];
	private readonly positions: Vector3[] = [];
	private readonly previous: Vector3[] = [];
	private readonly restOffsets: Vector3[] = [];
	private readonly lengths: number[] = [];
	private readonly gravity: Vector3;
	private readonly damping: number;
	private readonly stiffness: number;
	private readonly iterations: number;
	private readonly timestep: number;
	private readonly maxSteps: number;
	private accumulator = 0;

	public constructor(
		private root: CFrame,
		segmentLengths: ReadonlyArray<number>,
		options: VerletChainOptions = {},
	) {
		if (segmentLengths.size() === 0) {
			throw "VerletChain needs at least one segment";
		}
		this.gravity = options.gravity ?? new Vector3(0, -196.2, 0);
		this.damping = options.damping ?? 0.98;
		this.stiffness = options.stiffness ?? 0;
		this.iterations = options.iterations ?? 8;
		this.timestep = options.timestep ?? 1 / 60;
		this.maxSteps = options.maxSteps ?? 4;

		const direction = (options.restDirection ?? new Vector3(0, -1, 0)).Unit;
		let distance = 0;
		this.restOffsets.push(Vector3.zero);
		for (const length of segmentLengths) {
			distance += length;
			this.lengths.push(length);
			this.restOffsets.push(direction.mul(distance));
		}
		this.reset();
	}

	public setRoot(root: CFrame): void {
		this.root = root;
	}

	public update(dt: number): void {
		this.accumulator = math.min(this.accumulator + dt, this.timestep * this.maxSteps);
		while (this.accumulator >= this.timestep) {
			this.accumulator -= this.timestep;
			this.step();
		}
	}

	public reset(): void {
		for (let index = 0; index < this.restOffsets.size(); index++) {
			const position = this.root.PointToWorldSpace(this.restOffsets[index]);
			this.positions[index] = position;
			this.previous[index] = position;
		}
		this.accumulator = 0;
	}

	public getPoint(index: number): Vector3 {
		return this.positions[index];
	}

	public getPointCount(): number {
		return this.positions.size();
	}

	public getSegmentLength(index: number): number {
		return this.lengths[index];
	}

	// centred on the segment, looking from point index toward index + 1, which is what a Part wants
	public getSegmentCFrame(index: number): CFrame {
		const start = this.positions[index];
		const finish = this.positions[index + 1];
		const direction = finish.sub(start).Unit;
		const up = math.abs(direction.Dot(this.root.UpVector)) < 0.95 ? this.root.UpVector : this.root.LookVector;
		return CFrame.lookAt(start.add(finish).mul(0.5), finish, up);
	}

	private step(): void {
		const positions = this.positions;
		const previous = this.previous;
		const count = positions.size();
		const gravityStep = this.gravity.mul(this.timestep * this.timestep);

		positions[0] = this.root.Position;
		previous[0] = positions[0];

		for (let index = 1; index < count; index++) {
			const current = positions[index];
			let moved = current.add(current.sub(previous[index]).mul(this.damping)).add(gravityStep);
			if (this.stiffness > 0) {
				moved = moved.Lerp(this.root.PointToWorldSpace(this.restOffsets[index]), this.stiffness);
			}
			previous[index] = current;
			positions[index] = moved;
		}

		for (let iteration = 0; iteration < this.iterations; iteration++) {
			for (let index = 0; index < count - 1; index++) {
				this.relaxSegment(index);
			}
			for (const collider of this.colliders) {
				this.pushOut(collider);
			}
		}

		// relaxation converges slowly on long chains under Roblox gravity (a few percent stretch at 8
		// iterations), so finish with one root-outward pass that makes every length exact. colliders still
		// get the last word since a point inside a body is worse than a slightly long segment
		for (let index = 0; index < count - 1; index++) {
			const delta = positions[index + 1].sub(positions[index]);
			const distance = delta.Magnitude;
			if (distance > 1e-9) {
				positions[index + 1] = positions[index].add(delta.mul(this.lengths[index] / distance));
			}
		}
		for (const collider of this.colliders) {
			this.pushOut(collider);
		}
	}

	private relaxSegment(index: number): void {
		const positions = this.positions;
		const a = positions[index];
		const b = positions[index + 1];
		const delta = b.sub(a);
		const distance = delta.Magnitude;
		if (distance < 1e-9) {
			return;
		}

		const correction = delta.mul((distance - this.lengths[index]) / distance);
		if (index === 0) {
			// the root is pinned, so the whole correction goes to its neighbour
			positions[1] = b.sub(correction);
		} else {
			const half = correction.mul(0.5);
			positions[index] = a.add(half);
			positions[index + 1] = b.sub(half);
		}
	}

	private pushOut(collider: SphereCollider): void {
		const positions = this.positions;
		for (let index = 1; index < positions.size(); index++) {
			const offset = positions[index].sub(collider.center);
			const distance = offset.Magnitude;
			if (distance < collider.radius && distance > 1e-9) {
				positions[index] = collider.center.add(offset.mul(collider.radius / distance));
			}
		}
	}
}
