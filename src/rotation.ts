const PARALLEL_EPSILON = 1e-7;

export function perpendicular(direction: Vector3): Vector3 {
	const hint = math.abs(direction.Y) < 0.9 ? Vector3.yAxis : Vector3.xAxis;
	return direction.Cross(hint).Unit;
}

// shortest arc between two unit vectors. atan2 instead of acos keeps small angles accurate
export function rotationBetween(from: Vector3, to: Vector3): CFrame {
	const axis = from.Cross(to);
	const sine = axis.Magnitude;
	const cosine = from.Dot(to);
	if (sine < PARALLEL_EPSILON) {
		return cosine > 0 ? CFrame.identity : CFrame.fromAxisAngle(perpendicular(from), math.pi);
	}
	return CFrame.fromAxisAngle(axis.div(sine), math.atan2(sine, cosine));
}

export function signedAngle(from: Vector3, to: Vector3, axis: Vector3): number {
	return math.atan2(axis.Dot(from.Cross(to)), from.Dot(to));
}

// tilts reference toward direction by at most maxAngle radians
export function clampDirection(direction: Vector3, reference: Vector3, maxAngle: number): Vector3 {
	const axis = reference.Cross(direction);
	const sine = axis.Magnitude;
	const angle = math.atan2(sine, reference.Dot(direction));
	if (angle <= maxAngle) {
		return direction;
	}
	if (sine < PARALLEL_EPSILON) {
		return reference;
	}
	return CFrame.fromAxisAngle(axis.div(sine), maxAngle).VectorToWorldSpace(reference);
}
