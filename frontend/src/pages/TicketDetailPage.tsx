import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, ErrorState } from "../components/AsyncState";
import type {
  TicketDetail,
  TicketPriority,
  TicketStatus,
} from "../types/domain";

const NEXT_STATUS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["TRIAGE"],
  TRIAGE: ["IN_PROGRESS", "OPEN"],
  IN_PROGRESS: ["RESOLVED", "OPEN"],
  RESOLVED: [],
};

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => apiFetch<TicketDetail>(`/api/v1/tickets/${id}`),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      apiFetch(`/api/v1/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, comment: comment || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      setComment("");
      setErrorMessage(null);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao atualizar status.",
      ),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: TicketPriority) =>
      apiFetch(`/api/v1/tickets/${id}/priority`, {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  if (query.isLoading) return <LoadingState label="Carregando chamado..." />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Erro ao carregar o chamado.";
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  const ticket = query.data!;
  const isTechnician = user?.role === "TECHNICIAN";

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        {ticket.protocol} - {ticket.title}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <Chip label={ticket.status} />
        <Chip label={ticket.priority} variant="outlined" />
        <Chip label={ticket.category} variant="outlined" />
      </Box>

      <Typography sx={{ mb: 3, whiteSpace: "pre-line" }}>
        {ticket.description}
      </Typography>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {isTechnician && (
        <Box
          sx={{
            mb: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxWidth: 360,
          }}
        >
          <TextField
            select
            label="Alterar prioridade"
            value={ticket.priority}
            onChange={(event) =>
              priorityMutation.mutate(event.target.value as TicketPriority)
            }
          >
            {PRIORITIES.map((priority) => (
              <MenuItem key={priority} value={priority}>
                {priority}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Comentario (opcional)"
            multiline
            minRows={2}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {NEXT_STATUS[ticket.status].map((nextStatus) => (
              <Button
                key={nextStatus}
                variant="contained"
                onClick={() => statusMutation.mutate(nextStatus)}
                disabled={statusMutation.isPending}
              >
                Mover para {nextStatus}
              </Button>
            ))}
          </Box>
        </Box>
      )}

      <Typography variant="h6" gutterBottom>
        Historico
      </Typography>
      {ticket.events.length === 0 ? (
        <Typography color="text.secondary">
          Nenhum evento registrado ainda.
        </Typography>
      ) : (
        ticket.events.map((event) => (
          <Box
            key={event.id}
            sx={{ borderLeft: "2px solid #ccc", pl: 2, mb: 2 }}
          >
            <Typography variant="body2" color="text.secondary">
              {new Date(event.created_at).toLocaleString("pt-BR")}
            </Typography>
            <Typography variant="body2">
              {event.from_status
                ? `${event.from_status} -> ${event.to_status}`
                : `Criado como ${event.to_status}`}
            </Typography>
            {event.comment && (
              <Typography variant="body2">{event.comment}</Typography>
            )}
          </Box>
        ))
      )}
    </Paper>
  );
}
