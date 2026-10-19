/// <reference types="@rbxts/testez/globals" />

import { FootPlanting } from "../foot-planting";
import { heightfield } from "./heightfield";

interface Rig {
	character: Model;
	rootPart: Part;
	root: Motor6D;
	motors: Map<string, Motor6D>;
}

function part(character: Model, name: string, size = new Vector3(1, 1, 1)): Part {
	const instance = new Instance("Part");
	instance.Name = name;
	instance.Size = size;
	instance.Parent = character;
	return instance;
}

function motor(name: string, part0: Part, part1: Part, c0: CFrame, c1: CFrame): Motor6D {
	const instance = new Instance("Motor6D");
	instance.Name = name;
	instance.Part0 = part0;
	instance.Part1 = part1;
	instance.C0 = c0;
	instance.C1 = c1;
	instance.Transform = CFrame.identity;
	instance.Parent = part1;
	return instance;
}

// R15-shaped legs: hip 1 stud below the root, 1.2 + 1.1 stud bones, ankle 0.25 above the sole.
// The root sits at 3.55 so the soles rest on y = 0.
function makeRig(): Rig {
	const character = new Instance("Model");
	const rootPart = part(character, "HumanoidRootPart", new Vector3(2, 2, 1));
	rootPart.CFrame = new CFrame(0, 3.55, 0);
	const lowerTorso = part(character, "LowerTorso");
	const root = motor("Root", rootPart, lowerTorso, new CFrame(0, -1, 0), new CFrame(0, -0.2, 0));
	const motors = new Map<string, Motor6D>();

	for (const [side, x] of [
		["Left", -0.5],
		["Right", 0.5],
	] as const) {
		const upperLeg = part(character, `${side}UpperLeg`);
		const lowerLeg = part(character, `${side}LowerLeg`);
		const foot = part(character, `${side}Foot`, new Vector3(1, 0.3, 1));
		motors.set(
			`${side}Hip`,
			motor(`${side}Hip`, lowerTorso, upperLeg, new CFrame(x, -0.2, 0), new CFrame(0, 0.6, 0)),
		);
		motors.set(
			`${side}Knee`,
			motor(`${side}Knee`, upperLeg, lowerLeg, new CFrame(0, -0.6, 0), new CFrame(0, 0.55, 0)),
		);
		motors.set(
			`${side}Ankle`,
			motor(`${side}Ankle`, lowerLeg, foot, new CFrame(0, -0.55, 0), new CFrame(0, 0.1, 0)),
		);
	}

	return { character, rootPart, root, motors };
}

function lowerLeg(rig: Rig, side: string): CFrame {
	const hip = rig.motors.get(`${side}Hip`)!;
	const knee = rig.motors.get(`${side}Knee`)!;
	return rig.rootPart.CFrame.mul(rig.root.C0)
		.mul(rig.root.Transform)
		.mul(rig.root.C1.Inverse())
		.mul(hip.C0)
		.mul(hip.Transform)
		.mul(hip.C1.Inverse())
		.mul(knee.C0)
		.mul(knee.Transform)
		.mul(knee.C1.Inverse());
}

function ankle(rig: Rig, side: string): Vector3 {
	return lowerLeg(rig, side).mul(rig.motors.get(`${side}Ankle`)!.C0).Position;
}

function footUp(rig: Rig, side: string): Vector3 {
	const joint = rig.motors.get(`${side}Ankle`)!;
	return lowerLeg(rig, side).mul(joint.C0).mul(joint.Transform).mul(joint.C1.Inverse()).UpVector;
}

export = () => {
	describe("FootPlanting", () => {
		it("leaves a character standing on flat ground as it is", () => {
			const rig = makeRig();
			const planting = new FootPlanting(rig.character, { raycaster: heightfield(() => 0) });
			planting.update(1 / 60);

			expect(rig.root.C0.Position.Y).to.be.near(-1, 1e-5);
			expect(ankle(rig, "Left").sub(new Vector3(-0.5, 0.25, 0)).Magnitude).to.be.near(0, 2e-3);
			expect(ankle(rig, "Right").sub(new Vector3(0.5, 0.25, 0)).Magnitude).to.be.near(0, 2e-3);
		});

		it("works out the foot height from the rig", () => {
			const rig = makeRig();
			const planting = new FootPlanting(rig.character, { raycaster: heightfield(() => 0) });
			planting.update(1 / 60);

			expect(planting.getPlanter().getFoot(0).target.Y).to.be.near(0.25, 1e-5);
		});

		it("sinks the hips and plants both feet when one stands over a lower step", () => {
			const rig = makeRig();
			const planting = new FootPlanting(rig.character, {
				raycaster: heightfield((x) => (x < 0 ? -0.5 : 0)),
			});
			planting.update(1 / 60);

			expect(rig.root.C0.Position.Y).to.be.near(-1.5, 1e-4);
			expect(ankle(rig, "Left").Y).to.be.near(-0.25, 2e-3);
			expect(ankle(rig, "Right").Y).to.be.near(0.25, 2e-3);
			expect(ankle(rig, "Right").X).to.be.near(0.5, 2e-3);
		});

		it("keeps feet level while the knees bend", () => {
			const rig = makeRig();
			const planting = new FootPlanting(rig.character, {
				raycaster: heightfield((x) => (x < 0 ? -0.5 : 0)),
			});
			planting.update(1 / 60);

			expect(rig.motors.get("RightKnee")!.Transform.ToAxisAngle()[1] > 0.3).to.equal(true);
			expect(footUp(rig, "Right").Dot(Vector3.yAxis)).to.be.near(1, 1e-4);
			expect(footUp(rig, "Left").Dot(Vector3.yAxis)).to.be.near(1, 1e-4);
		});

		it("tilts planted feet to the slope", () => {
			const rig = makeRig();
			const slope = CFrame.Angles(math.rad(15), 0, 0).VectorToWorldSpace(Vector3.yAxis);
			const planting = new FootPlanting(rig.character, { raycaster: heightfield(() => 0, slope) });
			planting.update(1 / 60);

			expect(footUp(rig, "Left").Dot(slope)).to.be.near(1, 1e-4);
			expect(footUp(rig, "Right").Dot(slope)).to.be.near(1, 1e-4);
		});

		it("leaves a lifted leg to the animation", () => {
			const rig = makeRig();
			const hip = rig.motors.get("LeftHip")!;
			const swing = CFrame.Angles(math.rad(60), 0, 0);
			hip.Transform = swing;

			const planting = new FootPlanting(rig.character, { raycaster: heightfield(() => 0) });
			planting.update(1 / 60);

			expect(planting.getPlanter().getFoot(0).weight).to.equal(0);
			expect(hip.Transform.LookVector.sub(swing.LookVector).Magnitude).to.be.near(0, 1e-5);
			expect(hip.Transform.UpVector.sub(swing.UpVector).Magnitude).to.be.near(0, 1e-5);
		});

		it("puts the joints back on destroy", () => {
			const rig = makeRig();
			const ankleJoint = rig.motors.get("LeftAnkle")!;
			const restAnkle = ankleJoint.C0;
			const slope = CFrame.Angles(0, 0, math.rad(20)).VectorToWorldSpace(Vector3.yAxis);
			const planting = new FootPlanting(rig.character, {
				raycaster: heightfield((x) => (x < 0 ? -0.5 : 0), slope),
			});
			planting.update(1 / 60);
			planting.destroy();

			expect(rig.root.C0.Position.Y).to.be.near(-1, 1e-6);
			expect(ankleJoint.C0).to.equal(restAnkle);
		});

		it("names the missing joint when the rig is incomplete", () => {
			const rig = makeRig();
			rig.motors.get("RightKnee")!.Destroy();

			expect(() => new FootPlanting(rig.character)).to.throw("RightLowerLeg.RightKnee");
		});
	});
};
