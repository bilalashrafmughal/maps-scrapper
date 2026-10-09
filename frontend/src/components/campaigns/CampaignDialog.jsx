import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  Slider,
  CircularProgress,
} from "@mui/material";
import {
  FiPlus,
  FiEdit2,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiTarget,
  FiSliders,
  FiGlobe,
} from "react-icons/fi";
import {
  createCampaign,
  updateCampaign,
  getCampaign,
} from "../../services/api";
import LocationPicker from "./LocationPicker";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "running", label: "Running" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const EMPTY = {
  query: "",
  maxResults: 50,
  delay: 1000,
  emailConcurrency: 3,
  emailRequired: false,
  status: "pending",
};

/**
 * Create/edit campaign dialog.
 *
 * Modes:
 *  - create: pass `onCreated(id)` (optional). No `campaignId`.
 *  - edit:   pass `campaignId` and `campaign` (may be a list row).
 *
 * Trigger:
 *  - Controlled: pass `open` + `onClose`.
 *  - Self-managed: omit them and render `trigger` (or the default button).
 */
export default function CampaignDialog({
  campaignId = null,
  campaign = null,
  open: openProp,
  onClose: onCloseProp,
  onCreated,
  onUpdated,
  trigger = null,
}) {
  const isEdit = Boolean(campaignId);
  const isControlled = openProp !== undefined;

  const [openState, setOpenState] = useState(false);
  const open = isControlled ? openProp : openState;
  const setOpen = (v) => (isControlled ? onCloseProp?.(v) : setOpenState(v));

  const [form, setForm] = useState(EMPTY);
  const [locations, setLocations] = useState([]);
  // Snapshot of locations already persisted for this campaign (from the API).
  // Used to send only newly-added locations on save.
  const [existingLocations, setExistingLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Tracks the last "open session" we seeded, so the effect only runs once per
  // open (and can seed asynchronously without a synchronous setState warning).
  const seededFor = useRef(null);

  const seedFrom = useCallback(
    (data) => {
      setForm(
        data
          ? {
              query: data.query ?? "",
              maxResults: data.max_results ?? 50,
              delay: data.delay_ms ?? 1000,
              emailConcurrency: data.email_concurrency ?? 3,
              emailRequired: Boolean(data.email_required),
              status: data.status ?? "pending",
            }
          : EMPTY,
      );
      const seeded = data?.locations ?? [];
      setLocations(seeded);
      setExistingLocations(seeded);
      setError("");
    },
    [],
  );

  // Seed the form whenever the dialog opens.
  useEffect(() => {
    if (!open) {
      seededFor.current = null;
      return;
    }

    const key = isEdit ? `edit:${campaignId}` : "create";
    if (seededFor.current === key) return;
    seededFor.current = key;

    // Create mode, or edit with an already-hydrated campaign object.
    // Deferred to a microtask so the seed never runs during the effect's
    // synchronous commit phase.
    if (!isEdit || (campaign && campaign.locations)) {
      queueMicrotask(() => seedFrom(isEdit ? campaign : null));
      return;
    }

    // `alive` is scoped per run so StrictMode's mount→unmount→mount cycle
    // cannot leave the first fetch abandoned while the second run skips it.
    let alive = true;
    queueMicrotask(() => {
      if (alive) setLoading(true);
    });
    getCampaign(campaignId)
      .then((data) => {
        if (alive) seedFrom(data);
      })
      .catch((err) => alive && setError(err?.message || "Failed to load."))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
      // Allow the effect to re-seed on StrictMode's remount.
      if (seededFor.current === key) seededFor.current = null;
    };
  }, [open, isEdit, campaignId, campaign, seedFrom]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  // Locations the user picked that are not already persisted for this campaign.
  // Compared by the `location` string (the natural key used across the app).
  const existingKeys = useMemo(
    () => new Set(existingLocations.map((l) => l.location)),
    [existingLocations],
  );
  const newLocations = useMemo(
    () => locations.filter((l) => !existingKeys.has(l.location)),
    [locations, existingKeys],
  );

  const handleSubmit = async () => {
    setError("");
    if (!form.query.trim()) return setError("Enter a search query.");
    if (locations.length === 0) return setError("Add at least one location.");
    if (isEdit && newLocations.length === 0) {
      return setError(
        "Nothing to add — every selected location already exists in this campaign.",
      );
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        // Only newly-added locations are sent; existing ones stay untouched.
        await updateCampaign(campaignId, {
          query: form.query.trim(),
          locations: newLocations,
          maxResults: form.maxResults,
          delayBetweenRequests: form.delay,
          emailConcurrency: form.emailConcurrency,
          emailRequired: form.emailRequired,
        });
        onUpdated?.();
      } else {
        const result = await createCampaign({
          query: form.query.trim(),
          locations,
          maxResults: form.maxResults,
          delayBetweenRequests: form.delay,
          emailConcurrency: form.emailConcurrency,
          emailRequired: form.emailRequired,
        });
        onCreated?.(result?.id);
      }
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.error || err?.message || "Something failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const defaultTrigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg transition-transform hover:-translate-y-0.5 hover:bg-slate-100"
    >
      <FiPlus size={16} />
      New Campaign
    </button>
  );

  return (
    <>
      {isControlled
        ? null
        : trigger
          ? (
            <span
              className="contents"
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
            >
              {trigger}
            </span>
          )
          : defaultTrigger}

      <Dialog
        open={open}
        onClose={submitting ? undefined : () => setOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { className: "!rounded-2xl" } }}
      >
        <DialogTitle className="!flex !items-center !justify-between !gap-3 !border-b !border-slate-100 !px-6 !py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-md">
              {isEdit ? <FiEdit2 size={16} /> : <FiPlus size={16} />}
            </span>
            <div>
              <p className="text-base font-bold leading-tight text-slate-900">
                {isEdit ? "Edit Campaign" : "New Campaign"}
              </p>
              <p className="text-xs font-normal text-slate-500">
                {isEdit
                  ? "Update the query, filters or target locations."
                  : "Define a query and pick the locations to scrape."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={submitting}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <FiX size={18} />
          </button>
        </DialogTitle>

        <DialogContent className="!px-6 !py-5">
          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              <FiAlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <CircularProgress size={28} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* ── Left: campaign settings ─────────────────────────── */}
              <section className="flex flex-col gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <FiTarget size={13} />
                    Campaign
                  </p>

                  <TextField
                    label="Search query"
                    placeholder="e.g. plumbers, coffee shops"
                    fullWidth
                    size="small"
                    value={form.query}
                    onChange={(e) => set({ query: e.target.value })}
                  />

                  {isEdit ? (
                    <FormControl fullWidth size="small" className="!mt-3">
                      <InputLabel id="campaign-status-label">
                        Status
                      </InputLabel>
                      <Select
                        labelId="campaign-status-label"
                        label="Status"
                        value={form.status}
                        onChange={(e) => set({ status: e.target.value })}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <MenuItem key={s.value} value={s.value}>
                            {s.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <FiSliders size={13} />
                    Scraping options
                  </p>

                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Max results / location</span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-semibold tabular-nums text-slate-800 ring-1 ring-inset ring-slate-200">
                      {form.maxResults}
                    </span>
                  </div>
                  <Slider
                    value={form.maxResults}
                    onChange={(_e, v) => set({ maxResults: v })}
                    min={5}
                    max={500}
                    step={5}
                    size="small"
                    sx={{ mb: 2 }}
                  />

                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-600">
                    <span>Delay between requests</span>
                    <span className="rounded-md bg-white px-2 py-0.5 font-semibold tabular-nums text-slate-800 ring-1 ring-inset ring-slate-200">
                      {form.delay} ms
                    </span>
                  </div>
                  <Slider
                    value={form.delay}
                    onChange={(_e, v) => set({ delay: v })}
                    min={200}
                    max={5000}
                    step={100}
                    size="small"
                    sx={{ mb: 2 }}
                  />

                  <div className="flex items-center justify-between gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                      <Switch
                        size="small"
                        checked={form.emailRequired}
                        onChange={(e) =>
                          set({ emailRequired: e.target.checked })
                        }
                      />
                      Email required
                    </label>

                    <TextField
                      label="Email concurrency"
                      type="number"
                      size="small"
                      value={form.emailConcurrency}
                      onChange={(e) =>
                        set({
                          emailConcurrency:
                            parseInt(e.target.value, 10) || 1,
                        })
                      }
                      slotProps={{ htmlInput: { min: 1, max: 10 } }}
                      className="!w-36"
                    />
                  </div>
                </div>
              </section>

              {/* ── Right: locations ─────────────────────────────────── */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <FiGlobe size={13} />
                  Target locations
                </p>
                <LocationPicker locations={locations} onChange={setLocations} />
              </section>
            </div>
          )}
        </DialogContent>

        <DialogActions className="!flex !items-center !justify-between !gap-3 !border-t !border-slate-100 !px-6 !py-4">
          <span className="text-xs text-slate-500">
            {isEdit ? (
              <>
                <span className="font-semibold text-sky-700">
                  {newLocations.length} new
                </span>{" "}
                · {locations.length - newLocations.length} existing ·{" "}
                {locations.length} total selected
              </>
            ) : (
              <>
                {locations.length} location
                {locations.length === 1 ? "" : "s"} selected
              </>
            )}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                submitting ||
                loading ||
                locations.length === 0 ||
                (isEdit && newLocations.length === 0)
              }
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <CircularProgress size={15} color="inherit" />
              ) : (
                <FiCheck size={15} />
              )}
              {submitting
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? newLocations.length > 0
                    ? `Add ${newLocations.length} location${newLocations.length === 1 ? "" : "s"}`
                    : "No new locations"
                  : "Start campaign"}
            </button>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
}
