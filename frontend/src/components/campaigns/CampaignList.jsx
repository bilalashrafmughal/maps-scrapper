import { useState, useEffect, useCallback } from "react";
import { Grid, Box, Typography } from "@mui/material";
import { listCampaigns } from "../../services/api";
import CampaignCard from "../../shared-components/CampaignCard";

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);

  const fetch = useCallback(async () => {
    try {
      setCampaigns(await listCampaigns());
    } catch {}
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} mb={3}>
        All Campaigns
      </Typography>

      {campaigns.length === 0 ? (
        <Typography color="text.secondary">No campaigns yet.</Typography>
      ) : (
        <Grid container spacing={2}>
          {campaigns.map((c) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={c.id}>
              <CampaignCard campaign={c} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
