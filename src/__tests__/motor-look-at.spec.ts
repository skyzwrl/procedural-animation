/// <reference types="@rbxts/testez/globals" />

import { MotorLookAt } from "../motor-look-at";

function makeNeck(torsoCFrame: CFrame): Motor6D {
	const torso = new Instance("Part");
	const head = new Instance("Part");
	torso.CFrame = torsoCFrame;
	const neck = new Instance("Motor6D");
	neck.Part0 = torso;
	neck.Part1 = head;
	neck.C0 = new CFrame(0, 1, 0);
	neck.C1 = new CFrame(0, -0.5, 0);
	return neck;
}

function headLook(neck: Motor6D): Vector3 {
	return neck.Part0!.CFrame.mul(neck.C0).mul(neck.C1.Inverse()).LookVector;
}

export = () => {
	describe("MotorLookAt", () => {
		for (const turn of [0, 90, -135]) {
			it(`points the head at the target with the torso turned ${turn} degrees`, () => {
				const torso = new CFrame(4, 5, -3).mul(CFrame.Angles(0, math.rad(turn), 0));
				const neck = makeNeck(torso);
				const target = torso.PointToWorldSpace(new Vector3(-4, 0.5, -6));
				const look = new MotorLookAt([neck], [1]);

				look.update(torso, target, 10);

				expect(headLook(neck).Dot(target.sub(torso.Position).Unit)).to.be.near(1, 1e-4);
				expect(neck.C0.Position.sub(new Vector3(0, 1, 0)).Magnitude).to.be.near(0, 1e-6);
			});
		}

		it("puts C0 back on destroy", () => {
			const neck = makeNeck(new CFrame());
			const look = new MotorLookAt([neck], [1]);
			look.update(new CFrame(), new Vector3(-5, 0, -5), 10);
			look.destroy();

			expect(neck.C0).to.equal(new CFrame(0, 1, 0));
		});

		it("needs one weight per motor", () => {
			expect(() => new MotorLookAt([makeNeck(new CFrame())], [1, 1])).to.throw("one weight per motor");
		});
	});
};
