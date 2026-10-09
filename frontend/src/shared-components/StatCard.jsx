import { Paper, Typography, Skeleton } from "@mui/material";
import useCountUp from "../hooks/useCountUp";

/**
 * Modern stat tile: gradient icon badge, animated value, hover lift.
 * `tone` drives the accent gradient so multiple cards stay visually distinct.
 */
export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue",
  loading = false,
  hint,
}) {
  const isNumber = typeof value === "number";
  const animated = useCountUp(isNumber ? value : 0);

  const tones = {
    blue: {
      badge: "from-sky-500 to-blue-600",
      glow: "group-hover:shadow-sky-500/20",
      ring: "ring-sky-500/10",
      text: "text-sky-600",
    },
    emerald: {
      badge: "from-emerald-500 to-green-600",
      glow: "group-hover:shadow-emerald-500/20",
      ring: "ring-emerald-500/10",
      text: "text-emerald-600",
    },
    amber: {
      badge: "from-amber-500 to-orange-600",
      glow: "group-hover:shadow-amber-500/20",
      ring: "ring-amber-500/10",
      text: "text-amber-600",
    },
    violet: {
      badge: "from-violet-500 to-purple-600",
      glow: "group-hover:shadow-violet-500/20",
      ring: "ring-violet-500/10",
      text: "text-violet-600",
    },
  };

  const theme = tones[tone] ?? tones.blue;

  return (
    <Paper
      elevation={0}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${theme.glow}`}
    >
      {/* soft corner accent */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-linear-to-br ${theme.badge} opacity-[0.08] blur-2xl transition-opacity duration-300 group-hover:opacity-20`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Typography
            variant="overline"
            className="text-[0.68rem]! font-semibold! tracking-[0.14em]! text-slate-500!"
          >
            {label}
          </Typography>

          {loading ? (
            <Skeleton width={70} height={42} />
          ) : (
            <Typography className="mt-1! text-3xl! font-bold! leading-none! tracking-tight! text-slate-900! sm:text-4xl!">
              {isNumber ? animated.toLocaleString() : value ?? "—"}
            </Typography>
          )}

          {hint ? (
            <Typography
              variant="caption"
              className="mt-1! block text-slate-400!"
            >
              {hint}
            </Typography>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${theme.badge} text-white shadow-lg ring-4 ${theme.ring} transition-transform duration-300 group-hover:scale-110`}
        >
          {Icon ? <Icon size={20} /> : null}
        </div>
      </div>
    </Paper>
  );
}
