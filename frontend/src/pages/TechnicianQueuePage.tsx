import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
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
import type { TicketCategory, TicketPriority } from "../types/domain";

const STATUS_OPTIONS: { value: TicketStatus | ""; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "OPEN", label: "Abertos" },
  { value: "TRIAGE", label: "Triagem" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "RESOLVED", label: "Resolvidos" },
];

const PRIORITY_OPTIONS: { value: TicketPriority | ""; label: string }[] = [
  { value: "", label: "Todas as prioridades" },
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
  { value: "CRITICAL", label: "Critica" },
];

const CATEGORY_OPTIONS: { value: TicketCategory | ""; label: string }[] = [
  { value: "", label: "Todas as categorias" },
  { value: "ACCESS", label: "Acesso" },
  { value: "SOFTWARE", label: "Software" },
  { value: "NETWORK", label: "Rede" },
  { value: "HARDWARE", label: "Hardware" },
  { value: "SECURITY", label: "Seguranca" },
  { value: "OTHER", label: "Outro" },
];

export default function TechnicianQueuePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get("status") ?? "") as TicketStatus | "";
  const priorityFilter = (searchParams.get("priority") ?? "") as
    TicketPriority | "";
  const categoryFilter = (searchParams.get("category") ?? "") as
    TicketCategory | "";
  const assignmentFilter =
    searchParams.get("unassigned") === "true"
      ? "UNASSIGNED"
      : searchParams.get("assignee_id") === user?.id
        ? "MINE"
        : "ALL";

  function setFilter(name: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    setSearchParams(next, { replace: true });
  }

  function setAssignment(value: string) {
    const next = new URLSearchParams(searchParams);
    next.delete("unassigned");
    next.delete("assignee_id");
    if (value === "UNASSIGNED") next.set("unassigned", "true");
    if (value === "MINE" && user) next.set("assignee_id", user.id);
    setSearchParams(next, { replace: true });
  }

  const query = useQuery({
    queryKey: [
      "user",
      user?.id,
      "technician-queue",
      statusFilter,
      priorityFilter,
      categoryFilter,
      assignmentFilter,
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (assignmentFilter === "UNASSIGNED") params.set("unassigned", "true");
      if (assignmentFilter === "MINE" && user)
        params.set("assignee_id", user.id);
      return apiFetch<TicketSummary[]>(`/api/v1/tickets?${params.toString()}`);
    },
  });

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Fila de chamados
      </Typography>

      <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <TextField
          select
          label="Status"
          value={statusFilter}
          onChange={(event) => setFilter("status", event.target.value)}
          sx={{ minWidth: 180 }}
        >
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Prioridade"
          value={priorityFilter}
          onChange={(event) => setFilter("priority", event.target.value)}
          sx={{ minWidth: 180 }}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Categoria"
          value={categoryFilter}
          onChange={(event) => setFilter("category", event.target.value)}
          sx={{ minWidth: 180 }}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Atribuicao"
          value={assignmentFilter}
          onChange={(event) => setAssignment(event.target.value)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">Todos</MenuItem>
          <MenuItem value="UNASSIGNED">Sem responsavel</MenuItem>
          <MenuItem value="MINE">Atribuidos a mim</MenuItem>
        </TextField>
      </Box>

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
