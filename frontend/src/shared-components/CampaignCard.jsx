import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, MenuItem, Divider, Snackbar, IconButton } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  FiClock,
  FiPlayCircle,
  FiCheckCircle,
  FiXCircle,
  FiPauseCircle,
  FiUsers,
  FiHash,
  FiZap,
  FiChevronRight,
  FiEdit2,
  FiPlay,
  FiPause,
  FiStopCircle,
} from "react-icons/fi";
import CampaignDialog from "../components/campaigns/CampaignDialog";
import { updateCampaignStatus } from "../services/api";

// Each status gets a semantic accent: chip, icon, progress bar and hover glow
// all derive from this single tone so the card reads as one coherent unit.
const STATUS = {
  pending: {
    label: "Pending",
    Icon: FiClock,
    chip: "bg-slate-100 text-slate-600 ring-slate-200",
    accent: "from-slate-400 to-slate-500",
    bar: "bg-slate-400",
    glow: "hover:shadow-slate-500/10",
    dot: "bg-slate-400",
  },
  running: {
    label: "Running",
    Icon: FiPlayCircle,
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    accent: "from-sky-500 to-blue-600",
    bar: "bg-sky-500",
    glow: "hover:shadow-sky-500/20",
    dot: "bg-sky-500",
  },
  completed: {
    label: "Completed",
    Icon: FiCheckCircle,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "from-emerald-500 to-green-600",
    bar: "bg-emerald-500",
    glow: "hover:shadow-emerald-500/20",
    dot: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    Icon: FiXCircle,
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    accent: "from-rose-500 to-red-600",
    bar: "bg-rose-500",
    glow: "hover:shadow-rose-500/20",
    dot: "bg-rose-500",
  },
  paused: {
    label: "Paused",
    Icon: FiPauseCircle,
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    accent: "from-amber-500 to-orange-600",
    bar: "bg-amber-500",
    glow: "hover:shadow-amber-500/20",
    dot: "bg-amber-500",
  },
};

function formatNumber(n) {
  return typeof n === "number" ? n.toLocaleString() : "—";
}

export default function CampaignCard({ campaign, onChanged }) {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [status, setStatus] = useState(campaign.status ?? "pending");
  const [toast, setToast] = useState("");
  const [editOpen, setEditOpen] = useState(false);

  const status_ = STATUS[status] ?? STATUS.pending;
  const { Icon } = status_;

  const progress = campaign.progress;
  const hasProgress = progress && progress.total > 0;
  const pct = hasProgress
    ? Math.min((progress.completed / progress.total) * 100, 100)
    : 0;

  const stop = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const changeStatus = async (next, label) => {
    setMenuAnchor(null);
    const prev = status;
    setStatus(next);
    try {
      await updateCampaignStatus(campaign.id, next);
      setToast(`Status set to ${label}`);
      onChanged?.();
    } catch (err) {
      setStatus(prev);
      setToast(err?.response?.data?.error || "Failed to update status");
    }
  };

  const menuOpen = Boolean(menuAnchor);

  return (
    <>
      <article
        role="link"
        tabIndex={0}
        aria-label={`${campaign.query} — ${status_.label}`}
        onClick={() => navigate(`/campaigns/${campaign.id}`)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            navigate(`/campaigns/${campaign.id}`);
          }
        }}
        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 ${status_.glow}`}
      >
        {/* top accent line */}
        <div
          className={`absolute inset-x-0 top-0 h-1 bg-linear-to-r ${status_.accent} opacity-70 transition-opacity duration-300 group-hover:opacity-100`}
        />

        {/* ── header: query + status chip + menu ──────────────────────── */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-900">
            {campaign.query}
          </h3>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold ring-1 ring-inset ${status_.chip}`}
          >
            <Icon size={11} />
            {status_.label}
          </span>
          <IconButton
            aria-label="Campaign actions"
            size="small"
            onClick={(e) => {
              stop(e);
              setMenuAnchor(e.currentTarget);
            }}
            className="-mr-1.5 -mt-1 shrink-0 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </div>

      {/* ── name ─────────────────────────────────────────────────────── */}
      <p className="mt-1 truncate text-xs text-slate-500">{campaign.name}</p>

      {/* ── progress (only when the API provides it) ─────────────────── */}
      {hasProgress ? (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[0.68rem] font-medium text-slate-500">
            <span>
              {progress.completed}/{progress.total} locations
            </span>
            <span className="tabular-nums">{pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${status_.bar} transition-all duration-500`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* ── meta row ─────────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-slate-500">
        <span className="inline-flex items-center gap-1">
          <FiHash size={12} className="text-slate-400" />
          {formatNumber(campaign.max_results)}
        </span>
        <span className="inline-flex items-center gap-1">
          <FiZap size={12} className="text-slate-400" />
          {formatNumber(campaign.delay_ms)}ms
        </span>
        {hasProgress ? (
          <span className="inline-flex items-center gap-1">
            <FiUsers size={12} className="text-slate-400" />
            {formatNumber(progress.businesses)}
          </span>
        ) : null}
        {campaign.email_required ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
            Email required
          </span>
        ) : null}
      </div>

      {/* ── footer affordance ────────────────────────────────────────── */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <span className="inline-flex items-center gap-1.5 text-[0.7rem] font-medium text-slate-400">
          <span className={`h-1.5 w-1.5 rounded-full ${status_.dot}`} />
          ID #{campaign.id}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[0.7rem] font-semibold text-sky-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          View details
          <FiChevronRight size={13} />
        </span>
      </div>
      </article>

      {/* ── Actions menu ─────────────────────────────────────────────── */}
      <Menu
        open={menuOpen}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{ paper: { className: "!rounded-xl !shadow-xl !min-w-44 !mt-1" } }}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setEditOpen(true);
          }}
          className="!gap-2 !text-sm"
        >
          <FiEdit2 size={15} className="text-slate-500" />
          Edit campaign
        </MenuItem>
        <Divider className="!my-1" />
        {status === "running" ? (
          <MenuItem
            onClick={() => changeStatus("paused", "Paused")}
            className="!gap-2 !text-sm"
          >
            <FiPause size={15} className="text-amber-500" />
            Pause
          </MenuItem>
        ) : (
          <MenuItem
            onClick={() => changeStatus("running", "Running")}
            className="!gap-2 !text-sm"
          >
            <FiPlay size={15} className="text-sky-500" />
            Start / Resume
          </MenuItem>
        )}
        {status !== "completed" ? (
          <MenuItem
            onClick={() => changeStatus("completed", "Completed")}
            className="!gap-2 !text-sm"
          >
            <FiStopCircle size={15} className="text-emerald-500" />
            Mark completed
          </MenuItem>
        ) : null}
      </Menu>

      {/* ── Edit dialog (self-managed) ───────────────────────────────── */}
      {editOpen ? (
        <CampaignDialog
          campaignId={campaign.id}
          campaign={campaign}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            setEditOpen(false);
            setToast("Campaign updated");
            onChanged?.();
          }}
        />
      ) : null}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}

