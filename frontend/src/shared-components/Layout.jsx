import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
} from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutlined";

const navItems = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon fontSize="small" /> },
  {
    label: "Campaigns",
    path: "/campaigns",
    icon: <PlaylistAddCheckIcon fontSize="small" />,
  },
  {
    label: "New Campaign",
    path: "/campaigns/new",
    icon: <AddCircleOutlineIcon fontSize="small" />,
  },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <Typography variant="h6" fontWeight={700} sx={{ mr: 4 }}>
            📍 Maps Scraper
          </Typography>
          {navItems.map((item) => (
            <Button
              key={item.path}
              component={Link}
              to={item.path}
              startIcon={item.icon}
              sx={{
                mx: 0.5,
                color:
                  location.pathname === item.path
                    ? "#fff"
                    : "rgba(255,255,255,0.75)",
                fontWeight: location.pathname === item.path ? 700 : 400,
                borderBottom:
                  location.pathname === item.path
                    ? "2px solid #fff"
                    : "2px solid transparent",
                borderRadius: 0,
                textTransform: "none",
                "&:hover": { color: "#fff", bgcolor: "transparent" },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3, flex: 1 }}>
        {children}
      </Container>

      <Box
        component="footer"
        sx={{
          py: 2,
          textAlign: "center",
          color: "text.secondary",
          fontSize: "0.8rem",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        Google Maps Scraper &copy; {new Date().getFullYear()}
      </Box>
    </Box>
  );
}
