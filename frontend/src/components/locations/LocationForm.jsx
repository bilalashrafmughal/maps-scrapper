import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Slider,
  FormControlLabel,
  Switch,
  Autocomplete,
  Chip,
  Alert,
  CircularProgress,
  Checkbox,
  FormGroup,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Divider,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import DeleteIcon from "@mui/icons-material/Delete";
import PublicIcon from "@mui/icons-material/Public";
import { createCampaign } from "../../services/api";
import { useNavigate } from "react-router-dom";

let csc = null;

export default function CampaignForm() {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(50);
  const [delay, setDelay] = useState(1000);
  const [emailRequired, setEmailRequired] = useState(false);
  const [emailConcurrency, setEmailConcurrency] = useState(3);

  // Country / State / City selection
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState(null);
  const [cities, setCities] = useState([]);
  // Use a plain object { [cityId]: true } instead of Set (more React-friendly)
  const [selectedCities, setSelectedCities] = useState({});

  // Final location list
  const [locations, setLocations] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Load CSC data
  useEffect(() => {
    import("country-state-city").then((mod) => {
      csc = mod;
      setCountries(csc.Country.getAllCountries());
    });
  }, []);

  // When country changes → reset state downward
  const handleCountryChange = (_e, country) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setSelectedCities({});
    setCities([]);
    setStates([]);
    if (country) {
      setStates(csc?.State.getStatesOfCountry(country.isoCode) || []);
    }
  };

  // When state changes → load cities, reset city selection
  const handleStateChange = (_e, state) => {
    setSelectedState(state);
    setSelectedCities({});
    setCities([]);
    if (state) {
      setCities(
        csc?.City.getCitiesOfState(state.countryCode, state.isoCode) || [],
      );
    }
  };

  // Toggle a city in/out of the location list
  const toggleCity = (city) => {
    setSelectedCities((prev) => {
      const next = { ...prev };
      if (prev[city.id]) {
        delete next[city.id];
      } else {
        next[city.id] = true;
      }
      return next;
    });

    setLocations((prev) => {
      if (prev.some((l) => l.city === city.name)) {
        return prev.filter((l) => l.city !== city.name);
      }
      return [
        ...prev,
        {
          location: `${city.name}, ${selectedState.name}, ${selectedCountry.name}`,
          country: selectedCountry.name,
          state: selectedState?.name || null,
          city: city.name,
        },
      ];
    });
  };

  // Quick-action buttons
  const addAllCities = () => {
    const all = {};
    cities.forEach((c) => {
      all[c.id] = true;
    });
    setSelectedCities(all);
    setLocations((prev) => {
      const existingCities = new Set(prev.map((l) => l.city));
      const newLocations = cities
        .filter((c) => !existingCities.has(c.name))
        .map((c) => ({
          location: `${c.name}, ${selectedState.name}, ${selectedCountry.name}`,
          country: selectedCountry.name,
          state: selectedState?.name || null,
          city: c.name,
        }));
      return [...prev, ...newLocations];
    });
  };

  const clearCitySelection = () => {
    setSelectedCities({});
    const stateNames = new Set(cities.map((c) => c.name));
    setLocations((prev) => prev.filter((l) => !stateNames.has(l.city)));
  };

  const addStateAsLocation = () => {
    if (!selectedState) return;
    const locationStr = `${selectedState.name}, ${selectedCountry.name}`;
    setLocations((prev) => {
      if (prev.some((l) => l.location === locationStr)) return prev;
      return [
        ...prev,
        {
          location: locationStr,
          country: selectedCountry.name,
          state: selectedState?.name || null,
          city: null,
        },
      ];
    });
  };

  const removeLocation = (idx) => {
    const removed = locations[idx];
    setLocations((prev) => prev.filter((_, i) => i !== idx));
    // Also uncheck the city if it was a city-based entry
    if (removed.city) {
      const cityObj = cities.find((c) => c.name === removed.city);
      if (cityObj) {
        setSelectedCities((prev) => {
          const next = { ...prev };
          delete next[cityObj.id];
          return next;
        });
      }
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!query.trim()) {
      setError("Please enter a search query.");
      return;
    }
    if (locations.length === 0) {
      setError("Please add at least one location.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createCampaign({
        query: query.trim(),
        locations,
        maxResults,
        delayBetweenRequests: delay,
        emailConcurrency,
        emailRequired,
      });
      navigate(`/campaigns/${result.id}`);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCountryName = selectedCountry?.name || "";
  const selectedStateName = selectedState?.name || "";
  const selectedCount = Object.keys(selectedCities).length;
  const previewLabel = selectedCount
    ? `${selectedCount} / ${cities.length} cities selected`
    : "Select cities below";

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        New Campaign
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* ── Left column: campaign settings ────────────────────────────── */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Campaign Settings
              </Typography>

              <TextField
                label="Search Query"
                placeholder="e.g. plumbers, electricians, coffee shops"
                fullWidth
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Grid container spacing={2} mb={2}>
                <Grid item xs={6}>
                  <Typography gutterBottom variant="body2">
                    Max Results per Location: {maxResults}
                  </Typography>
                  <Slider
                    value={maxResults}
                    onChange={(_, v) => setMaxResults(v)}
                    min={5}
                    max={500}
                    step={5}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography gutterBottom variant="body2">
                    Delay (ms): {delay}
                  </Typography>
                  <Slider
                    value={delay}
                    onChange={(_, v) => setDelay(v)}
                    min={200}
                    max={5000}
                    step={100}
                  />
                </Grid>
              </Grid>

              <Grid container spacing={2} alignItems="center">
                <Grid item xs={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={emailRequired}
                        onChange={(e) => setEmailRequired(e.target.checked)}
                      />
                    }
                    label="Email required (filters results)"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Email Concurrency"
                    type="number"
                    size="small"
                    value={emailConcurrency}
                    onChange={(e) =>
                      setEmailConcurrency(parseInt(e.target.value) || 3)
                    }
                    inputProps={{ min: 1, max: 10 }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* ── Location preview list ──────────────────────────────────── */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Selected Locations ({locations.length})
              </Typography>

              {locations.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Use the panel on the right to pick countries, states, and
                  cities. Selected locations will appear here automatically.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {locations.map((loc, idx) => (
                    <Box key={idx}>
                      {idx > 0 && <Divider component="li" />}
                      <ListItem
                        secondaryAction={
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => removeLocation(idx)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <PublicIcon fontSize="small" color="action" />
                        </ListItemIcon>
                        <ListItemText
                          primary={loc.location}
                          primaryTypographyProps={{
                            variant: "body2",
                            noWrap: true,
                          }}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Right column: location picker ─────────────────────────────── */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} mb={2}>
                Pick Locations
              </Typography>

              {/* Country */}
              <Autocomplete
                options={countries}
                getOptionLabel={(c) => c.name}
                value={selectedCountry}
                onChange={handleCountryChange}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Country"
                    size="small"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                )}
              />

              {/* State */}
              <Autocomplete
                options={states}
                getOptionLabel={(s) => s.name}
                value={selectedState}
                onChange={handleStateChange}
                disabled={!selectedCountry}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="State (required for cities)"
                    size="small"
                    fullWidth
                    sx={{ mb: 2 }}
                  />
                )}
              />

              {/* Cities checklist */}
              {selectedState && (
                <>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={1}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      {previewLabel}
                    </Typography>
                    <Box display="flex" gap={0.5}>
                      <Button size="small" onClick={addAllCities}>
                        All
                      </Button>
                      <Button size="small" onClick={clearCitySelection}>
                        Clear
                      </Button>
                      <Button size="small" onClick={addStateAsLocation}>
                        + State
                      </Button>
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      maxHeight: 280,
                      overflow: "auto",
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 0.5,
                    }}
                  >
                    <FormGroup>
                      {cities.map((city) => (
                        <Box
                          key={city.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            cursor: "pointer",
                            borderRadius: 0.5,
                            "&:hover": { bgcolor: "action.hover" },
                          }}
                          onClick={() => toggleCity(city)}
                        >
                          {/* <Checkbox
                            size="small"
                            checked={!!selectedCities[city.id]}
                            readOnly
                            sx={{ py: 0.25 }}
                          /> */}
                          <Typography variant="body2">{city.name}</Typography>
                        </Box>
                      ))}
                      {cities.length === 0 && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ p: 1 }}
                        >
                          No cities found for this state.
                        </Typography>
                      )}
                    </FormGroup>
                  </Box>
                </>
              )}

              {!selectedState && selectedCountry && (
                <Box
                  sx={{
                    p: 2,
                    textAlign: "center",
                    border: "1px dashed",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Select a state to see its cities.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ mt: 1 }}
                    onClick={() => {
                      const locationStr = `${selectedCountry.name}`;
                      setLocations((prev) => {
                        if (prev.some((l) => l.location === locationStr))
                          return prev;
                        return [
                          ...prev,
                          {
                            location: locationStr,
                            country: selectedCountry.name,
                            state: null,
                            city: null,
                          },
                        ];
                      });
                    }}
                  >
                    + Add whole country
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>

          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={
              submitting ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )
            }
            onClick={handleSubmit}
            disabled={submitting || locations.length === 0 || !query.trim()}
          >
            {submitting ? "Creating..." : "Start Campaign"}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
