/// <reference types="@rbxts/testez/globals" />

import { VerletChain } from "../verlet-chain";

const LENGTHS = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

function run(chain: VerletChain, seconds: number) {
	for (let frame = 0; frame < seconds * 60; frame++) {
		chain.update(1 / 60);
	}
}

function largestStretch(chain: VerletChain): number {
	let largest = 0;
	for (let index = 0; index < chain.getPointCount() - 1; index++) {
		const length = chain.getPoint(index + 1).sub(chain.getPoint(index)).Magnitude;
		largest = math.max(largest, math.abs(length - chain.getSegmentLength(index)));
	}
	return largest;
}

export = () => {
	describe("VerletChain", () => {
		it("lays out along the rest direction", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });

			expect(chain.getPointCount()).to.equal(7);
			expect(chain.getPoint(6).sub(new Vector3(3, 10, 0)).Magnitude).to.be.near(0, 1e-6);
		});

		it("settles hanging straight down under gravity", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });
			run(chain, 10);

			expect(chain.getPoint(6).sub(new Vector3(0, 7, 0)).Magnitude).to.be.near(0, 0.02);
		});

		it("keeps its segment lengths while the root swings around", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS);
			for (let frame = 0; frame < 120; frame++) {
				const angle = frame / 10;
				chain.setRoot(new CFrame(math.cos(angle) * 3, 10, math.sin(angle) * 3));
				chain.update(1 / 60);
			}

			expect(largestStretch(chain) < 0.01).to.equal(true);
		});

		it("pins the first point to the root", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS);
			chain.setRoot(new CFrame(5, 6, 7));
			chain.update(1 / 60);

			expect(chain.getPoint(0)).to.equal(new Vector3(5, 6, 7));
		});

		it("keeps points out of sphere colliders", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS);
			const collider = { center: new Vector3(0.3, 8.5, 0), radius: 1 };
			chain.colliders.push(collider);
			run(chain, 5);

			for (let index = 1; index < chain.getPointCount(); index++) {
				expect(chain.getPoint(index).sub(collider.center).Magnitude >= collider.radius - 0.01).to.equal(true);
			}
		});

		it("steps on a fixed timestep, so splitting frames changes nothing", () => {
			const once = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });
			const twice = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });
			for (let frame = 0; frame < 30; frame++) {
				once.update(1 / 30);
				twice.update(1 / 60);
				twice.update(1 / 60);
			}

			expect(once.getPoint(6).sub(twice.getPoint(6)).Magnitude).to.be.near(0, 1e-6);
		});

		it("holds its rest shape with stiffness", () => {
			const loose = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });
			const stiff = new VerletChain(new CFrame(0, 10, 0), LENGTHS, {
				restDirection: new Vector3(1, 0, 0),
				stiffness: 0.3,
			});
			run(loose, 2);
			run(stiff, 2);

			expect(stiff.getPoint(6).Y > loose.getPoint(6).Y + 1).to.equal(true);
			expect(largestStretch(stiff) < 0.01).to.equal(true);
		});

		it("gives each segment a frame centred on it and looking along it", () => {
			const chain = new VerletChain(new CFrame(0, 10, 0), LENGTHS, { restDirection: new Vector3(1, 0, 0) });
			const frame = chain.getSegmentCFrame(2);

			expect(frame.Position.sub(new Vector3(1.25, 10, 0)).Magnitude).to.be.near(0, 1e-6);
			expect(frame.LookVector.sub(new Vector3(1, 0, 0)).Magnitude).to.be.near(0, 1e-6);
		});

		it("needs at least one segment", () => {
			expect(() => new VerletChain(new CFrame(), [])).to.throw("at least one segment");
		});
	});
};
