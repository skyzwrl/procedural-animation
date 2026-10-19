import { rotationBetween, signedAngle } from "./rotation";
import { solveTwoBone, TwoBoneSolution } from "./two-bone-ik";

export interface LimbPose {
	rootTransform: CFrame;
	middleTransform: CFrame;
	reached: boolean;
}

const EPSILON = 1e-6;

function blend(current: CFrame, target: CFrame, weight: number): CFrame {
	if (weight >= 1) {
		return target;
	}
	return weight <= 0 ? current : current.Lerp(target, weight);
}

// Two-bone IK over a Motor6D chain (hip -> knee -> ankle, shoulder -> elbow -> wrist). Writes
// Motor6D.Transform, so run it after animations have been applied, e.g. in RunService.PreSimulation.
export class LimbIK {
	private upperToMiddle = CFrame.identity;
	private middleToEnd = CFrame.identity;
	private restKnee = Vector3.yAxis;
	private restEnd = Vector3.yAxis;
	private upperLength = 0;
	private lowerLength = 0;
	private hingeInUpper = Vector3.xAxis;
	private readonly solution: TwoBoneSolution = {
		joint: Vector3.zero,
		end: Vector3.zero,
		bendNormal: Vector3.xAxis,
		reached: false,
	};

	// hingeAxis is the axis the middle joint bends around in its own joint frame; X for R15 knees and elbows
	public constructor(
		public readonly rootJoint: Motor6D,
		public readonly middleJoint: Motor6D,
		public readonly endJoint: Motor6D,
		private readonly hingeAxis = Vector3.xAxis,
	) {
		this.refresh();
	}

	// call again if the rig is rescaled or its C0/C1 change
	public refresh(): void {
		this.upperToMiddle = this.rootJoint.C1.Inverse().mul(this.middleJoint.C0);
		this.middleToEnd = this.middleJoint.C1.Inverse().mul(this.endJoint.C0);
		this.upperLength = this.upperToMiddle.Position.Magnitude;
		this.lowerLength = this.middleToEnd.Position.Magnitude;
		this.restKnee = this.upperToMiddle.Position.Unit;
		this.restEnd = this.middleToEnd.Position.Unit;
		this.hingeInUpper = this.upperToMiddle.VectorToWorldSpace(this.hingeAxis);
	}

	public getReach(): number {
		return this.upperLength + this.lowerLength;
	}

	public getRootPosition(parentCFrame = this.getParentCFrame()): Vector3 {
		return parentCFrame.mul(this.rootJoint.C0).Position;
	}

	public solve(target: Vector3, pole: Vector3, parentCFrame = this.getParentCFrame()): LimbPose {
		const rootFrame = parentCFrame.mul(this.rootJoint.C0);
		const root = rootFrame.Position;
		const solution = solveTwoBone(root, target, pole, this.upperLength, this.lowerLength, this.solution);

		const kneeDirection = rootFrame.VectorToObjectSpace(solution.joint.sub(root)).Unit;
		let upper = rotationBetween(this.restKnee, kneeDirection);

		// aiming alone leaves the bone's twist arbitrary; roll it so the middle joint's hinge lies on the
		// limb plane normal, picking whichever side of the normal needs the smaller roll
		const hinge = upper.VectorToWorldSpace(this.hingeInUpper);
		const hingeOnPlane = hinge.sub(kneeDirection.mul(hinge.Dot(kneeDirection)));
		if (hingeOnPlane.Magnitude > EPSILON) {
			const normal = rootFrame.VectorToObjectSpace(solution.bendNormal);
			const wanted = hingeOnPlane.Dot(normal) >= 0 ? normal : normal.mul(-1);
			const roll = signedAngle(hingeOnPlane.Unit, wanted, kneeDirection);
			upper = CFrame.fromAxisAngle(kneeDirection, roll).mul(upper);
		}

		const middleFrame = rootFrame.mul(upper).mul(this.upperToMiddle);
		const endDirection = middleFrame.VectorToObjectSpace(solution.end.sub(solution.joint)).Unit;

		return {
			rootTransform: upper,
			middleTransform: rotationBetween(this.restEnd, endDirection),
			reached: solution.reached,
		};
	}

	// weight blends against whatever Transform the joints already hold (normally this frame's animation)
	public apply(target: Vector3, pole: Vector3, weight = 1, parentCFrame = this.getParentCFrame()): boolean {
		const pose = this.solve(target, pole, parentCFrame);
		this.rootJoint.Transform = blend(this.rootJoint.Transform, pose.rootTransform, weight);
		this.middleJoint.Transform = blend(this.middleJoint.Transform, pose.middleTransform, weight);
		return pose.reached;
	}

	// forward kinematics from the current transforms, so callers never wait on the engine to move parts
	public getLowerCFrame(parentCFrame = this.getParentCFrame()): CFrame {
		const root = this.rootJoint;
		const middle = this.middleJoint;
		return parentCFrame
			.mul(root.C0)
			.mul(root.Transform)
			.mul(root.C1.Inverse())
			.mul(middle.C0)
			.mul(middle.Transform)
			.mul(middle.C1.Inverse());
	}

	public getEndPosition(parentCFrame = this.getParentCFrame()): Vector3 {
		return this.getLowerCFrame(parentCFrame).mul(this.endJoint.C0).Position;
	}

	private getParentCFrame(): CFrame {
		const part0 = this.rootJoint.Part0;
		if (!part0) {
			throw `${this.rootJoint.GetFullName()} has no Part0`;
		}
		return part0.CFrame;
	}
}
