import { perpendicular } from "./rotation";

export interface TwoBoneSolution {
	joint: Vector3;
	end: Vector3;
	bendNormal: Vector3;
	reached: boolean;
}

const EPSILON = 1e-6;

export function solveTwoBone(
	root: Vector3,
	target: Vector3,
	pole: Vector3,
	upperLength: number,
	lowerLength: number,
	out?: TwoBoneSolution,
): TwoBoneSolution {
	const toTarget = target.sub(root);
	const distance = toTarget.Magnitude;
	const minReach = math.abs(upperLength - lowerLength);
	const maxReach = upperLength + lowerLength;

	// a target sitting on the root has no direction, hang the limb straight down instead
	const direction = distance > EPSILON ? toTarget.div(distance) : new Vector3(0, -1, 0);

	const toPole = pole.sub(root);
	const bendOffset = toPole.sub(direction.mul(toPole.Dot(direction)));
	const bend = bendOffset.Magnitude > EPSILON ? bendOffset.Unit : perpendicular(direction);

	const reach = math.clamp(distance, minReach, maxReach);

	// law of cosines for the angle between the root->target line and the upper bone
	const cosine =
		reach > EPSILON
			? math.clamp((upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach), -1, 1)
			: 0;
	const sine = math.sqrt(1 - cosine * cosine);

	const solution = out ?? { joint: root, end: root, bendNormal: Vector3.xAxis, reached: false };
	solution.joint = root.add(direction.mul(upperLength * cosine)).add(bend.mul(upperLength * sine));
	solution.end = root.add(direction.mul(reach));
	solution.bendNormal = direction.Cross(bend);
	solution.reached = distance >= minReach - EPSILON && distance <= maxReach + EPSILON;
	return solution;
}

// frame at `from` looking along the bone, right vector on the limb plane normal so the bend is a rotation about X
export function boneFrame(from: Vector3, to: Vector3, bendNormal: Vector3): CFrame {
	const back = from.sub(to).Unit;
	const up = back.Cross(bendNormal);
	return CFrame.fromMatrix(from, bendNormal, up, back);
}
