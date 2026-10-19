import { Raycaster } from "./raycaster";
import { clampDirection } from "./rotation";

export interface FootPlanterOptions {
	// ankle joint height above the sole
	footHeight: number;
	castAbove?: number;
	castBelow?: number;
	maxHipDrop?: number;
	// animated foot height (above its standing height) at which planting has fully faded out
	liftHeight?: number;
	maxFootAngle?: number;
	sharpness?: number;
}

export interface FootPlant {
	readonly target: Vector3;
	readonly normal: Vector3;
	readonly weight: number;
	readonly grounded: boolean;
}

class FootState implements FootPlant {
	public target = Vector3.zero;
	public normal = Vector3.yAxis;
	public weight = 0;
	public grounded = false;
	public offset = 0;

	public constructor(public readonly restHeight: number) {}
}

// Works out where each foot should go on uneven ground and how far the hips must sink to let the
// lowest planted foot reach. Pure: feed it animated ankle positions, read targets back.
export class FootPlanter {
	private readonly feet: FootState[] = [];
	private readonly footHeight: number;
	private readonly castAbove: number;
	private readonly castBelow: number;
	private readonly maxHipDrop: number;
	private readonly liftHeight: number;
	private readonly maxFootAngle: number;
	private readonly sharpness: number;
	private hipOffset = 0;
	private settled = false;

	// restAnkleHeights: each ankle's height relative to the root when standing on flat ground
	public constructor(
		private readonly raycaster: Raycaster,
		restAnkleHeights: ReadonlyArray<number>,
		options: FootPlanterOptions,
	) {
		for (const height of restAnkleHeights) {
			this.feet.push(new FootState(height));
		}
		this.footHeight = options.footHeight;
		this.castAbove = options.castAbove ?? 1.5;
		this.castBelow = options.castBelow ?? 1.5;
		this.maxHipDrop = options.maxHipDrop ?? 1.2;
		this.liftHeight = options.liftHeight ?? 0.5;
		this.maxFootAngle = options.maxFootAngle ?? math.rad(35);
		this.sharpness = options.sharpness ?? 20;
	}

	public update(root: CFrame, ankles: ReadonlyArray<Vector3>, dt: number): void {
		const up = root.UpVector;
		const rootHeight = root.Position.Dot(up);
		const blend = this.settled ? 1 - math.exp(-this.sharpness * dt) : 1;
		const castLength = this.castAbove + this.castBelow + this.footHeight;
		let lowest = 0;

		for (let index = 0; index < this.feet.size(); index++) {
			const foot = this.feet[index];
			const ankle = ankles[index];
			const ankleHeight = ankle.Dot(up);
			const lift = math.max(ankleHeight - rootHeight - foot.restHeight, 0);
			const hit = this.raycaster(ankle.add(up.mul(this.castAbove)), up.mul(-castLength));

			let offset = 0;
			let weight = 0;
			let normal = up;
			if (hit) {
				// keep the animation's lift but measure it from the ground under this foot
				offset = hit.Position.Dot(up) + this.footHeight + lift - ankleHeight;
				weight = 1 - math.clamp(lift / this.liftHeight, 0, 1);
				normal = clampDirection(hit.Normal, up, this.maxFootAngle);
			}

			foot.grounded = hit !== undefined;
			foot.offset += (offset - foot.offset) * blend;
			foot.weight += (weight - foot.weight) * blend;
			foot.normal = foot.normal.Lerp(normal, blend).Unit;
			foot.target = ankle.add(up.mul(foot.offset));
			lowest = math.min(lowest, foot.offset * foot.weight);
		}

		this.hipOffset += (math.max(lowest, -this.maxHipDrop) - this.hipOffset) * blend;
		this.settled = true;
	}

	public getFoot(index: number): FootPlant {
		return this.feet[index];
	}

	public getFootCount(): number {
		return this.feet.size();
	}

	// along the root's up vector; zero or negative
	public getHipOffset(): number {
		return this.hipOffset;
	}

	// snaps instead of smoothing on the next update, e.g. after a teleport
	public reset(): void {
		this.settled = false;
	}
}
