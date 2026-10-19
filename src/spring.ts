// Critically damped spring stepped with the exact solution, so the result doesn't depend on frame rate.
export class CriticalSpring {
	public velocity = 0;

	// frequency is the angular frequency in rad/s; higher settles faster
	public constructor(
		public frequency: number,
		public position = 0,
	) {}

	public update(target: number, dt: number): number {
		const omega = this.frequency;
		const offset = this.position - target;
		const decay = math.exp(-omega * dt);
		const drift = (this.velocity + omega * offset) * dt;
		this.position = target + (offset + drift) * decay;
		this.velocity = (this.velocity - omega * drift) * decay;
		return this.position;
	}

	public reset(position = 0): void {
		this.position = position;
		this.velocity = 0;
	}
}
