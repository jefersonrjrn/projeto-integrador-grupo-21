import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Chip,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, EmptyState, ErrorState } from "../components/AsyncState";
import type { TicketStatus, TicketSummary } from "../types/domain";

const STATUS_OPTIONS: { value: TicketStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "OPEN", label: "Abertos" },
  { value: "TRIAGE", label: "Triagem" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "RESOLVED", label: "Resolvidos" },
];

export default function TechnicianQueuePage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "">("");

  const query = useQuery({
    queryKey: ["user", user?.id, "technician-queue", statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status_filter", statusFilter);
      return apiFetch<TicketSummary[]>(`/api/v1/tickets?${params.toString()}`);
    },
  });

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Fila de chamados
      </Typography>

      <TextField
        select
        label="Filtrar por status"
        value={statusFilter}
        onChange={(event) =>
          setStatusFilter(event.target.value as TicketStatus | "")
        }
        sx={{ mb: 2, minWidth: 240 }}
      >
        {STATUS_OPTIONS.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>

      {query.isLoading && <LoadingState label="Carregando fila..." />}
      {query.isError && (
        <ErrorState
          message={
            query.error instanceof ApiError
              ? query.error.message
              : "Erro ao carregar a fila."
          }
          onRetry={() => query.refetch()}
        />
      )}
      {query.data && query.data.length === 0 && (
        <EmptyState message="Nenhum chamado nesta fila." />
      )}

      <List>
        {query.data?.map((ticket) => (
          <ListItemButton
            key={ticket.id}
            component={Link}
            to={`/chamados/${ticket.id}`}
          >
            <ListItemText
              primary={`${ticket.protocol} - ${ticket.title}`}
              secondary={
                ticket.assignee
                  ? `Responsavel: ${ticket.assignee.name}`
                  : "Sem responsavel"
              }
            />
            <Chip label={ticket.status} size="small" sx={{ mr: 1 }} />
            <Chip label={ticket.priority} variant="outlined" size="small" />
          </ListItemButton>
        ))}
      </List>
    </>
  );
}
