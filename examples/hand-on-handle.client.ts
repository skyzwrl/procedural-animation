import { Players, RunService, Workspace } from "@rbxts/services";
import { LimbIK } from "@skyzwrl/procedural-animation";

// reaches the right hand for a door handle as the player walks up to it
const REACH_START = 5;
const REACH_FULL = 3;

const player = Players.LocalPlayer;
const handle = Workspace.WaitForChild("Door").WaitForChild("Handle") as BasePart;

function rig(character: Model) {
	const rootPart = character.WaitForChild("HumanoidRootPart") as BasePart;
	const shoulder = character.WaitForChild("RightUpperArm").WaitForChild("RightShoulder") as Motor6D;
	const elbow = character.WaitForChild("RightLowerArm").WaitForChild("RightElbow") as Motor6D;
	const wrist = character.WaitForChild("RightHand").WaitForChild("RightWrist") as Motor6D;
	const arm = new LimbIK(shoulder, elbow, wrist);

	RunService.PreSimulation.Connect(() => {
		const distance = handle.Position.sub(rootPart.Position).Magnitude;
		const weight = math.clamp((REACH_START - distance) / (REACH_START - REACH_FULL), 0, 1);
		if (weight <= 0) {
			return;
		}

		// elbow out to the side and slightly down
		const root = rootPart.CFrame;
		const pole = arm.getRootPosition().add(root.RightVector.mul(2)).add(root.UpVector.mul(-1));
		arm.apply(handle.Position, pole, weight);
	});
}

if (player.Character) {
	rig(player.Character);
}
player.CharacterAdded.Connect(rig);
