import { useState, useEffect, useMemo } from "react";
import { Autocomplete, TextField, Checkbox } from "@mui/material";
import { FiSearch, FiGlobe, FiX, FiMapPin } from "react-icons/fi";

let csc = null;

/**
 * Country → State → City picker. Owns only selection state; the resolved
 * `locations` array is lifted to the parent via `onChange`.
 *
 * Location shape: { location, country, state, city }
 */
export default function LocationPicker({ locations, onChange }) {
  const [ready, setReady] = useState(false);
  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState(null);
  const [states, setStates] = useState([]);
  const [stateSel, setStateSel] = useState(null);
  const [cities, setCities] = useState([]);
  const [cityQuery, setCityQuery] = useState("");
  const [chipLimit, setChipLimit] = useState(60);

  useEffect(() => {
    import("country-state-city").then((mod) => {
      csc = mod;
      setCountries(mod.Country.getAllCountries());
      setReady(true);
    });
  }, []);

  const handleCountry = (_e, c) => {
    setCountry(c);
    setStateSel(null);
    setCities([]);
    setStates(c ? csc?.State.getStatesOfCountry(c.isoCode) || [] : []);
  };

  const handleState = (_e, s) => {
    setStateSel(s);
    setCityQuery("");
    setCities(s ? csc?.City.getCitiesOfState(s.countryCode, s.isoCode) || [] : []);
  };

  const has = (loc) => locations.some((l) => l.location === loc);
  const add = (entry) => {
    if (has(entry.location)) return;
    onChange([...locations, entry]);
  };
  const remove = (locationStr) =>
    onChange(locations.filter((l) => l.location !== locationStr));

  const toggleCity = (city) => {
    const location = `${city.name}, ${stateSel.name}, ${country.name}`;
    if (has(location)) return remove(location);
    add({
      location,
      country: country.name,
      state: stateSel?.name || null,
      city: city.name,
    });
  };

  const addAllCities = () => {
    const existing = new Set(locations.map((l) => l.location));
    const additions = cities
      .map((c) => ({
        location: `${c.name}, ${stateSel.name}, ${country.name}`,
        country: country.name,
        state: stateSel?.name || null,
        city: c.name,
      }))
      .filter((l) => !existing.has(l.location));
    onChange([...locations, ...additions]);
  };

  const clearCities = () => {
    const names = new Set(cities.map((c) => `${c.name}, ${stateSel.name}, ${country.name}`));
    onChange(locations.filter((l) => !names.has(l.location)));
  };

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.name.toLowerCase().includes(q));
  }, [cities, cityQuery]);

  const selectedCount = useMemo(
    () =>
      locations.filter((l) => l.city && cities.some((c) => c.name === l.city))
        .length,
    [locations, cities],
  );

  return (
    <div className="flex flex-col gap-3">
      <Autocomplete
        options={countries}
        getOptionLabel={(c) => c.name}
        value={country}
        onChange={handleCountry}
        loading={!ready}
        renderInput={(p) => (
          <TextField {...p} label="Country" size="small" fullWidth />
        )}
      />

      <Autocomplete
        options={states}
        getOptionLabel={(s) => s.name}
        value={stateSel}
        onChange={handleState}
        disabled={!country}
        renderInput={(p) => (
          <TextField
            {...p}
            label="State / Region"
            size="small"
            fullWidth
            placeholder={country ? "Pick a state" : "Choose a country first"}
          />
        )}
      />

      {stateSel ? (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-500">
              {selectedCount} / {cities.length} cities selected
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={addAllCities}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-sky-600 transition hover:bg-sky-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearCities}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <FiSearch
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder={`Search ${cities.length} cities…`}
              aria-label="Search cities"
              className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/25"
            />
          </div>

          <div className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white p-1">
            {filteredCities.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-slate-400">
                No cities match “{cityQuery}”.
              </p>
            ) : (
              filteredCities.map((c) => {
                const location = `${c.name}, ${stateSel.name}, ${country.name}`;
                const checked = has(location);
                return (
                  <label
                    key={location}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition ${
                      checked
                        ? "bg-sky-50 text-sky-900"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Checkbox
                      size="small"
                      checked={checked}
                      onChange={() => toggleCity(c)}
                      sx={{ p: 0.25 }}
                    />
                    <span className="truncate">{c.name}</span>
                  </label>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              add({
                location: `${stateSel.name}, ${country.name}`,
                country: country.name,
                state: stateSel.name,
                city: null,
              })
            }
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            <FiMapPin size={13} />
            Add whole state
          </button>
        </div>
      ) : country ? (
        <button
          type="button"
          onClick={() =>
            add({
              location: country.name,
              country: country.name,
              state: null,
              city: null,
            })
          }
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <FiGlobe size={14} />
          Add whole country
        </button>
      ) : null}

      {/* Selected locations */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Selected locations
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            {locations.length}
          </span>
        </div>

        {locations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400">
            Pick a country, state and city above — selections appear here.
          </p>
        ) : (
          <>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
              {locations.slice(0, chipLimit).map((l) => (
                <span
                  key={l.location}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200"
                >
                  {l.location}
                  <button
                    type="button"
                    onClick={() => remove(l.location)}
                    aria-label={`Remove ${l.location}`}
                    className="rounded-full p-0.5 text-sky-500 transition hover:bg-sky-200 hover:text-sky-900"
                  >
                    <FiX size={12} />
                  </button>
                </span>
              ))}
            </div>
            {locations.length > chipLimit ? (
              <button
                type="button"
                onClick={() => setChipLimit((n) => n + 60)}
                className="mt-1.5 text-xs font-semibold text-sky-600 transition hover:text-sky-800"
              >
                Show {Math.min(60, locations.length - chipLimit)} more (
                {locations.length - chipLimit} hidden)
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
