import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./DashboardPage";
import MyTicketsPage from "./MyTicketsPage";
import TechnicianQueuePage from "./TechnicianQueuePage";
import TicketDetailPage from "./TicketDetailPage";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const auth = vi.hoisted(() => ({
  user: {
    id: "technician-1",
    name: "Mateus",
    email: "mateus@example.test",
    role: "TECHNICIAN" as "EMPLOYEE" | "TECHNICIAN",
    account_locked: false,
  },
}));

vi.mock("../api/client", async () => {
  const actual =
    await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiFetch: api.fetch };
});

vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

const requester = { id: "employee-1", name: "Thiago" };
const technician = { id: "technician-1", name: "Mateus" };
const baseTicket = {
  id: "ticket-1",
  protocol: "INC-2026-0042",
  title: "Erro no sistema",
  description: "A tela apresenta erro ao salvar.",
  category: "SOFTWARE" as const,
  priority: "MEDIUM" as const,
  status: "OPEN" as const,
  requester,
  assignee: null,
  created_at: "2026-09-08T12:00:00Z",
  updated_at: "2026-09-08T12:00:00Z",
  resolved_at: null,
  events: [
    {
      id: "event-1",
      author_id: requester.id,
      author: requester,
      from_status: null,
      to_status: "OPEN" as const,
      comment: "Chamado aberto",
      created_at: "2026-09-08T12:00:00Z",
    },
  ],
};

function renderAt(element: React.ReactNode, entry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("fluxos de chamados", () => {
  beforeEach(() => {
    api.fetch.mockReset();
    auth.user.role = "TECHNICIAN";
    auth.user.id = "technician-1";
    auth.user.name = "Mateus";
  });

  it("envia filtros canonicos presentes na URL da fila", async () => {
    api.fetch.mockResolvedValue([]);
    renderAt(
      <TechnicianQueuePage />,
      "/tecnico/chamados?status=OPEN&unassigned=true",
    );

    await waitFor(() => expect(api.fetch).toHaveBeenCalledOnce());
    expect(api.fetch).toHaveBeenCalledWith(
      "/api/v1/tickets?status=OPEN&unassigned=true",
    );
  });

  it("permite assumir chamado e identifica o autor do historico", async () => {
    let assigned = false;
    api.fetch.mockImplementation((_path: string, options?: RequestInit) => {
      if (options?.method === "PATCH") {
        assigned = true;
      }
      return Promise.resolve(
        assigned ? { ...baseTicket, assignee: technician } : baseTicket,
      );
    });
    renderAt(
      <Routes>
        <Route path="/chamados/:id" element={<TicketDetailPage />} />
      </Routes>,
      "/chamados/ticket-1",
    );

    expect(await screen.findByText("Por Thiago")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Assumir chamado" }),
    );

    expect(
      await screen.findByText("Este chamado esta atribuido a voce."),
    ).toBeInTheDocument();
    expect(api.fetch).toHaveBeenCalledWith(
      "/api/v1/tickets/ticket-1/assignment",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ assignee_id: "technician-1" }),
      }),
    );
  });

  it("atalhos do dashboard tecnico apontam para filtros compartilháveis", async () => {
    api.fetch.mockResolvedValue({
      unassigned_tickets: 2,
      by_status: { OPEN: 3 },
      by_priority: { HIGH: 1 },
    });
    renderAt(<DashboardPage />, "/");

    expect(
      await screen.findByRole("link", { name: /2 Sem responsavel/ }),
    ).toHaveAttribute("href", "/tecnico/chamados?unassigned=true");
    expect(
      screen.getByRole("link", { name: /3 Status: OPEN/ }),
    ).toHaveAttribute("href", "/tecnico/chamados?status=OPEN");
  });

  it("remove controles de edicao de chamado resolvido", async () => {
    api.fetch.mockResolvedValue({
      ...baseTicket,
      status: "RESOLVED",
      resolved_at: "2026-09-08T13:00:00Z",
    });
    renderAt(
      <Routes>
        <Route path="/chamados/:id" element={<TicketDetailPage />} />
      </Routes>,
      "/chamados/ticket-1",
    );

    expect(
      await screen.findByText(/Este chamado esta resolvido/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resolvido em/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assumir chamado" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Alterar prioridade"),
    ).not.toBeInTheDocument();
  });

  it("atalho ativo do colaborador inclui triagem e andamento", async () => {
    auth.user.role = "EMPLOYEE";
    auth.user.id = "employee-1";
    api.fetch.mockResolvedValue([
      { ...baseTicket, id: "triage", status: "TRIAGE", title: "Em triagem" },
      { ...baseTicket, id: "open", status: "OPEN", title: "Ainda aberto" },
    ]);
    renderAt(<MyTicketsPage />, "/meus-chamados?status=ACTIVE");

    expect(await screen.findByText(/Em triagem/)).toBeInTheDocument();
    expect(screen.queryByText(/Ainda aberto/)).not.toBeInTheDocument();
    expect(api.fetch).toHaveBeenCalledWith("/api/v1/tickets");
  });
});
