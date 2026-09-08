import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
} from "@mui/material";

import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

export default function LoginPage() {
  const { login, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("thiago@example.test");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nao foi possivel entrar.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 2,
      }}
    >
      <Paper
        sx={{ p: 4, maxWidth: 400, width: "100%" }}
        component="form"
        onSubmit={handleSubmit}
      >
        <Typography variant="h5" gutterBottom>
          Portal de Autoatendimento de TI
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Ambiente de demonstracao. Use as credenciais ficticias fornecidas pelo
          grupo.
        </Alert>
        {sessionMessage && (
          <Alert severity="warning" sx={{ mb: 2 }} aria-live="polite">
            {sessionMessage}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label="E-mail"
          type="email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <TextField
          label="Senha"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <Button
          type="submit"
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          disabled={submitting}
        >
          {submitting ? "Entrando..." : "Entrar"}
        </Button>
      </Paper>
    </Box>
  );
}
