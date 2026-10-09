import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Skeleton, Snackbar, Button } from "@mui/material";
import {
  FiArrowLeft,
  FiRefreshCw,
  FiDownload,
  FiEdit2,
  FiClock,
  FiPlayCircle,
  FiCheckCircle,
  FiXCircle,
  FiPauseCircle,
  FiHash,
  FiZap,
  FiBriefcase,
  FiMail,
  FiGlobe,
  FiMapPin,
  FiPlay,
  FiPause,
  FiStopCircle,
  FiRotateCcw,
  FiInbox,
  FiAlertCircle,
} from "react-icons/fi";
import {
  getCampaign,
  getCampaignResults,
  updateCampaignStatus,
  retryFailedLocations,
} from "../../services/api";
import { exportResultsToExcel } from "../../services/excelExport";
import CampaignProgressTable from "../../shared-components/CampaignProgressTable";
import CampaignDialog from "./CampaignDialog";

const STATUS = {
  pending: {
    label: "Pending",
    Icon: FiClock,
    chip: "bg-slate-100 text-slate-700 ring-slate-200",
    bar: "bg-slate-400",
  },
  running: {
    label: "Running",
    Icon: FiPlayCircle,
    chip: "bg-sky-50 text-sky-700 ring-sky-200",
    bar: "bg-sky-500",
  },
  completed: {
    label: "Completed",
    Icon: FiCheckCircle,
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    bar: "bg-emerald-500",
  },
  failed: {
    label: "Failed",
    Icon: FiXCircle,
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    bar: "bg-rose-500",
  },
  paused: {
    label: "Paused",
    Icon: FiPauseCircle,
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    bar: "bg-amber-500",
  },
};

function StatTile({ icon: Icon, label, value, tone }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${tone} text-white shadow-md transition-transform duration-300 group-hover:scale-105`}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-slate-500">
          {label}
        </p>
        <p className="truncate text-lg font-bold leading-tight text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([
        getCampaign(id),
        getCampaignResults(id),
      ]);
      setCampaign(c);
      setResults(Array.isArray(r) ? r : []);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [c, r] = await Promise.all([
          getCampaign(id),
          getCampaignResults(id),
        ]);
        if (!alive) return;
        setCampaign(c);
        setResults(Array.isArray(r) ? r : []);
      } catch (err) {
        if (alive)
          setError(
            err?.response?.data?.error || err?.message || "Failed to load.",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const handleExport = () => {
    if (exporting || results.length === 0 || !campaign) return;
    setExporting(true);
    try {
      const safeName = (campaign.query || "campaign")
        .replace(/[^a-zA-Z0-9-_ ]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .slice(0, 40);
      exportResultsToExcel(results, `${safeName}_campaign_${id}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
      setToast("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const changeStatus = async (next, label) => {
    const prev = campaign?.status;
    setBusy(true);
    setCampaign((c) => (c ? { ...c, status: next } : c));
    try {
      await updateCampaignStatus(id, next);
      setToast(`Status set to ${label}`);
      load();
    } catch (err) {
      setCampaign((c) => (c ? { ...c, status: prev } : c));
      setToast(err?.response?.data?.error || "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const handleRetryFailed = async () => {
    setRetrying(true);
    try {
      const res = await retryFailedLocations(id);
      setToast(
        res?.reset > 0
          ? `Re-queued ${res.reset} location${res.reset === 1 ? "" : "s"} for retry`
          : "No retryable failed locations found",
      );
      load();
    } catch (err) {
      setToast(err?.response?.data?.error || "Failed to retry locations");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <Skeleton variant="rounded" height={160} className="!rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={76}
              className="!rounded-2xl"
            />
          ))}
        </div>
        <Skeleton variant="rounded" height={260} className="!rounded-2xl" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Button
          onClick={() => navigate("/campaigns")}
          startIcon={<FiArrowLeft size={16} />}
          className="!mb-4 !text-sm !font-semibold !normal-case !text-slate-600 hover:!text-slate-900"
        >
          Back to campaigns
        </Button>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <FiAlertCircle size={22} />
          </div>
          <p className="font-semibold text-rose-800">
            Couldn&apos;t load campaign
          </p>
          <p className="mt-1 max-w-sm text-sm text-rose-600">
            {error || "Campaign not found."}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={load}
              variant="contained"
              startIcon={<FiRefreshCw size={15} />}
              className="!rounded-xl !bg-rose-600 !text-sm !font-semibold !normal-case !text-white hover:!bg-rose-700"
            >
              Try again
            </Button>
            <Button
              onClick={() => navigate("/campaigns")}
              className="!rounded-xl !text-sm !font-semibold !normal-case !text-slate-600 hover:!bg-white"
            >
              Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const status = STATUS[campaign.status] ?? STATUS.pending;
  const { Icon: StatusIcon } = status;
  const progress = campaign.progress || {};
  const total = progress.total || 0;
  const completed = progress.completed || 0;
  const failed = progress.failed || 0;
  const businesses = progress.businesses ?? results.length;
  const pct = total > 0 ? Math.min((completed / total) * 100, 100) : 0;
  const isLive = campaign.status === "running" || campaign.status === "pending";

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* ── Back ─────────────────────────────────────────────────────── */}
      <Button
        onClick={() => navigate("/campaigns")}
        startIcon={<FiArrowLeft size={16} />}
        className="!mb-4 !text-sm !font-semibold !normal-case !text-slate-600 hover:!text-slate-900"
      >
        Back to campaigns
      </Button>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-7 shadow-xl sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ring-1 ring-inset ${status.chip}`}
              >
                <StatusIcon size={12} />
                {status.label}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-semibold text-slate-200 ring-1 ring-inset ring-white/15">
                ID #{campaign.id}
              </span>
            </div>

            <h1 className="mt-3 truncate text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {campaign.query}
            </h1>
            <p className="mt-1 truncate text-sm text-slate-300">
              {campaign.name}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={load}
              startIcon={<FiRefreshCw size={15} />}
              className="!rounded-xl !bg-white/10 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !ring-1 !ring-inset !ring-white/15 hover:!bg-white/20"
            >
              Refresh
            </Button>

            <Button
              onClick={() => setEditOpen(true)}
              startIcon={<FiEdit2 size={15} />}
              className="!rounded-xl !bg-white/10 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !ring-1 !ring-inset !ring-white/15 hover:!bg-white/20"
            >
              Edit
            </Button>

            {campaign.status === "running" ? (
              <Button
                disabled={busy}
                onClick={() => changeStatus("paused", "Paused")}
                startIcon={<FiPause size={15} />}
                className="!rounded-xl !bg-amber-500 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !shadow-lg hover:!bg-amber-600 disabled:!opacity-60"
              >
                Pause
              </Button>
            ) : (
              <Button
                disabled={busy}
                onClick={() => changeStatus("running", "Running")}
                startIcon={<FiPlay size={15} />}
                className="!rounded-xl !bg-sky-600 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !shadow-lg hover:!bg-sky-700 disabled:!opacity-60"
              >
                {campaign.status === "paused" ? "Resume" : "Start"}
              </Button>
            )}

            {campaign.status !== "completed" ? (
              <Button
                disabled={busy}
                onClick={() => changeStatus("completed", "Completed")}
                startIcon={<FiStopCircle size={15} />}
                className="!rounded-xl !bg-emerald-600 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !shadow-lg hover:!bg-emerald-700 disabled:!opacity-60"
              >
                Complete
              </Button>
            ) : null}

            {failed > 0 ? (
              <Button
                disabled={retrying}
                onClick={handleRetryFailed}
                startIcon={
                  retrying ? (
                    <FiRefreshCw size={15} className="animate-spin" />
                  ) : (
                    <FiRotateCcw size={15} />
                  )
                }
                className="!rounded-xl !bg-rose-600 !px-3.5 !py-2 !text-sm !font-semibold !normal-case !text-white !shadow-lg hover:!bg-rose-700 disabled:!opacity-60"
              >
                {retrying ? "Retrying…" : `Retry failed (${failed})`}
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── Stat tiles ───────────────────────────────────────────────── */}
      <section
        aria-label="Campaign stats"
        className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatTile
          icon={FiBriefcase}
          label="Businesses"
          value={businesses.toLocaleString()}
          tone="from-emerald-500 to-green-600"
        />
        <StatTile
          icon={FiMapPin}
          label="Locations"
          value={`${completed} / ${total}`}
          tone="from-sky-500 to-blue-600"
        />
        <StatTile
          icon={FiHash}
          label="Max results"
          value={campaign.max_results ?? "—"}
          tone="from-violet-500 to-purple-600"
        />
        <StatTile
          icon={FiZap}
          label="Delay"
          value={`${campaign.delay_ms ?? "—"} ms`}
          tone="from-amber-500 to-orange-600"
        />
      </section>

      {/* ── Progress ─────────────────────────────────────────────────── */}
      <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <FiRefreshCw size={13} className={isLive ? "animate-spin" : ""} />
            {isLive ? "Live progress" : "Progress"}
          </p>
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
            {failed > 0 ? (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={retrying}
                title="Re-queue locations that timed out or had DNS errors"
                className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-100 disabled:opacity-60"
              >
                <FiRotateCcw
                  size={12}
                  className={retrying ? "animate-spin" : ""}
                />
                {failed} failed — retry
              </button>
            ) : null}
            <span>
              Email required:{" "}
              <span className="font-semibold text-slate-700">
                {campaign.email_required ? "Yes" : "No"}
              </span>
            </span>
          </div>
        </div>

        <div className="mb-2 flex items-end justify-between">
          <span className="text-2xl font-bold tabular-nums text-slate-900">
            {pct.toFixed(0)}%
          </span>
          <span className="text-xs font-medium text-slate-500">
            {completed} of {total} locations completed
          </span>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${status.bar} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {campaign.email_concurrency ? (
          <p className="mt-3 text-xs text-slate-400">
            Email concurrency: {campaign.email_concurrency}
          </p>
        ) : null}
      </section>

      {/* ── Location progress ────────────────────────────────────────── */}
      <section className="mb-6">
        <CampaignProgressTable
          campaignId={parseInt(id, 10)}
          refreshInterval={campaign.status === "running" ? 3000 : 0}
        />
      </section>

      {/* ── Results ──────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Scraped Results
            </h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {results.length}
            </span>
          </div>

          <Button
            onClick={handleExport}
            disabled={exporting || results.length === 0}
            startIcon={
              exporting ? (
                <FiRefreshCw size={15} className="animate-spin" />
              ) : (
                <FiDownload size={15} />
              )
            }
            className="!rounded-xl !bg-emerald-600 !px-4 !py-2 !text-sm !font-semibold !normal-case !text-white !shadow-sm hover:!bg-emerald-700 disabled:!cursor-not-allowed disabled:!opacity-60"
          >
            {exporting ? "Preparing…" : "Export Excel"}
          </Button>
        </div>

        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <FiInbox size={22} />
            </div>
            <p className="font-semibold text-slate-700">No results yet</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Scraped businesses will appear here as the campaign progresses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
                  {[
                    "Name",
                    "Rating",
                    "Reviews",
                    "Category",
                    "Phone",
                    "Email",
                    "Website",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-2.5 text-[0.7rem] font-bold uppercase tracking-wide text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((b) => (
                  <tr
                    key={b.id}
                    className="border-b border-slate-100 transition last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="max-w-[220px] truncate px-4 py-2.5 font-medium text-slate-900">
                      {b.name || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {b.rating ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {b.reviews ?? "—"}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-2.5 text-slate-600">
                      {b.category || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {b.phone || "—"}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5">
                      {b.email ? (
                        <a
                          href={`mailto:${b.email}`}
                          className="inline-flex items-center gap-1 text-sky-600 transition hover:text-sky-800 hover:underline"
                        >
                          <FiMail size={13} />
                          {b.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {b.website ? (
                        <a
                          href={b.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-sky-600 transition hover:text-sky-800 hover:underline"
                        >
                          <FiGlobe size={13} />
                          Visit
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Edit dialog ──────────────────────────────────────────────── */}
      {editOpen ? (
        <CampaignDialog
          campaignId={parseInt(id, 10)}
          campaign={campaign}
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onUpdated={() => {
            setEditOpen(false);
            setToast("Campaign updated");
            load();
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
    </div>
  );
}

