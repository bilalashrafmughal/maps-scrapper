import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

const statusColors = {
  pending: "default",
  running: "info",
  completed: "success",
  failed: "error",
  paused: "warning",
};

export default function CampaignCard({ campaign }) {
  const navigate = useNavigate();

  return (
    <Card
      sx={{
        cursor: "pointer",
        transition: "box-shadow .2s",
        "&:hover": { boxShadow: 6 },
      }}
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
    >
      <CardContent>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={1}
        >
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {campaign.query}
          </Typography>
          <Chip
            label={campaign.status}
            size="small"
            color={statusColors[campaign.status] || "default"}
          />
        </Box>

        <Typography variant="body2" color="text.secondary" mb={1}>
          {campaign.name}
        </Typography>

        <Box display="flex" gap={2} mb={1}>
          <Typography variant="caption" color="text.secondary">
            Max: {campaign.max_results}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Delay: {campaign.delay_ms}ms
          </Typography>
          {campaign.email_required ? (
            <Typography variant="caption" color="warning.main">
              Email required
            </Typography>
          ) : null}
        </Box>

        {campaign.progress && (
          <>
            <LinearProgress
              variant="determinate"
              value={
                campaign.progress.total > 0
                  ? (campaign.progress.completed / campaign.progress.total) *
                    100
                  : 0
              }
              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {campaign.progress.completed}/{campaign.progress.total} locations
              &middot; {campaign.progress.businesses} businesses
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}
