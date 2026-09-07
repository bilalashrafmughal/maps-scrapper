import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Box,
  Tooltip,
} from "@mui/material";
import { getCampaignLocations } from "../services/api";

const statusColors = {
  pending: "default",
  running: "info",
  completed: "success",
  failed: "error",
};

export default function CampaignProgressTable({
  campaignId,
  refreshInterval = 5000,
}) {
  const [locations, setLocations] = useState([]);

  const fetchLocations = useCallback(async () => {
    try {
      const data = await getCampaignLocations(campaignId);
      setLocations(data);
    } catch (err) {
      // silently retry on next tick
    }
  }, [campaignId]);

  useEffect(() => {
    fetchLocations();
    if (refreshInterval > 0) {
      const interval = setInterval(fetchLocations, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchLocations, refreshInterval]);

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        Location Progress
      </Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Location</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Scraped</TableCell>
              <TableCell>Started</TableCell>
              <TableCell>Completed</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {locations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No locations yet
                </TableCell>
              </TableRow>
            )}
            {locations.map((loc) => (
              <TableRow key={loc.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {loc.location}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={loc.status}
                    size="small"
                    color={statusColors[loc.status] || "default"}
                  />
                </TableCell>
                <TableCell>{loc.items_scraped}</TableCell>
                <TableCell>
                  {loc.started_at
                    ? new Date(loc.started_at).toLocaleTimeString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {loc.completed_at
                    ? new Date(loc.completed_at).toLocaleTimeString()
                    : "—"}
                </TableCell>
                <TableCell>
                  {loc.error_msg ? (
                    <Tooltip title={loc.error_msg}>
                      <Typography variant="caption" color="error">
                        Error
                      </Typography>
                    </Tooltip>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
