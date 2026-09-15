import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import type { Scene } from "@babylonjs/core/scene";

// Deterministic seeded noise so visuals are stable.
function rand(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
}

function makeTexture(name: string, size: number, scene: Scene, draw: (ctx: CanvasRenderingContext2D, size: number) => void): DynamicTexture {
    const tex = new DynamicTexture(name, { width: size, height: size }, scene, false);
    tex.hasAlpha = false;
    const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
    draw(ctx, size);
    tex.update(false);
    return tex;
}

export const ProceduralTextures = {
    wood(scene: Scene): DynamicTexture {
        return makeTexture("proc_wood", 256, scene, (ctx, s) => {
            const r = rand(101);
            ctx.fillStyle = "#6b4a2a";
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < s; i += 2) {
                const v = 30 + Math.floor(r() * 40);
                ctx.fillStyle = `rgba(${60 + v},${40 + v / 2},${20 + v / 3},0.55)`;
                ctx.fillRect(0, i, s, 1 + Math.floor(r() * 2));
            }
            for (let i = 0; i < 12; i++) {
                ctx.strokeStyle = "rgba(40,25,10,0.5)";
                ctx.lineWidth = 1 + r() * 2;
                ctx.beginPath();
                const y = r() * s;
                ctx.moveTo(0, y);
                ctx.bezierCurveTo(s / 3, y + (r() - 0.5) * 10, (2 * s) / 3, y + (r() - 0.5) * 10, s, y + (r() - 0.5) * 8);
                ctx.stroke();
            }
            // Knots: dark ring around a lighter core, kept off the tile edges
            // so tiling never slices one in half.
            for (let i = 0; i < 5; i++) {
                const kx = 30 + r() * (s - 60);
                const ky = 30 + r() * (s - 60);
                const kr = 4 + r() * 7;
                const knot = ctx.createRadialGradient(kx, ky, 1, kx, ky, kr);
                knot.addColorStop(0, "rgba(150,110,70,0.9)");
                knot.addColorStop(0.55, "rgba(90,60,35,0.85)");
                knot.addColorStop(1, "rgba(60,38,18,0)");
                ctx.fillStyle = knot;
                ctx.beginPath();
                ctx.ellipse(kx, ky, kr, kr * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    },
    grass(scene: Scene): DynamicTexture {
        return makeTexture("proc_grass", 256, scene, (ctx, s) => {
            const r = rand(202);
            ctx.fillStyle = "#3d6a2a";
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 800; i++) {
                const x = r() * s;
                const y = r() * s;
                const g = 60 + Math.floor(r() * 90);
                ctx.fillStyle = `rgba(${40 + Math.floor(r() * 30)},${g + 30},${30 + Math.floor(r() * 30)},0.7)`;
                ctx.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
            }
            // Blade strokes: short lines leaning with the prevailing wind, in
            // varied greens (plus a few dry yellow ones) so the field reads as
            // grass rather than green static.
            for (let i = 0; i < 600; i++) {
                const x = r() * s;
                const y = r() * s;
                const len = 3 + r() * 5;
                const lean = (r() - 0.5) * 0.9;
                const dry = r() < 0.08;
                const g = dry ? 150 + Math.floor(r() * 40) : 90 + Math.floor(r() * 80);
                ctx.strokeStyle = dry
                    ? `rgba(${170 + Math.floor(r() * 30)},${g},60,0.65)`
                    : `rgba(${30 + Math.floor(r() * 30)},${g},${35 + Math.floor(r() * 25)},0.65)`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + lean * len, y - len);
                ctx.stroke();
            }
        });
    },
    rock(scene: Scene): DynamicTexture {
        return makeTexture("proc_rock", 256, scene, (ctx, s) => {
            const r = rand(303);
            ctx.fillStyle = "#6b6b6b";
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 600; i++) {
                const g = 60 + Math.floor(r() * 120);
                ctx.fillStyle = `rgba(${g},${g},${g},0.6)`;
                ctx.beginPath();
                ctx.arc(r() * s, r() * s, 1 + r() * 6, 0, Math.PI * 2);
                ctx.fill();
            }
            // Warm mineral patches so large rock faces are not pure grey.
            for (let i = 0; i < 90; i++) {
                ctx.fillStyle = `rgba(${95 + Math.floor(r() * 30)},${82 + Math.floor(r() * 22)},${68 + Math.floor(r() * 18)},0.14)`;
                ctx.beginPath();
                ctx.arc(r() * s, r() * s, 8 + r() * 26, 0, Math.PI * 2);
                ctx.fill();
            }
            // Quartz flecks catch the light.
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = `rgba(215,215,220,${0.25 + r() * 0.3})`;
                ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r() * 2);
            }
            for (let i = 0; i < 50; i++) {
                ctx.strokeStyle = `rgba(30,30,30,${0.2 + r() * 0.3})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(r() * s, r() * s);
                ctx.lineTo(r() * s, r() * s);
                ctx.stroke();
            }
        });
    },
    sand(scene: Scene): DynamicTexture {
        return makeTexture("proc_sand", 256, scene, (ctx, s) => {
            const r = rand(404);
            ctx.fillStyle = "#dec98c";
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 4000; i++) {
                const v = Math.floor(r() * 60);
                ctx.fillStyle = `rgba(${180 + v},${160 + v},${110 + v},${0.3 + r() * 0.4})`;
                ctx.fillRect(r() * s, r() * s, 1, 1);
            }
            // Wind ripples: whole-number sine periods so the lines wrap
            // seamlessly when the tile repeats across the beach.
            for (let i = 0; i < 9; i++) {
                const y0 = r() * s;
                const amp = 2 + r() * 4;
                const periods = 2 + Math.floor(r() * 4);
                const phase = r() * Math.PI * 2;
                ctx.strokeStyle = r() < 0.5
                    ? `rgba(120,100,60,${0.12 + r() * 0.12})`
                    : `rgba(245,230,185,${0.12 + r() * 0.12})`;
                ctx.lineWidth = 1 + r() * 1.5;
                ctx.beginPath();
                for (let x = 0; x <= s; x += 4) {
                    const y = y0 + Math.sin((x / s) * Math.PI * 2 * periods + phase) * amp;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            // Scattered shell grit.
            for (let i = 0; i < 26; i++) {
                ctx.fillStyle = `rgba(${150 + Math.floor(r() * 40)},${135 + Math.floor(r() * 35)},${105 + Math.floor(r() * 30)},${0.5 + r() * 0.3})`;
                ctx.fillRect(r() * s, r() * s, 1 + r() * 2, 1 + r());
            }
        });
    },
    water(scene: Scene): DynamicTexture {
        return makeTexture("proc_water", 256, scene, (ctx, s) => {
            const r = rand(505);
            // Flat base (a vertical gradient would band hard when v-tiled).
            ctx.fillStyle = "#2f6288";
            ctx.fillRect(0, 0, s, s);
            // Wave highlight lines with whole-number sine periods (tile-safe).
            for (let i = 0; i < 90; i++) {
                const y0 = r() * s;
                const amp = 1.5 + r() * 3;
                const periods = 1 + Math.floor(r() * 5);
                const phase = r() * Math.PI * 2;
                ctx.strokeStyle = `rgba(${190 + Math.floor(r() * 50)},${215 + Math.floor(r() * 35)},235,${0.06 + r() * 0.16})`;
                ctx.lineWidth = 1 + r();
                ctx.beginPath();
                for (let x = 0; x <= s; x += 6) {
                    const y = y0 + Math.sin((x / s) * Math.PI * 2 * periods + phase) * amp;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }
            // Sparkle flecks.
            for (let i = 0; i < 120; i++) {
                ctx.fillStyle = `rgba(235,245,250,${0.15 + r() * 0.25})`;
                ctx.fillRect(r() * s, r() * s, 1, 1 + r());
            }
        });
    },
    radialFlare(scene: Scene): DynamicTexture {
        const tex = makeTexture("proc_flare", 64, scene, (ctx, s) => {
            const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            grad.addColorStop(0, "rgba(255,255,255,1)");
            grad.addColorStop(0.5, "rgba(255,255,255,0.4)");
            grad.addColorStop(1, "rgba(255,255,255,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
        });
        tex.hasAlpha = true;
        return tex;
    },
    fireParticle(scene: Scene): DynamicTexture {
        const tex = makeTexture("proc_fire", 64, scene, (ctx, s) => {
            const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            grad.addColorStop(0, "rgba(255,240,180,1)");
            grad.addColorStop(0.4, "rgba(255,140,40,0.7)");
            grad.addColorStop(1, "rgba(200,40,0,0)");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
        });
        tex.hasAlpha = true;
        return tex;
    },
    skyGradient(scene: Scene): DynamicTexture {
        const tex = makeTexture("proc_sky", 512, scene, (ctx, s) => {
            // Deeper zenith + warmer horizon band: DayNightCycle multiplies this
            // with an emissive tint for night/dawn/storm skies.
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, "#5f9fd8");
            grad.addColorStop(0.45, "#a8d2ec");
            grad.addColorStop(0.78, "#dceaf0");
            grad.addColorStop(1, "#f2e3bd");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
        });
        return tex;
    },
};
