import { Link, useSearchParams } from "react-router-dom";
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

const STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success"> =
  {
    OPEN: "default",
    TRIAGE: "warning",
    IN_PROGRESS: "info",
    RESOLVED: "success",
  };

export default function MyTicketsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get("status") ?? "") as
    TicketStatus | "ACTIVE" | "";
  const query = useQuery({
    queryKey: ["user", user?.id, "my-tickets", statusFilter],
    queryFn: () => {
      const suffix =
        statusFilter && statusFilter !== "ACTIVE"
          ? `?status=${statusFilter}`
          : "";
      return apiFetch<TicketSummary[]>(`/api/v1/tickets${suffix}`);
    },
  });

  const tickets =
    statusFilter === "ACTIVE"
      ? query.data?.filter((ticket) =>
          ["TRIAGE", "IN_PROGRESS"].includes(ticket.status),
        )
      : query.data;

  if (query.isLoading) return <LoadingState label="Carregando chamados..." />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Erro ao carregar chamados.";
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Meus chamados
      </Typography>
      <TextField
        select
        label="Status"
        value={statusFilter}
        onChange={(event) => {
          const next = new URLSearchParams(searchParams);
          if (event.target.value) next.set("status", event.target.value);
          else next.delete("status");
          setSearchParams(next, { replace: true });
        }}
        sx={{ mb: 2, minWidth: 220 }}
      >
        <MenuItem value="">Todos os status</MenuItem>
        <MenuItem value="OPEN">Abertos</MenuItem>
        <MenuItem value="ACTIVE">Em atendimento</MenuItem>
        <MenuItem value="TRIAGE">Triagem</MenuItem>
        <MenuItem value="IN_PROGRESS">Em andamento</MenuItem>
        <MenuItem value="RESOLVED">Resolvidos</MenuItem>
      </TextField>
      {tickets && tickets.length === 0 ? (
        <EmptyState message="Nenhum chamado encontrado para este filtro." />
      ) : (
        <List>
          {tickets?.map((ticket) => (
            <ListItemButton
              key={ticket.id}
              component={Link}
              to={`/chamados/${ticket.id}`}
            >
              <ListItemText
                primary={`${ticket.protocol} - ${ticket.title}`}
                secondary={new Date(ticket.created_at).toLocaleString("pt-BR")}
              />
              <Chip
                label={ticket.status}
                color={STATUS_COLOR[ticket.status]}
                size="small"
                sx={{ mr: 1 }}
              />
              <Chip label={ticket.priority} variant="outlined" size="small" />
            </ListItemButton>
          ))}
        </List>
      )}
    </>
  );
}
