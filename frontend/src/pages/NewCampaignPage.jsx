import { useNavigate } from "react-router-dom";
import CampaignDialog from "../components/campaigns/CampaignDialog";

/**
 * Dedicated route for creating a campaign. The dialog opens immediately so
 * deep-links keep working, and closing it returns to the campaigns list.
 */
export default function NewCampaignPage() {
  const navigate = useNavigate();
  const goBack = () => navigate("/campaigns");

  return (
    <CampaignDialog
      open
      onClose={goBack}
      onCreated={(id) => navigate(`/campaigns/${id}`)}
      onUpdated={goBack}
    />
  );
}
