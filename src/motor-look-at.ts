import { LookAt, LookAtOptions } from "./look-at";

// Drives a LookAt through Motor6Ds (R15: Waist then Neck). Rotates C0 from its rest value instead of
// touching Transform, so it layers on top of animations and never accumulates when nothing animates.
export class MotorLookAt {
	public readonly look: LookAt;
	private readonly restC0: CFrame[] = [];

	public constructor(
		private readonly motors: ReadonlyArray<Motor6D>,
		weights: ReadonlyArray<number>,
		options?: LookAtOptions,
	) {
		if (motors.size() !== weights.size()) {
			throw "MotorLookAt needs one weight per motor";
		}
		this.look = new LookAt(weights, options);
		for (const motor of motors) {
			this.restC0.push(motor.C0);
		}
	}

	public update(reference: CFrame, target: Vector3 | undefined, dt: number): void {
		this.look.update(reference, target, dt);

		const referenceRotation = reference.Rotation;
		for (let index = 0; index < this.motors.size(); index++) {
			const motor = this.motors[index];
			const parent = motor.Part0;
			if (!parent) {
				continue;
			}
			// the joint's share as a world rotation, then re-expressed in Part0's space so it pivots about the joint
			const world = referenceRotation.mul(this.look.getJointRotation(index)).mul(referenceRotation.Inverse());
			const parentRotation = parent.CFrame.Rotation;
			const rest = this.restC0[index];
			motor.C0 = new CFrame(rest.Position)
				.mul(parentRotation.Inverse())
				.mul(world)
				.mul(parentRotation)
				.mul(rest.Rotation);
		}
	}

	public destroy(): void {
		for (let index = 0; index < this.motors.size(); index++) {
			this.motors[index].C0 = this.restC0[index];
		}
	}
}
