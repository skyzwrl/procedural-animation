import { Players, RunService, Workspace } from "@rbxts/services";
import { FootPlanting, MotorLookAt, workspaceRaycaster } from "@skyzwrl/procedural-animation";

const player = Players.LocalPlayer;

function rig(character: Model) {
	const humanoid = character.WaitForChild("Humanoid") as Humanoid;
	const rootPart = character.WaitForChild("HumanoidRootPart") as BasePart;
	const waist = character.WaitForChild("UpperTorso").WaitForChild("Waist") as Motor6D;
	const neck = character.WaitForChild("Head").WaitForChild("Neck") as Motor6D;

	const params = new RaycastParams();
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.FilterDescendantsInstances = [character];

	const feet = new FootPlanting(character, { raycaster: workspaceRaycaster(params) });
	const look = new MotorLookAt([waist, neck], [0.35, 0.65], { maxYaw: math.rad(60), releaseYaw: math.rad(120) });

	// PreSimulation runs after the Animator has written this frame's Motor6D.Transform values
	const connection = RunService.PreSimulation.Connect((dt) => {
		// no airborne special case needed, feet fade out on their own once the ground is out of ray range
		feet.update(dt);

		const camera = Workspace.CurrentCamera;
		const target = camera ? camera.CFrame.Position.add(camera.CFrame.LookVector.mul(60)) : undefined;
		look.update(rootPart.CFrame.mul(new CFrame(0, 1.5, 0)), target, dt);
	});

	humanoid.Died.Once(() => {
		connection.Disconnect();
		feet.destroy();
		look.destroy();
	});
}

if (player.Character) {
	rig(player.Character);
}
player.CharacterAdded.Connect(rig);
