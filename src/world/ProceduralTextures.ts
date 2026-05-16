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
        });
    },
    grass(scene: Scene): DynamicTexture {
        return makeTexture("proc_grass", 256, scene, (ctx, s) => {
            const r = rand(202);
            ctx.fillStyle = "#3d6a2a";
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 1200; i++) {
                const x = r() * s;
                const y = r() * s;
                const g = 60 + Math.floor(r() * 90);
                ctx.fillStyle = `rgba(${40 + Math.floor(r() * 30)},${g + 30},${30 + Math.floor(r() * 30)},0.7)`;
                ctx.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
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
        });
    },
    water(scene: Scene): DynamicTexture {
        return makeTexture("proc_water", 256, scene, (ctx, s) => {
            const r = rand(505);
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, "#3a6f99");
            grad.addColorStop(1, "#2b557d");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 60; i++) {
                ctx.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.1})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                const y = r() * s;
                ctx.moveTo(0, y);
                for (let x = 0; x <= s; x += 8) {
                    ctx.lineTo(x, y + Math.sin(x * 0.07 + i) * 2);
                }
                ctx.stroke();
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
        // DynamicTexture defaults to invertY=true, so canvas top maps to V=1 (zenith)
        // and canvas bottom to V=0 (horizon). Blue stays at the top, warm at horizon.
        const tex = makeTexture("proc_sky", 512, scene, (ctx, s) => {
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            grad.addColorStop(0, "#5fa0d8");
            grad.addColorStop(0.55, "#bcdcef");
            grad.addColorStop(1, "#f0e7c8");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
        });
        return tex;
    },
    skyStorm(scene: Scene): DynamicTexture {
        return makeTexture("proc_sky_storm", 512, scene, (ctx, s) => {
            const r = rand(606);
            const grad = ctx.createLinearGradient(0, 0, 0, s);
            // Dark stormy zenith at canvas top, lighter haze near the horizon.
            grad.addColorStop(0, "#2a323b");
            grad.addColorStop(0.55, "#4d5660");
            grad.addColorStop(1, "#8c949c");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 140; i++) {
                const x = r() * s;
                const y = r() * s;
                const radius = 40 + r() * 130;
                const alpha = 0.08 + r() * 0.22;
                const shade = 20 + Math.floor(r() * 70);
                const g2 = ctx.createRadialGradient(x, y, 0, x, y, radius);
                g2.addColorStop(0, `rgba(${shade},${shade},${shade + 10},${alpha})`);
                g2.addColorStop(1, `rgba(${shade},${shade},${shade + 10},0)`);
                ctx.fillStyle = g2;
                ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
            }
        });
    },
};
