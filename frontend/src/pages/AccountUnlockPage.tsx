import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth, type CurrentUser } from "../auth/AuthContext";
import type { components } from "../types/api.generated";

type UnlockRequestResponse = components["schemas"]["UnlockRequestResponse"];

export default function AccountUnlockPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<UnlockRequestResponse | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState(false);
  const [challengeExpired, setChallengeExpired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!challenge) return;
    const remaining = new Date(challenge.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      setChallengeExpired(true);
      return;
    }
    setChallengeExpired(false);
    const timeout = window.setTimeout(
      () => setChallengeExpired(true),
      remaining,
    );
    return () => window.clearTimeout(timeout);
  }, [challenge]);

  const requestMutation = useMutation({
    mutationFn: () =>
      apiFetch<UnlockRequestResponse>("/api/v1/account-unlocks/request-code", {
        method: "POST",
      }),
    onSuccess: (data) => {
      setChallenge(data);
      setCode("");
      setSuccess(false);
      setChallengeExpired(false);
      setErrorMessage(null);
    },
    onError: async (err) => {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao solicitar codigo.",
      );
      if (err instanceof ApiError && err.status === 409) {
        try {
          const currentUser = await refreshUser();
          if (!currentUser.account_locked) {
            setErrorMessage(null);
            setSuccess(true);
          }
        } catch {
          // A mensagem original da solicitacao continua visivel.
        }
      }
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      apiFetch<CurrentUser>("/api/v1/account-unlocks/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challenge?.challenge_id, code }),
      }),
    onSuccess: (currentUser) => {
      updateUser(currentUser);
      queryClient.invalidateQueries({
        queryKey: ["user", currentUser.id, "dashboard-summary"],
      });
      setSuccess(true);
      setChallenge(null);
      setCode("");
      setErrorMessage(null);
    },
    onError: async (err) => {
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao verificar codigo.",
      );
      if (!(err instanceof ApiError)) return;
      if ([404, 410, 429].includes(err.status)) {
        setChallenge(null);
        setCode("");
        setChallengeExpired(false);
      } else if (err.status === 409) {
        setChallenge(null);
        setCode("");
        try {
          const currentUser = await refreshUser();
          if (!currentUser.account_locked) {
            setErrorMessage(null);
            setSuccess(true);
          }
        } catch {
          // A mensagem de codigo ja utilizado continua visivel.
        }
      } else if (err.status === 422) {
        setCode("");
      }
    },
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

      {!challenge && !success && user?.account_locked && (
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
          <Typography variant="body2" color="text.secondary">
            Expira em {new Date(challenge.expires_at).toLocaleString("pt-BR")}.
          </Typography>
          {challengeExpired && (
            <Alert severity="warning" sx={{ mt: 2 }} aria-live="assertive">
              Este codigo expirou. Solicite um novo codigo para continuar.
            </Alert>
          )}
          <TextField
            label="Codigo de verificacao"
            fullWidth
            margin="normal"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]{6}",
              maxLength: 6,
              autoComplete: "one-time-code",
            }}
            disabled={challengeExpired}
          />
          {challengeExpired ? (
            <Button
              variant="contained"
              fullWidth
              onClick={() => requestMutation.mutate()}
              disabled={requestMutation.isPending}
            >
              Solicitar novo codigo
            </Button>
          ) : (
            <Button
              variant="contained"
              fullWidth
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || code.length !== 6}
            >
              {verifyMutation.isPending ? "Verificando..." : "Verificar codigo"}
            </Button>
          )}
        </Box>
      )}
    </Paper>
  );
}
