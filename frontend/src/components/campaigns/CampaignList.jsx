import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton, MenuItem, TextField } from "@mui/material";
import {
  FiSearch,
  FiPlus,
  FiInbox,
  FiAlertCircle,
  FiRefreshCw,
  FiX,
  FiSliders,
} from "react-icons/fi";
import { listCampaigns } from "../../services/api";
import CampaignCard from "../../shared-components/CampaignCard";
import CampaignDialog from "./CampaignDialog";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "running", label: "Running" },
  { key: "pending", label: "Pending" },
  { key: "completed", label: "Completed" },
  { key: "paused", label: "Paused" },
  { key: "failed", label: "Failed" },
];

const SORTS = {
  newest: {
    label: "Newest first",
    compare: (a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0),
  },
  oldest: {
    label: "Oldest first",
    compare: (a, b) => new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0),
  },
  query: {
    label: "Query (A–Z)",
    compare: (a, b) =>
      (a.query ?? "").localeCompare(b.query ?? "", undefined, {
        sensitivity: "base",
      }),
  },
  results: {
    label: "Max results",
    compare: (a, b) => (b.max_results ?? 0) - (a.max_results ?? 0),
  },
};

export default function CampaignList() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");

  const fetch = useCallback(async () => {
    setError("");
    try {
      setCampaigns(await listCampaigns());
    } catch (err) {
      setError(err?.message || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    listCampaigns()
      .then((data) => {
        if (controller.signal.aborted) return;
        setCampaigns(data);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err?.message || "Failed to load campaigns.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const retry = useCallback(() => {
    setLoading(true);
    fetch();
  }, [fetch]);

  // Count per status drives the filter pills (computed from raw data, not the
  // filtered view, so numbers stay stable while filtering).
  const counts = useMemo(() => {
    const base = { all: campaigns.length };
    for (const c of campaigns) {
      base[c.status] = (base[c.status] ?? 0) + 1;
    }
    return base;
  }, [campaigns]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = campaigns.filter((c) => {
      const matchesStatus = status === "all" || c.status === status;
      const matchesSearch =
        !needle ||
        (c.query ?? "").toLowerCase().includes(needle) ||
        (c.name ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
    return filtered.sort(SORTS[sort].compare);
  }, [campaigns, search, status, sort]);

  const hasCampaigns = campaigns.length > 0;
  const isFiltered = search.trim() !== "" || status !== "all";

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-7 shadow-xl sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/90">
              Library
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              All Campaigns
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Browse, search, and filter every scraping campaign you have run.
            </p>
          </div>

          <CampaignDialog
            onCreated={(id) => navigate(`/campaigns/${id}`)}
            onUpdated={fetch}
            trigger={
              <button
                type="button"
                className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <FiPlus size={16} />
                New Campaign
              </button>
            }
          />
        </div>
      </header>

      {/* ── Toolbar: search + sort ──────────────────────────────────── */}
      {hasCampaigns || isFiltered ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <FiSearch
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by query or name…"
              aria-label="Search campaigns"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <FiX size={14} />
              </button>
            ) : null}
          </div>

          <TextField
            select
            size="small"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort campaigns"
            className="sm:!w-52"
            slotProps={{
              input: {
                startAdornment: (
                  <FiSliders size={14} className="mr-1.5 text-slate-400" />
                ),
              },
            }}
          >
            {Object.entries(SORTS).map(([key, { label }]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        </div>
      ) : null}

      {/* ── Status filter pills ─────────────────────────────────────── */}
      {hasCampaigns ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {FILTERS.map(({ key, label }) => {
            const active = status === key;
            const count = counts[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 ${
                  active
                    ? "bg-slate-900 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {label}
                <span
                  className={`rounded-full px-1.5 text-[0.65rem] tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ── Result summary ──────────────────────────────────────────── */}
      {hasCampaigns ? (
        <p className="mb-3 text-xs font-medium text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {visible.length}
          </span>{" "}
          of <span className="font-semibold text-slate-700">{campaigns.length}</span>{" "}
          campaign{campaigns.length === 1 ? "" : "s"}
          {isFiltered ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatus("all");
                }}
                className="font-semibold text-sky-600 underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={170}
              className="!rounded-2xl"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-500">
            <FiAlertCircle size={22} />
          </div>
          <p className="font-semibold text-rose-800">
            Couldn&apos;t load campaigns
          </p>
          <p className="mt-1 max-w-sm text-sm text-rose-600">{error}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <FiRefreshCw size={15} />
            Try again
          </button>
        </div>
      ) : !hasCampaigns ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FiInbox size={22} />
          </div>
          <p className="font-semibold text-slate-700">No campaigns yet</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Create your first campaign to start collecting leads.
          </p>
          <CampaignDialog
            onCreated={(id) => navigate(`/campaigns/${id}`)}
            onUpdated={fetch}
            trigger={
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <FiPlus size={16} />
                New Campaign
              </button>
            }
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <FiSearch size={22} />
          </div>
          <p className="font-semibold text-slate-700">No matching campaigns</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Try a different search term or clear the active filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatus("all");
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <FiX size={15} />
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((c) => (
            <CampaignCard key={c.id} campaign={c} onChanged={fetch} />
          ))}
        </div>
      )}
    </div>
  );
}

