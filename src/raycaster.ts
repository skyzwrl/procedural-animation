import { Workspace } from "@rbxts/services";

export type RayHit = Pick<RaycastResult, "Position" | "Normal">;

export type Raycaster = (origin: Vector3, direction: Vector3) => RayHit | undefined;

export function workspaceRaycaster(params?: RaycastParams): Raycaster {
	return (origin, direction) => Workspace.Raycast(origin, direction, params);
}
