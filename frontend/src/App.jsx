import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider, createTheme, CssBaseline } from "@mui/material";
import Layout from "./shared-components/Layout";
import DashboardPage from "./pages/DashboardPage";
import CampaignsPage from "./pages/CampaignsPage";
import CampaignDetailPage from "./pages/CampaignDetailPage";
import NewCampaignPage from "./pages/NewCampaignPage";

const theme = createTheme({
  palette: {
    primary: { main: "#1565c0" },
    background: { default: "#f5f5f5" },
  },
  typography: {
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  },
  shape: { borderRadius: 8 },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/campaigns/new" element={<NewCampaignPage />} />
            <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
