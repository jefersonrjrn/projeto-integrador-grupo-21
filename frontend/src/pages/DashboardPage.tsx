import { useQuery } from "@tanstack/react-query";
import { Grid, Paper, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { apiFetch, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoadingState, ErrorState } from "../components/AsyncState";
import type {
  DashboardEmployeeSummary,
  DashboardTechnicianSummary,
} from "../types/domain";

function MetricCard({
  label,
  value,
  to,
}: {
  label: string;
  value: number | string;
  to?: string;
}) {
  const content = (
    <>
      <Typography variant="h4">{value}</Typography>
      <Typography color="text.secondary">{label}</Typography>
    </>
  );
  return (
    <Grid item xs={12} sm={6} md={3}>
      {to ? (
        <Paper
          component={Link}
          to={to}
          sx={{
            p: 3,
            textAlign: "center",
            display: "block",
            textDecoration: "none",
          }}
        >
          {content}
        </Paper>
      ) : (
        <Paper sx={{ p: 3, textAlign: "center" }}>{content}</Paper>
      )}
    </Grid>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isTechnician = user?.role === "TECHNICIAN";

  const query = useQuery({
    queryKey: ["user", user?.id, "dashboard-summary"],
    queryFn: () =>
      apiFetch<DashboardEmployeeSummary | DashboardTechnicianSummary>(
        "/api/v1/dashboard/summary",
      ),
  });

  if (query.isLoading) return <LoadingState label="Carregando painel..." />;
  if (query.isError) {
    const message =
      query.error instanceof ApiError
        ? query.error.message
        : "Erro ao carregar o painel.";
    return <ErrorState message={message} onRetry={() => query.refetch()} />;
  }

  const data = query.data!;

  return (
    <>
      <Typography variant="h5" gutterBottom>
        Ola, {user?.name}
      </Typography>

      {!isTechnician && "account_locked" in data && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <MetricCard
            label="Conta bloqueada"
            value={data.account_locked ? "Sim" : "Nao"}
            to="/desbloqueio"
          />
          <MetricCard
            label="Chamados abertos"
            value={data.open_tickets}
            to="/meus-chamados?status=OPEN"
          />
          <MetricCard
            label="Em andamento"
            value={data.in_progress_tickets}
            to="/meus-chamados?status=ACTIVE"
          />
          <MetricCard
            label="Resolvidos"
            value={data.resolved_tickets}
            to="/meus-chamados?status=RESOLVED"
          />
        </Grid>
      )}

      {isTechnician && "unassigned_tickets" in data && (
        <Grid container spacing={2}>
          <MetricCard
            label="Sem responsavel"
            value={data.unassigned_tickets}
            to="/tecnico/chamados?unassigned=true"
          />
          {Object.entries(data.by_status).map(([status, count]) => (
            <MetricCard
              key={status}
              label={`Status: ${status}`}
              value={count}
              to={`/tecnico/chamados?status=${status}`}
            />
          ))}
          {Object.entries(data.by_priority).map(([priority, count]) => (
            <MetricCard
              key={priority}
              label={`Prioridade: ${priority}`}
              value={count}
              to={`/tecnico/chamados?priority=${priority}`}
            />
          ))}
        </Grid>
      )}
    </>
  );
}
