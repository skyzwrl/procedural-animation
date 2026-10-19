/// <reference types="@rbxts/testez/globals" />

import { LimbIK } from "../limb-ik";

interface Leg {
	torso: Part;
	hip: Motor6D;
	knee: Motor6D;
	ankle: Motor6D;
}

function joint(part0: Part, part1: Part, c0: CFrame, c1: CFrame): Motor6D {
	const motor = new Instance("Motor6D");
	motor.Part0 = part0;
	motor.Part1 = part1;
	motor.C0 = c0;
	motor.C1 = c1;
	motor.Transform = CFrame.identity;
	return motor;
}

function makeLeg(twisted: boolean): Leg {
	const torso = new Instance("Part");
	const upperLeg = new Instance("Part");
	const lowerLeg = new Instance("Part");
	const foot = new Instance("Part");
	torso.CFrame = new CFrame(3, 6, -2).mul(CFrame.Angles(0, twisted ? 0.8 : 0, 0));

	// the same spin on both sides of the hip leaves the leg's shape alone but rotates the joint frame,
	// which checks the solver doesn't assume axis-aligned C0/C1
	const spin = twisted ? CFrame.Angles(0.3, -0.5, 0.2) : CFrame.identity;
	return {
		torso,
		hip: joint(torso, upperLeg, new CFrame(-0.5, -0.4, 0).mul(spin), new CFrame(0, 0.8, 0).mul(spin)),
		knee: joint(upperLeg, lowerLeg, new CFrame(0, -0.8, 0), new CFrame(0, 0.7, 0)),
		ankle: joint(lowerLeg, foot, new CFrame(0, -0.7, 0), new CFrame(0, 0.2, 0)),
	};
}

function hipPosition(leg: Leg): Vector3 {
	return leg.torso.CFrame.mul(leg.hip.C0).Position;
}

function kneePosition(leg: Leg): Vector3 {
	const { torso, hip, knee } = leg;
	return torso.CFrame.mul(hip.C0).mul(hip.Transform).mul(hip.C1.Inverse()).mul(knee.C0).Position;
}

function anklePosition(leg: Leg): Vector3 {
	const { torso, hip, knee, ankle } = leg;
	return torso.CFrame.mul(hip.C0)
		.mul(hip.Transform)
		.mul(hip.C1.Inverse())
		.mul(knee.C0)
		.mul(knee.Transform)
		.mul(knee.C1.Inverse())
		.mul(ankle.C0).Position;
}

export = () => {
	describe("LimbIK", () => {
		for (const twisted of [false, true]) {
			const label = twisted ? " with rotated joint frames" : "";

			it(`moves the ankle onto reachable targets${label}`, () => {
				const leg = makeLeg(twisted);
				const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
				const hip = hipPosition(leg);
				const forward = leg.torso.CFrame.LookVector;
				const offsets = [new Vector3(0, -2.6, 0), new Vector3(0.6, -1.8, -0.9), new Vector3(-0.4, -1.2, 0.8)];

				for (const offset of offsets) {
					const target = hip.add(offset);
					expect(ik.apply(target, hip.add(forward.mul(3)))).to.equal(true);
					expect(anklePosition(leg).sub(target).Magnitude).to.be.near(0, 2e-3);
				}
			});
		}

		it("measures its reach from the rig", () => {
			const leg = makeLeg(false);
			expect(new LimbIK(leg.hip, leg.knee, leg.ankle).getReach()).to.be.near(3, 1e-5);
		});

		it("straightens the leg toward targets out of reach", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const hip = hipPosition(leg);
			const target = hip.add(new Vector3(0, -8, 0));

			expect(ik.apply(target, hip.add(new Vector3(0, 0, -3)))).to.equal(false);
			expect(anklePosition(leg).sub(hip.add(new Vector3(0, -3, 0))).Magnitude).to.be.near(0, 2e-3);
		});

		it("bends the knee toward the pole", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const hip = hipPosition(leg);
			const target = hip.add(new Vector3(0, -2.2, 0));

			ik.apply(target, hip.add(new Vector3(0, -1, -4)));
			expect(kneePosition(leg).Z < hip.Z - 0.3).to.equal(true);

			ik.apply(target, hip.add(new Vector3(0, -1, 4)));
			expect(kneePosition(leg).Z > hip.Z + 0.3).to.equal(true);
		});

		it("rolls the thigh as little as possible, so the kneecap keeps facing the pole", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const hip = hipPosition(leg);

			ik.apply(hip.add(new Vector3(0.3, -2, -0.4)), hip.add(new Vector3(0, -1, -4)));
			const thigh = leg.torso.CFrame.mul(leg.hip.C0).mul(leg.hip.Transform).mul(leg.hip.C1.Inverse());

			expect(thigh.RightVector.Dot(leg.torso.CFrame.RightVector) > 0.9).to.equal(true);
		});

		it("keeps the knee a hinge about its X axis", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const hip = hipPosition(leg);

			ik.apply(hip.add(new Vector3(0.7, -1.6, -0.6)), hip.add(new Vector3(0.5, -1, -4)));
			const [axis, angle] = leg.knee.Transform.ToAxisAngle();

			expect(angle > 0.2).to.equal(true);
			expect(math.abs(axis.X)).to.be.near(1, 1e-3);
		});

		it("blends against the current transforms by weight", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const hip = hipPosition(leg);
			const target = hip.add(new Vector3(0, -1.5, -0.8));
			const pole = hip.add(new Vector3(0, -1, -4));

			ik.apply(target, pole, 0);
			expect(leg.knee.Transform.ToAxisAngle()[1]).to.be.near(0, 1e-6);

			const half = CFrame.identity.Lerp(ik.solve(target, pole).middleTransform, 0.5);
			ik.apply(target, pole, 0.5);
			expect(leg.knee.Transform.LookVector.sub(half.LookVector).Magnitude).to.be.near(0, 1e-5);
			expect(leg.knee.Transform.UpVector.sub(half.UpVector).Magnitude).to.be.near(0, 1e-5);
			expect(half.LookVector.sub(new Vector3(0, 0, -1)).Magnitude > 0.2).to.equal(true);
		});

		it("solves from a parent frame other than Part0", () => {
			const leg = makeLeg(false);
			const ik = new LimbIK(leg.hip, leg.knee, leg.ankle);
			const parent = leg.torso.CFrame.add(new Vector3(0, -1, 0));
			const target = parent.mul(leg.hip.C0).Position.add(new Vector3(0, -2.4, -0.5));

			ik.apply(target, target.add(new Vector3(0, 1, -4)), 1, parent);
			expect(ik.getEndPosition(parent).sub(target).Magnitude).to.be.near(0, 2e-3);
		});
	});
};
