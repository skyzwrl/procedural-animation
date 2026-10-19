import { FootPlanter, FootPlanterOptions } from "./foot-planter";
import { LimbIK } from "./limb-ik";
import { Raycaster, workspaceRaycaster } from "./raycaster";
import { rotationBetween } from "./rotation";

export interface FootPlantingOptions extends Partial<FootPlanterOptions> {
	raycaster?: Raycaster;
}

interface Leg {
	ik: LimbIK;
	ankle: Motor6D;
	restAnkleC0: CFrame;
}

const SIDES = ["Left", "Right"];

function findMotor(character: Model, partName: string, motorName: string): Motor6D {
	const motor = character.FindFirstChild(partName)?.FindFirstChild(motorName);
	if (!motor || !motor.IsA("Motor6D")) {
		throw `${character.GetFullName()} has no Motor6D ${partName}.${motorName}`;
	}
	return motor;
}

// Foot IK for R15 characters: plants both feet on whatever is under them, sinks the hips so the lower
// foot can reach, and tilts the feet to the ground. Call update every RunService.PreSimulation.
export class FootPlanting {
	private readonly rootJoint: Motor6D;
	private readonly rootPart: BasePart;
	private readonly restRootC0: CFrame;
	private readonly legs: Leg[] = [];
	private readonly ankles: Vector3[] = [];
	private readonly animatedLowerLegs: CFrame[] = [];
	private readonly planter: FootPlanter;

	public constructor(character: Model, options: FootPlantingOptions = {}) {
		this.rootJoint = findMotor(character, "LowerTorso", "Root");
		const rootPart = this.rootJoint.Part0;
		if (!rootPart) {
			throw `${this.rootJoint.GetFullName()} has no Part0`;
		}
		this.rootPart = rootPart;
		this.restRootC0 = this.rootJoint.C0;

		// rest pose relative to the root part, with every Transform treated as identity
		const restTorso = this.restRootC0.mul(this.rootJoint.C1.Inverse());
		const restAnkleHeights: number[] = [];
		let footHeight = options.footHeight;

		for (const side of SIDES) {
			const hip = findMotor(character, `${side}UpperLeg`, `${side}Hip`);
			const knee = findMotor(character, `${side}LowerLeg`, `${side}Knee`);
			const ankle = findMotor(character, `${side}Foot`, `${side}Ankle`);
			this.legs.push({ ik: new LimbIK(hip, knee, ankle), ankle, restAnkleC0: ankle.C0 });

			const restAnkle = restTorso
				.mul(hip.C0)
				.mul(hip.C1.Inverse())
				.mul(knee.C0)
				.mul(knee.C1.Inverse())
				.mul(ankle.C0);
			restAnkleHeights.push(restAnkle.Y);
			this.ankles.push(restAnkle.Position);
			this.animatedLowerLegs.push(CFrame.identity);

			const foot = ankle.Part1;
			if (footHeight === undefined && foot) {
				const sole = restAnkle.mul(ankle.C1.Inverse()).mul(new CFrame(0, -foot.Size.Y / 2, 0));
				footHeight = restAnkle.Y - sole.Y;
			}
		}

		this.planter = new FootPlanter(options.raycaster ?? workspaceRaycaster(), restAnkleHeights, {
			...options,
			footHeight: footHeight ?? 0,
		});
	}

	public update(dt: number): void {
		const rootJoint = this.rootJoint;
		const rootCFrame = this.rootPart.CFrame;
		const rootToTorso = rootJoint.Transform.mul(rootJoint.C1.Inverse());

		const animatedTorso = rootCFrame.mul(this.restRootC0).mul(rootToTorso);
		for (let index = 0; index < this.legs.size(); index++) {
			const ik = this.legs[index].ik;
			const lowerLeg = ik.getLowerCFrame(animatedTorso);
			this.animatedLowerLegs[index] = lowerLeg.Rotation;
			this.ankles[index] = lowerLeg.mul(ik.endJoint.C0).Position;
		}
		this.planter.update(rootCFrame, this.ankles, dt);

		rootJoint.C0 = new CFrame(0, this.planter.getHipOffset(), 0).mul(this.restRootC0);
		const torso = rootCFrame.mul(rootJoint.C0).mul(rootToTorso);
		const up = rootCFrame.UpVector;
		const forward = rootCFrame.LookVector;

		for (let index = 0; index < this.legs.size(); index++) {
			const leg = this.legs[index];
			const plant = this.planter.getFoot(index);
			if (plant.weight <= 0) {
				leg.ankle.C0 = leg.restAnkleC0;
				continue;
			}

			// pole ahead of the leg's midpoint so knees always bend forward
			const hip = leg.ik.getRootPosition(torso);
			const pole = hip.add(plant.target).mul(0.5).add(forward.mul(leg.ik.getReach()));
			leg.ik.apply(plant.target, pole, plant.weight, torso);

			// keep the foot at its animated world orientation instead of inheriting the knee bend, then tilt
			// it to the ground: C0 = lowerLeg^-1 * tilt * animatedLowerLeg * restC0
			const lowerLeg = leg.ik.getLowerCFrame(torso).Rotation;
			const tilt = CFrame.identity.Lerp(rotationBetween(up, plant.normal), plant.weight);
			const rest = leg.restAnkleC0;
			leg.ankle.C0 = new CFrame(rest.Position)
				.mul(lowerLeg.Inverse())
				.mul(tilt)
				.mul(this.animatedLowerLegs[index])
				.mul(rest.Rotation);
		}
	}

	public getPlanter(): FootPlanter {
		return this.planter;
	}

	public destroy(): void {
		this.rootJoint.C0 = this.restRootC0;
		for (const leg of this.legs) {
			leg.ankle.C0 = leg.restAnkleC0;
		}
	}
}
