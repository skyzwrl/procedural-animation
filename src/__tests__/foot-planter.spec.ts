/// <reference types="@rbxts/testez/globals" />

import { FootPlanter } from "../foot-planter";
import { heightfield } from "./heightfield";

const ROOT = new CFrame(0, 3, 0);
const REST_HEIGHT = -2.75;
const FOOT_HEIGHT = 0.25;
const LEFT = new Vector3(-0.5, 0.25, 0);
const RIGHT = new Vector3(0.5, 0.25, 0);

function planter(height: (x: number, z: number) => number | undefined, normal?: Vector3) {
	return new FootPlanter(heightfield(height, normal), [REST_HEIGHT, REST_HEIGHT], { footHeight: FOOT_HEIGHT });
}

function stepUnderLeft(depth: number) {
	return (x: number) => (x < 0 ? depth : 0);
}

export = () => {
	describe("FootPlanter", () => {
		it("leaves feet alone on flat ground", () => {
			const feet = planter(() => 0);
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);

			expect(feet.getHipOffset()).to.be.near(0, 1e-6);
			for (const index of [0, 1]) {
				const foot = feet.getFoot(index);
				expect(foot.grounded).to.equal(true);
				expect(foot.weight).to.be.near(1, 1e-6);
				expect(foot.target.sub(index === 0 ? LEFT : RIGHT).Magnitude).to.be.near(0, 1e-6);
			}
		});

		it("drops a foot onto a lower step and sinks the hips to reach it", () => {
			const feet = planter(stepUnderLeft(-0.5));
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);

			expect(feet.getFoot(0).target.Y).to.be.near(-0.25, 1e-6);
			expect(feet.getFoot(1).target.Y).to.be.near(0.25, 1e-6);
			expect(feet.getHipOffset()).to.be.near(-0.5, 1e-6);
		});

		it("raises a foot onto a higher step without moving the hips", () => {
			const feet = planter(stepUnderLeft(0.4));
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);

			expect(feet.getFoot(0).target.Y).to.be.near(0.65, 1e-6);
			expect(feet.getHipOffset()).to.be.near(0, 1e-6);
		});

		it("limits how far the hips sink", () => {
			const feet = planter(stepUnderLeft(-1.4));
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);

			expect(feet.getFoot(0).target.Y).to.be.near(-1.15, 1e-6);
			expect(feet.getHipOffset()).to.be.near(-1.2, 1e-6);
		});

		it("fades planting out as the animation lifts a foot", () => {
			const feet = planter(stepUnderLeft(-1));
			feet.update(ROOT, [LEFT.add(new Vector3(0, 0.25, 0)), RIGHT], 1 / 60);
			expect(feet.getFoot(0).weight).to.be.near(0.5, 1e-6);

			const lifted = planter(stepUnderLeft(-1));
			lifted.update(ROOT, [LEFT.add(new Vector3(0, 0.6, 0)), RIGHT], 1 / 60);
			expect(lifted.getFoot(0).weight).to.be.near(0, 1e-6);
			expect(lifted.getHipOffset()).to.be.near(0, 1e-6);
		});

		it("keeps the animated lift above the ground under the foot", () => {
			const feet = planter(stepUnderLeft(0.4));
			feet.update(ROOT, [LEFT.add(new Vector3(0, 0.2, 0)), RIGHT], 1 / 60);

			expect(feet.getFoot(0).target.Y).to.be.near(0.85, 1e-6);
		});

		it("lets go of feet with nothing under them", () => {
			const feet = planter((x) => (x < 0 ? undefined : 0));
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);
			const foot = feet.getFoot(0);

			expect(foot.grounded).to.equal(false);
			expect(foot.weight).to.equal(0);
			expect(foot.target.sub(LEFT).Magnitude).to.be.near(0, 1e-6);
		});

		it("clamps the ground normal to the max foot angle", () => {
			const steep = CFrame.Angles(0, 0, math.rad(50)).VectorToWorldSpace(Vector3.yAxis);
			const feet = planter(() => 0, steep);
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);
			const normal = feet.getFoot(0).normal;

			expect(math.deg(math.acos(normal.Dot(Vector3.yAxis)))).to.be.near(35, 1e-2);
			expect(normal.X < 0).to.equal(true);
		});

		it("snaps on the first update and then eases toward changes", () => {
			let depth = 0;
			const feet = planter((x) => (x < 0 ? depth : 0));
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);

			depth = -0.5;
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);
			const eased = feet.getFoot(0).target.Y;
			expect(eased < 0.25 && eased > -0.25).to.equal(true);

			feet.reset();
			feet.update(ROOT, [LEFT, RIGHT], 1 / 60);
			expect(feet.getFoot(0).target.Y).to.be.near(-0.25, 1e-6);
		});

		it("eases the same amount however the frame time is split", () => {
			let depth = 0;
			const ground = (x: number) => (x < 0 ? depth : 0);
			const once = planter(ground);
			const twice = planter(ground);
			once.update(ROOT, [LEFT, RIGHT], 1 / 60);
			twice.update(ROOT, [LEFT, RIGHT], 1 / 60);

			depth = -0.5;
			once.update(ROOT, [LEFT, RIGHT], 0.05);
			twice.update(ROOT, [LEFT, RIGHT], 0.025);
			twice.update(ROOT, [LEFT, RIGHT], 0.025);

			const target = once.getFoot(0).target.Y;
			expect(target < 0.2 && target > -0.25).to.equal(true);
			expect(twice.getFoot(0).target.Y).to.be.near(target, 1e-5);
		});
	});
};
