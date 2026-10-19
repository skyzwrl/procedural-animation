/// <reference types="@rbxts/testez/globals" />

import { clampDirection, rotationBetween, signedAngle } from "../rotation";

export = () => {
	function expectVector(actual: Vector3, expected: Vector3, tolerance = 1e-5) {
		expect(actual.sub(expected).Magnitude).to.be.near(0, tolerance);
	}

	describe("rotationBetween", () => {
		it("rotates one direction onto another", () => {
			const cases = [
				[new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
				[new Vector3(0, 0, -1), new Vector3(0.6, 0, 0.8)],
				[new Vector3(1, 2, 3).Unit, new Vector3(-2, 0.5, 1).Unit],
				[new Vector3(0, 1, 0), new Vector3(0, 1, 1e-4).Unit],
			];
			for (const [from, to] of cases) {
				expectVector(rotationBetween(from, to).VectorToWorldSpace(from), to);
			}
		});

		it("handles parallel and opposite directions", () => {
			const up = new Vector3(0, 1, 0);
			expectVector(rotationBetween(up, up).VectorToWorldSpace(up), up);
			expectVector(rotationBetween(up, up.mul(-1)).VectorToWorldSpace(up), up.mul(-1));
		});
	});

	describe("signedAngle", () => {
		it("measures counter-clockwise about the axis as positive", () => {
			const axis = new Vector3(0, 1, 0);
			expect(signedAngle(new Vector3(1, 0, 0), new Vector3(0, 0, -1), axis)).to.be.near(math.pi / 2, 1e-6);
			expect(signedAngle(new Vector3(1, 0, 0), new Vector3(0, 0, 1), axis)).to.be.near(-math.pi / 2, 1e-6);
		});
	});

	describe("clampDirection", () => {
		const up = new Vector3(0, 1, 0);

		it("leaves directions inside the limit alone", () => {
			const direction = new Vector3(0.2, 1, 0).Unit;
			expectVector(clampDirection(direction, up, math.rad(30)), direction);
		});

		it("tilts at most the limit toward directions outside it", () => {
			const clamped = clampDirection(new Vector3(1, 0.2, 0).Unit, up, math.rad(30));

			expect(math.deg(math.acos(clamped.Dot(up)))).to.be.near(30, 1e-3);
			expect(clamped.X > 0).to.equal(true);
			expect(clamped.Z).to.be.near(0, 1e-6);
		});
	});
};
