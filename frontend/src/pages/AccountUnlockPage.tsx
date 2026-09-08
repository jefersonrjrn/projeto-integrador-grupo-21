import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

interface UnlockRequestResponse {
  challenge_id: string;
  expires_at: string;
  demo_code: string | null;
}

export default function AccountUnlockPage() {
  const { user } = useAuth();
  const [challenge, setChallenge] = useState<UnlockRequestResponse | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: () =>
      apiFetch<UnlockRequestResponse>("/api/v1/account-unlocks/request-code", {
        method: "POST",
      }),
    onSuccess: (data) => {
      setChallenge(data);
      setErrorMessage(null);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao solicitar codigo.",
      ),
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/v1/account-unlocks/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challenge?.challenge_id, code }),
      }),
    onSuccess: () => {
      setSuccess(true);
      setErrorMessage(null);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao verificar codigo.",
      ),
  });

  return (
    <Paper sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" gutterBottom>
        Desbloqueio de conta
      </Typography>

      <Alert
        severity={user?.account_locked ? "warning" : "success"}
        sx={{ mb: 2 }}
      >
        {user?.account_locked
          ? "Sua conta esta bloqueada."
          : "Sua conta esta desbloqueada."}
      </Alert>

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Conta desbloqueada com sucesso.
        </Alert>
      )}
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {!challenge && !success && (
        <Button
          variant="contained"
          onClick={() => requestMutation.mutate()}
          disabled={requestMutation.isPending}
        >
          Solicitar codigo de verificacao
        </Button>
      )}

      {challenge && !success && (
        <Box>
          {challenge.demo_code && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Codigo de demonstracao: <strong>{challenge.demo_code}</strong>{" "}
              (valido por 5 minutos)
            </Alert>
          )}
          <TextField
            label="Codigo de verificacao"
            fullWidth
            margin="normal"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={() => verifyMutation.mutate()}
            disabled={verifyMutation.isPending || code.length === 0}
          >
            Verificar codigo
          </Button>
        </Box>
      )}
    </Paper>
  );
}
