import { Raycaster } from "../raycaster";

// straight-down rays against a heightfield; an undefined height is a hole
export function heightfield(height: (x: number, z: number) => number | undefined, normal = Vector3.yAxis): Raycaster {
	return (origin, direction) => {
		const ground = height(origin.X, origin.Z);
		if (ground === undefined || ground > origin.Y || ground < origin.Y + direction.Y) {
			return undefined;
		}
		return { Position: new Vector3(origin.X, ground, origin.Z), Normal: normal };
	};
}
