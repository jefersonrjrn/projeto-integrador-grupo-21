import { useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Box,
  Chip,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";

import { useAuth } from "../auth/AuthContext";

const EMPLOYEE_LINKS = [
  { label: "Dashboard", to: "/" },
  { label: "Base de conhecimento", to: "/ajuda" },
  { label: "Desbloqueio de conta", to: "/desbloqueio" },
  { label: "Abrir chamado", to: "/chamados/novo" },
  { label: "Meus chamados", to: "/meus-chamados" },
];

const TECHNICIAN_LINKS = [
  { label: "Dashboard", to: "/" },
  { label: "Base de conhecimento", to: "/ajuda" },
  { label: "Fila de chamados", to: "/tecnico/chamados" },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const links = user?.role === "TECHNICIAN" ? TECHNICIAN_LINKS : EMPLOYEE_LINKS;

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="static">
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { sm: "none" } }}
            aria-label="Abrir menu de navegacao"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Portal de Autoatendimento de TI
          </Typography>
          {user && (
            <>
              <Chip
                label={user.role === "TECHNICIAN" ? "Tecnico" : "Colaborador"}
                color="secondary"
                size="small"
              />
              <Typography variant="body2">{user.name}</Typography>
              <Button color="inherit" onClick={handleLogout}>
                Sair
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1 }}>
        <Box
          component="nav"
          sx={{
            display: { xs: "none", sm: "block" },
            width: 240,
            borderRight: "1px solid #e0e0e0",
          }}
        >
          <List>
            {links.map((link) => (
              <ListItemButton key={link.to} component={Link} to={link.to}>
                <ListItemText primary={link.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          <List sx={{ width: 240 }}>
            {links.map((link) => (
              <ListItemButton
                key={link.to}
                component={Link}
                to={link.to}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary={link.label} />
              </ListItemButton>
            ))}
          </List>
        </Drawer>

        <Box
          component="main"
          sx={{ flex: 1, p: { xs: 2, sm: 3 }, minWidth: 360 }}
        >
          <Chip
            label="Ambiente de demonstracao: dados e integracoes sao ficticios"
            color="warning"
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
