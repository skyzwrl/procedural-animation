/// <reference types="@rbxts/testez/globals" />

import { CriticalSpring } from "../spring";

export = () => {
	describe("CriticalSpring", () => {
		it("settles on the target without overshooting", () => {
			const spring = new CriticalSpring(10, 0);
			let previous = 0;
			for (let frame = 0; frame < 120; frame++) {
				const position = spring.update(1, 1 / 60);
				expect(position >= previous && position <= 1).to.equal(true);
				previous = position;
			}

			expect(spring.position).to.be.near(1, 1e-6);
		});

		it("gives the same answer for one big step or many small ones", () => {
			const big = new CriticalSpring(8, 2);
			const small = new CriticalSpring(8, 2);
			big.velocity = -3;
			small.velocity = -3;

			big.update(5, 0.5);
			for (let step = 0; step < 50; step++) {
				small.update(5, 0.01);
			}

			expect(small.position).to.be.near(big.position, 1e-6);
			expect(small.velocity).to.be.near(big.velocity, 1e-6);
		});

		it("carries velocity before coming back", () => {
			const spring = new CriticalSpring(6, 0);
			spring.velocity = 10;
			spring.update(0, 0.1);
			expect(spring.position > 0.3).to.equal(true);

			spring.update(0, 5);
			expect(spring.position).to.be.near(0, 1e-6);
		});
	});
};
