import { useState, useEffect } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CampaignIcon from "@mui/icons-material/Campaign";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { getStats, listCampaigns } from "../../services/api";
import CampaignCard from "../../shared-components/CampaignCard";

export default function DashboardStats() {
  const [stats, setStats] = useState(null);
  const [recentCampaigns, setRecentCampaigns] = useState([]);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
    listCampaigns()
      .then((c) => setRecentCampaigns(c.slice(0, 4)))
      .catch(() => {});
  }, []);

  const tiles = [
    {
      label: "Campaigns",
      value: stats?.campaigns ?? "—",
      icon: <CampaignIcon />,
      color: "#1565c0",
    },
    {
      label: "Businesses",
      value: stats?.businesses ?? "—",
      icon: <BusinessIcon />,
      color: "#2e7d32",
    },
    {
      label: "Locations",
      value: stats?.locations ?? "—",
      icon: <LocationOnIcon />,
      color: "#e65100",
    },
    {
      label: "Active",
      value: recentCampaigns.filter((c) => c.status === "running").length,
      icon: <TrendingUpIcon />,
      color: "#6a1b9a",
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        Dashboard
      </Typography>

      <Grid container spacing={2} mb={4}>
        {tiles.map((tile) => (
          <Grid item xs={6} sm={3} key={tile.label}>
            <Card>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Avatar sx={{ bgcolor: tile.color, mx: "auto", mb: 1 }}>
                  {tile.icon}
                </Avatar>
                <Typography variant="h5" fontWeight={700}>
                  {tile.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {tile.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h6" fontWeight={600} mb={2}>
        Recent Campaigns
      </Typography>

      {recentCampaigns.length === 0 ? (
        <Typography color="text.secondary">
          No campaigns yet. Create one to get started.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {recentCampaigns.map((c) => (
            <Grid item xs={12} sm={6} md={3} key={c.id}>
              <CampaignCard campaign={c} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
