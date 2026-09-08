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
    queryKey: ["user", user?.id, "ticket", id],
    queryFn: () => apiFetch<TicketDetail>(`/api/v1/tickets/${id}`),
    enabled: Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      apiFetch<TicketDetail>(`/api/v1/tickets/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, comment: comment || undefined }),
      }),
    onSuccess: (updatedTicket) => {
      queryClient.setQueryData(["user", user?.id, "ticket", id], updatedTicket);
      queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
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
      apiFetch<TicketDetail>(`/api/v1/tickets/${id}/priority`, {
        method: "PATCH",
        body: JSON.stringify({ priority }),
      }),
    onSuccess: (updatedTicket) => {
      queryClient.setQueryData(["user", user?.id, "ticket", id], updatedTicket);
      queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
      setErrorMessage(null);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao atualizar prioridade.",
      ),
  });

  const assignmentMutation = useMutation({
    mutationFn: () =>
      apiFetch<TicketDetail>(`/api/v1/tickets/${id}/assignment`, {
        method: "PATCH",
        body: JSON.stringify({ assignee_id: user?.id }),
      }),
    onSuccess: (updatedTicket) => {
      queryClient.setQueryData(["user", user?.id, "ticket", id], updatedTicket);
      queryClient.invalidateQueries({ queryKey: ["user", user?.id] });
      setErrorMessage(null);
    },
    onError: (err) =>
      setErrorMessage(
        err instanceof ApiError ? err.message : "Erro ao assumir chamado.",
      ),
  });

  function changeStatus(nextStatus: TicketStatus) {
    if (nextStatus === "OPEN" && !comment.trim()) {
      setErrorMessage(
        "Informe um comentario ao retornar o chamado para aberto.",
      );
      return;
    }
    statusMutation.mutate(nextStatus);
  }

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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Responsavel: {ticket.assignee?.name ?? "Nao atribuido"}
      </Typography>
      {ticket.resolved_at && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Resolvido em {new Date(ticket.resolved_at).toLocaleString("pt-BR")}
        </Typography>
      )}

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      {isTechnician && ticket.status === "RESOLVED" && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Este chamado esta resolvido e nao pode mais ser alterado.
        </Alert>
      )}

      {isTechnician && ticket.status !== "RESOLVED" && (
        <Box
          sx={{
            mb: 3,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxWidth: 360,
          }}
        >
          {!ticket.assignee && (
            <Button
              variant="contained"
              onClick={() => assignmentMutation.mutate()}
              disabled={assignmentMutation.isPending}
            >
              {assignmentMutation.isPending
                ? "Assumindo..."
                : "Assumir chamado"}
            </Button>
          )}
          {ticket.assignee?.id === user?.id && (
            <Alert severity="info">Este chamado esta atribuido a voce.</Alert>
          )}
          {ticket.assignee && ticket.assignee.id !== user?.id && (
            <Alert severity="warning">
              Este chamado esta atribuido a {ticket.assignee.name}.
            </Alert>
          )}
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
            inputProps={{ maxLength: 500 }}
            helperText={`${comment.length}/500 caracteres`}
          />

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {NEXT_STATUS[ticket.status].map((nextStatus) => (
              <Button
                key={nextStatus}
                variant="contained"
                onClick={() => changeStatus(nextStatus)}
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
            <Typography variant="body2">Por {event.author.name}</Typography>
            {event.comment && (
              <Typography variant="body2">{event.comment}</Typography>
            )}
          </Box>
        ))
      )}
    </Paper>
  );
}
