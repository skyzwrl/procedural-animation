/// <reference types="@rbxts/testez/globals" />

import { boneFrame, solveTwoBone } from "../two-bone-ik";

const UPPER = 1.6;
const LOWER = 1.4;

export = () => {
	function expectVector(actual: Vector3, expected: Vector3, tolerance = 1e-4) {
		expect(actual.sub(expected).Magnitude).to.be.near(0, tolerance);
	}

	describe("solveTwoBone", () => {
		const root = new Vector3(2, 5, -1);
		const pole = root.add(new Vector3(0, -1, -3));

		it("puts the end on reachable targets with both bones at their lengths", () => {
			const targets = [
				root.add(new Vector3(0, -2.5, 0)),
				root.add(new Vector3(1, -1, 0.5)),
				root.add(new Vector3(-0.3, 0.4, -0.2)),
				root.add(new Vector3(0, -2.99, 0)),
			];
			for (const target of targets) {
				const solution = solveTwoBone(root, target, pole, UPPER, LOWER);
				expect(solution.reached).to.equal(true);
				expectVector(solution.end, target);
				expect(solution.joint.sub(root).Magnitude).to.be.near(UPPER, 1e-4);
				expect(solution.end.sub(solution.joint).Magnitude).to.be.near(LOWER, 1e-4);
			}
		});

		it("straightens toward targets that are too far away", () => {
			const target = root.add(new Vector3(0, -10, 0));
			const solution = solveTwoBone(root, target, pole, UPPER, LOWER);

			expect(solution.reached).to.equal(false);
			expectVector(solution.end, root.add(new Vector3(0, -(UPPER + LOWER), 0)));
			expectVector(solution.joint, root.add(new Vector3(0, -UPPER, 0)));
		});

		it("stops at the shortest reach when the target is too close", () => {
			const target = root.add(new Vector3(0.05, 0, 0));
			const solution = solveTwoBone(root, target, pole, UPPER, LOWER);

			expect(solution.reached).to.equal(false);
			expect(solution.end.sub(root).Magnitude).to.be.near(UPPER - LOWER, 1e-4);
			expect(solution.end.sub(solution.joint).Magnitude).to.be.near(LOWER, 1e-4);
		});

		it("bends the joint toward the pole", () => {
			const target = root.add(new Vector3(0, -2.2, 0));
			const front = solveTwoBone(root, target, root.add(new Vector3(0, -1, -5)), UPPER, LOWER);
			const back = solveTwoBone(root, target, root.add(new Vector3(0, -1, 5)), UPPER, LOWER);

			expect(front.joint.Z < root.Z - 0.1).to.equal(true);
			expect(back.joint.Z > root.Z + 0.1).to.equal(true);
			expect(math.abs(front.joint.X - root.X) < 1e-4).to.equal(true);
		});

		it("keeps the bend normal perpendicular to both bones", () => {
			const solution = solveTwoBone(root, root.add(new Vector3(1, -1.5, 0.4)), pole, UPPER, LOWER);
			const upper = solution.joint.sub(root).Unit;
			const lower = solution.end.sub(solution.joint).Unit;

			expect(solution.bendNormal.Magnitude).to.be.near(1, 1e-5);
			expect(solution.bendNormal.Dot(upper)).to.be.near(0, 1e-5);
			expect(solution.bendNormal.Dot(lower)).to.be.near(0, 1e-5);
		});

		it("picks a bend direction when the pole lies on the reach line", () => {
			const target = root.add(new Vector3(0, -2, 0));
			const solution = solveTwoBone(root, target, root.add(new Vector3(0, -5, 0)), UPPER, LOWER);

			expect(solution.joint.X === solution.joint.X).to.equal(true);
			expectVector(solution.end, target);
			expect(solution.joint.sub(root).Magnitude).to.be.near(UPPER, 1e-4);
		});

		it("does not produce NaN when the target sits on the root", () => {
			const solution = solveTwoBone(root, root, pole, UPPER, LOWER);

			expect(solution.end.Y === solution.end.Y).to.equal(true);
			expect(solution.joint.Y === solution.joint.Y).to.equal(true);
			expect(solution.end.sub(root).Magnitude).to.be.near(UPPER - LOWER, 1e-4);
		});

		it("writes into the out table when given one", () => {
			const out = { joint: Vector3.zero, end: Vector3.zero, bendNormal: Vector3.zero, reached: false };
			const solution = solveTwoBone(root, root.add(new Vector3(0, -2, 0)), pole, UPPER, LOWER, out);

			expect(solution).to.equal(out);
			expect(out.reached).to.equal(true);
		});
	});

	describe("boneFrame", () => {
		it("looks along the bone with the bend normal as its right vector", () => {
			const from = new Vector3(0, 3, 0);
			const to = new Vector3(0, 1, -1);
			const normal = to.sub(from).Unit.Cross(new Vector3(0, 0, -1)).Unit;
			const frame = boneFrame(from, to, normal);

			expectVector(frame.Position, from);
			expectVector(frame.LookVector, to.sub(from).Unit);
			expectVector(frame.RightVector, normal);
		});
	});
};
