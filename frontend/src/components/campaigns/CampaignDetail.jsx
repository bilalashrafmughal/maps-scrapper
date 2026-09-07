import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tooltip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { getCampaign, getCampaignResults } from "../../services/api";
import { exportResultsToExcel } from "../../services/excelExport";
import CampaignProgressTable from "../../shared-components/CampaignProgressTable";

const statusColors = {
  pending: "default",
  running: "info",
  completed: "success",
  failed: "error",
  paused: "warning",
};

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [results, setResults] = useState([]);
  const [exporting, setExporting] = useState(false);

  const fetch = useCallback(async () => {
    try {
      setCampaign(await getCampaign(id));
      setResults(await getCampaignResults(id));
    } catch {}
  }, [id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

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
    } finally {
      setExporting(false);
    }
  };

  if (!campaign) return <Typography>Loading...</Typography>;

  const progress = campaign.progress || {};
  const pct =
    progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/campaigns")}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {campaign.query}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {campaign.name}
          </Typography>
        </Box>
        <Box display="flex" gap={1} alignItems="center">
          <Chip
            label={campaign.status}
            color={statusColors[campaign.status] || "default"}
          />

          <Button size="small" startIcon={<RefreshIcon />} onClick={fetch}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Max Results
              </Typography>
              <Typography fontWeight={600}>{campaign.max_results}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Delay
              </Typography>
              <Typography fontWeight={600}>{campaign.delay_ms}ms</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Email Required
              </Typography>
              <Typography fontWeight={600}>
                {campaign.email_required ? "Yes" : "No"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Total Businesses
              </Typography>
              <Typography fontWeight={600}>
                {progress.businesses || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {campaign.status === "running" || campaign.status === "pending" ? (
        <Box mb={3}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="body2">
              Locations: {progress.completed}/{progress.total}
            </Typography>
            <Typography variant="body2">{pct.toFixed(0)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pct}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      ) : null}

      <CampaignProgressTable
        campaignId={parseInt(id)}
        refreshInterval={campaign.status === "running" ? 3000 : 0}
      />

      <Box mt={3}>
        <Box className="flex justify-between mb-1">
          <p className="flex">Scraped Results ({results.length})</p>

          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            disabled={exporting || results.length === 0}
            variant="outlined"
            color="success"
          >
            {exporting ? "Preparing..." : "Export Excel"}
          </Button>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Reviews</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Website</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No results yet
                  </TableCell>
                </TableRow>
              )}
              {results.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {b.name || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>{b.rating ?? "—"}</TableCell>
                  <TableCell>{b.reviews ?? "—"}</TableCell>
                  <TableCell>{b.category || "—"}</TableCell>
                  <TableCell>{b.phone || "—"}</TableCell>
                  <TableCell>
                    {b.email ? (
                      <a
                        href={`mailto:${b.email}`}
                        style={{ color: "#1565c0" }}
                      >
                        {b.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {b.website ? (
                      <Tooltip title={b.website}>
                        <a
                          href={b.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "#1565c0" }}
                        >
                          Visit
                        </a>
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
    </Box>
  );
}
