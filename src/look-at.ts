import { CriticalSpring } from "./spring";

export interface LookAtOptions {
	maxYaw?: number;
	maxPitch?: number;
	minPitch?: number;
	// targets further round than this are dropped and the joints ease back to neutral
	releaseYaw?: number;
	frequency?: number;
}

// Yaw/pitch toward a target measured in a reference frame (usually the character root), clamped,
// smoothed, and split across a chain of joints by weight (e.g. waist 0.3, neck 0.7).
export class LookAt {
	private readonly weights: number[] = [];
	private readonly yaw: CriticalSpring;
	private readonly pitch: CriticalSpring;
	private readonly maxYaw: number;
	private readonly maxPitch: number;
	private readonly minPitch: number;
	private readonly releaseYaw: number;

	public constructor(weights: ReadonlyArray<number>, options: LookAtOptions = {}) {
		let total = 0;
		for (const weight of weights) {
			total += weight;
		}
		if (total <= 0) {
			throw "LookAt needs at least one positive joint weight";
		}
		for (const weight of weights) {
			this.weights.push(weight / total);
		}

		this.maxYaw = options.maxYaw ?? math.rad(70);
		this.maxPitch = options.maxPitch ?? math.rad(40);
		this.minPitch = options.minPitch ?? math.rad(-40);
		this.releaseYaw = options.releaseYaw ?? math.pi;
		const frequency = options.frequency ?? 12;
		this.yaw = new CriticalSpring(frequency);
		this.pitch = new CriticalSpring(frequency);
	}

	public update(reference: CFrame, target: Vector3 | undefined, dt: number): void {
		let yaw = 0;
		let pitch = 0;
		if (target) {
			const direction = reference.VectorToObjectSpace(target.sub(reference.Position));
			const flat = math.sqrt(direction.X ** 2 + direction.Z ** 2);
			const targetYaw = math.atan2(-direction.X, -direction.Z);
			if (math.abs(targetYaw) <= this.releaseYaw) {
				yaw = math.clamp(targetYaw, -this.maxYaw, this.maxYaw);
				pitch = math.clamp(math.atan2(direction.Y, flat), this.minPitch, this.maxPitch);
			}
		}
		this.yaw.update(yaw, dt);
		this.pitch.update(pitch, dt);
	}

	public getYaw(): number {
		return this.yaw.position;
	}

	public getPitch(): number {
		return this.pitch.position;
	}

	public getJointCount(): number {
		return this.weights.size();
	}

	// this joint's share of the look, as a rotation in the reference frame
	public getJointRotation(index: number): CFrame {
		const weight = this.weights[index];
		return CFrame.Angles(0, this.yaw.position * weight, 0).mul(CFrame.Angles(this.pitch.position * weight, 0, 0));
	}

	public reset(): void {
		this.yaw.reset();
		this.pitch.reset();
	}
}
