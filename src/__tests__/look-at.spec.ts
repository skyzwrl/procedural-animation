/// <reference types="@rbxts/testez/globals" />

import { LookAt } from "../look-at";

const REFERENCE = new CFrame(0, 5, 0);
const SETTLE = 10;

export = () => {
	describe("LookAt", () => {
		it("stays neutral for a target straight ahead", () => {
			const look = new LookAt([1]);
			look.update(REFERENCE, new Vector3(0, 5, -10), SETTLE);

			expect(look.getYaw()).to.be.near(0, 1e-6);
			expect(look.getPitch()).to.be.near(0, 1e-6);
		});

		it("turns the joints to face a target inside the limits", () => {
			const look = new LookAt([1]);
			const target = new Vector3(-6, 8, -8);
			look.update(REFERENCE, target, SETTLE);
			const facing = REFERENCE.Rotation.mul(look.getJointRotation(0)).LookVector;

			expect(look.getYaw()).to.be.near(math.atan2(6, 8), 1e-4);
			expect(facing.Dot(target.sub(REFERENCE.Position).Unit)).to.be.near(1, 1e-4);
		});

		it("measures angles in the reference frame", () => {
			const look = new LookAt([1]);
			const turned = REFERENCE.mul(CFrame.Angles(0, math.rad(90), 0));
			look.update(turned, new Vector3(-10, 5, -10), SETTLE);

			expect(look.getYaw()).to.be.near(math.rad(-45), 1e-4);
		});

		it("clamps yaw and pitch to their limits", () => {
			const look = new LookAt([1], { maxYaw: math.rad(70), maxPitch: math.rad(40) });
			look.update(REFERENCE, new Vector3(-10, 5, 5), SETTLE);
			expect(look.getYaw()).to.be.near(math.rad(70), 1e-4);

			look.update(REFERENCE, new Vector3(0, 50, -1), SETTLE);
			expect(look.getPitch()).to.be.near(math.rad(40), 1e-4);
			expect(look.getYaw()).to.be.near(0, 1e-4);
		});

		it("lets go of targets past the release angle", () => {
			const look = new LookAt([1], { releaseYaw: math.rad(100) });
			look.update(REFERENCE, new Vector3(-10, 5, -2), SETTLE);
			expect(look.getYaw() > 1).to.equal(true);

			look.update(REFERENCE, new Vector3(-10, 5, 8), SETTLE);
			expect(look.getYaw()).to.be.near(0, 1e-4);
		});

		it("splits the look across joints by weight", () => {
			const look = new LookAt([1, 3]);
			look.update(REFERENCE, new Vector3(-8, 9, -6), SETTLE);
			const [waistPitch, waistYaw] = look.getJointRotation(0).ToOrientation();
			const [neckPitch, neckYaw] = look.getJointRotation(1).ToOrientation();

			expect(waistYaw).to.be.near(look.getYaw() * 0.25, 1e-4);
			expect(neckYaw).to.be.near(look.getYaw() * 0.75, 1e-4);
			expect(waistPitch + neckPitch).to.be.near(look.getPitch(), 1e-4);
		});

		it("eases toward the target and lands on the same value however frames are split", () => {
			const once = new LookAt([1]);
			const many = new LookAt([1]);
			const target = new Vector3(-10, 5, -10);

			once.update(REFERENCE, target, 0.1);
			for (let frame = 0; frame < 10; frame++) {
				many.update(REFERENCE, target, 0.01);
			}

			expect(once.getYaw() > 0 && once.getYaw() < math.rad(45)).to.equal(true);
			expect(many.getYaw()).to.be.near(once.getYaw(), 1e-6);
		});

		it("returns to neutral when the target goes away", () => {
			const look = new LookAt([1]);
			look.update(REFERENCE, new Vector3(-10, 5, -10), SETTLE);
			look.update(REFERENCE, undefined, SETTLE);

			expect(look.getYaw()).to.be.near(0, 1e-6);
		});

		it("needs a positive weight", () => {
			expect(() => new LookAt([0, 0])).to.throw("positive joint weight");
		});
	});
};
