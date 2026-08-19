/**
 * Decorative orange sparkline. The shape is derived from `seed` so the same
 * card draws the same line on the server and on the client.
 */
export function Sparkline({ seed }: { seed: number }) {
  const points: string[] = [];

  for (let i = 0; i < 9; i++) {
    const x = (i * 100) / 8;
    const y = 6 + ((Math.sin(seed + i * 1.1) + 1) / 2) * 20;
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  return (
    <svg
      viewBox="0 0 100 34"
      preserveAspectRatio="none"
      aria-hidden
      className="h-[34px] w-full"
    >
      <path
        d={`M0 28 L${points.join(" L")}`}
        fill="none"
        stroke="var(--color-orange)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
