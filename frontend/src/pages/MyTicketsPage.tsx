import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, EmptyState, ErrorState } from "../components/AsyncState";
import type { TicketSummary } from "../types/domain";

const STATUS_COLOR: Record<string, "default" | "warning" | "info" | "success"> =
  {
    OPEN: "default",
    TRIAGE: "warning",
    IN_PROGRESS: "info",
    RESOLVED: "success",
  };

export default function MyTicketsPage() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["user", user?.id, "my-tickets"],
    queryFn: () => apiFetch<TicketSummary[]>("/api/v1/tickets"),
  });

  if (query.isLoading) return <LoadingState label="Carregando chamados..." />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Erro ao carregar chamados.";
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  if (query.data && query.data.length === 0) {
    return <EmptyState message="Voce ainda nao abriu nenhum chamado." />;
  }

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Meus chamados
      </Typography>
      <List>
        {query.data?.map((ticket) => (
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
    </>
  );
}
