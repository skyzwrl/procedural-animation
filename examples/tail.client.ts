import { Players, RunService, Workspace } from "@rbxts/services";
import { VerletChain } from "@skyzwrl/procedural-animation";

const SEGMENTS = 7;
const SEGMENT_LENGTH = 0.45;

function tail(character: Model) {
	const lowerTorso = character.WaitForChild("LowerTorso") as BasePart;
	const anchor = new Instance("Attachment");
	anchor.Position = new Vector3(0, -0.2, 0.5);
	anchor.Parent = lowerTorso;

	const lengths: number[] = [];
	const parts: BasePart[] = [];
	for (let index = 0; index < SEGMENTS; index++) {
		lengths.push(SEGMENT_LENGTH);

		const part = new Instance("Part");
		const thickness = 0.5 - index * 0.05;
		part.Size = new Vector3(thickness, thickness, SEGMENT_LENGTH);
		part.Anchored = true;
		part.CanCollide = false;
		part.CanQuery = false;
		part.Parent = character;
		parts.push(part);
	}

	// rests behind and a little below the hips; stiffness keeps it from hanging like a rope
	const chain = new VerletChain(anchor.WorldCFrame, lengths, {
		restDirection: new Vector3(0, -0.35, 1),
		stiffness: 0.12,
		damping: 0.95,
	});
	const body = { center: lowerTorso.Position, radius: 1 };
	chain.colliders.push(body);

	const frames: CFrame[] = [];
	const connection = RunService.Heartbeat.Connect((dt) => {
		chain.setRoot(anchor.WorldCFrame);
		body.center = lowerTorso.Position;
		chain.update(dt);

		for (let index = 0; index < SEGMENTS; index++) {
			frames[index] = chain.getSegmentCFrame(index);
		}
		Workspace.BulkMoveTo(parts, frames, Enum.BulkMoveMode.FireCFrameChanged);
	});

	character.AncestryChanged.Connect((_, parent) => {
		if (!parent) {
			connection.Disconnect();
		}
	});
}

const player = Players.LocalPlayer;
if (player.Character) {
	tail(player.Character);
}
player.CharacterAdded.Connect(tail);
