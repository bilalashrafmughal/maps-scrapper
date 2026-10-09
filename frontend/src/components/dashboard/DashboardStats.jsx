import { useState, useEffect, useCallback } from "react";
import { Typography, Skeleton, Chip } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import {
  FiTarget,
  FiMapPin,
  FiBriefcase,
  FiActivity,
  FiArrowRight,
  FiPlus,
  FiInbox,
} from "react-icons/fi";
import { getStats, listCampaigns } from "../../services/api";
import CampaignCard from "../../shared-components/CampaignCard";
import StatCard from "../../shared-components/StatCard";
import CampaignDialog from "../campaigns/CampaignDialog";

export default function DashboardStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentCampaigns, setRecentCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [statsRes, campaignsRes] = await Promise.allSettled([
      getStats(),
      listCampaigns(),
    ]);
    if (statsRes.status === "fulfilled") setStats(statsRes.value);
    if (campaignsRes.status === "fulfilled") {
      setRecentCampaigns(campaignsRes.value.slice(0, 4));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [statsRes, campaignsRes] = await Promise.allSettled([
        getStats(),
        listCampaigns(),
      ]);
      if (!alive) return;
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (campaignsRes.status === "fulfilled") {
        setRecentCampaigns(campaignsRes.value.slice(0, 4));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const activeCount = recentCampaigns.filter(
    (c) => c.status === "running",
  ).length;

  const tiles = [
    {
      label: "Campaigns",
      value: stats?.campaigns,
      icon: FiTarget,
      tone: "blue",
      hint: "Total created",
    },
    {
      label: "Businesses",
      value: stats?.businesses,
      icon: FiBriefcase,
      tone: "emerald",
      hint: "Scraped leads",
    },
    {
      label: "Locations",
      value: stats?.locations,
      icon: FiMapPin,
      tone: "amber",
      hint: "Across all campaigns",
    },
    {
      label: "Active Now",
      value: activeCount,
      icon: FiActivity,
      tone: "violet",
      hint: "Currently running",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl">
      {/* ── Hero header ─────────────────────────────────────────────── */}
      <header className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-blue-900 px-6 py-7 shadow-xl sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-sky-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-violet-500/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Typography className="text-xs! font-semibold! uppercase! tracking-[0.2em]! text-sky-300/90!">
              Overview
            </Typography>
            <Typography
              variant="h4"
              className="mt-1! font-bold! tracking-tight! text-white!"
            >
              Dashboard
            </Typography>
            <Typography className="mt-2! max-w-xl! text-sm! text-slate-300!">
              Track scraping campaigns, monitor live progress, and jump straight
              into the results that matter.
            </Typography>
          </div>

          <CampaignDialog
            onCreated={(id) => navigate(`/campaigns/${id}`)}
            onUpdated={load}
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

      {/* ── Stat tiles ──────────────────────────────────────────────── */}
      <section
        aria-label="Key metrics"
        className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {tiles.map((tile) => (
          <StatCard key={tile.label} {...tile} loading={loading} />
        ))}
      </section>

      {/* ── Recent campaigns ────────────────────────────────────────── */}
      <section aria-label="Recent campaigns">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Typography
              variant="h6"
              className="font-semibold! tracking-tight! text-slate-900!"
            >
              Recent Campaigns
            </Typography>
            {recentCampaigns.length > 0 ? (
              <Chip
                size="small"
                label={recentCampaigns.length}
                className="h-5! bg-slate-100! text-xs! font-semibold! text-slate-600!"
              />
            ) : null}
          </div>

          <Link
            to="/campaigns"
            className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 transition hover:text-sky-800"
          >
            View all
            <FiArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={150}
                className="rounded-2xl!"
              />
            ))}
          </div>
        ) : recentCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl! border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100! text-slate-400!">
              <FiInbox size={22} />
            </div>
            <Typography className="font-semibold! text-slate-700!">
              No campaigns yet
            </Typography>
            <Typography className="mt-1! text-sm! text-slate-500!">
              Create your first campaign to start collecting leads.
            </Typography>
            <CampaignDialog
              onCreated={(id) => navigate(`/campaigns/${id}`)}
              onUpdated={load}
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
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {recentCampaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} onChanged={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

