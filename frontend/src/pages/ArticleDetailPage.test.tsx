import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArticleDetailPage from "./ArticleDetailPage";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const auth = vi.hoisted(() => ({
  role: "EMPLOYEE" as "EMPLOYEE" | "TECHNICIAN",
}));

vi.mock("../api/client", async () => {
  const actual =
    await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiFetch: api.fetch };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1", role: auth.role } }),
}));

const article = {
  id: "article-1",
  title: "Configurar VPN corporativa",
  slug: "configurar-vpn",
  summary: "Resumo",
  content: "Conteudo do artigo",
  category: "NETWORK",
  updated_at: "2026-09-08T12:00:00Z",
};

function TicketDraftProbe() {
  const location = useLocation();
  return <div>Novo chamado: {JSON.stringify(location.state)}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/ajuda/configurar-vpn"]}>
        <Routes>
          <Route path="/ajuda/:slug" element={<ArticleDetailPage />} />
          <Route path="/chamados/novo" element={<TicketDraftProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ArticleDetailPage", () => {
  beforeEach(() => {
    auth.role = "EMPLOYEE";
    api.fetch.mockReset();
  });

  it("espera o feedback ser salvo antes de abrir o rascunho", async () => {
    let finishFeedback: (value: unknown) => void = () => undefined;
    const feedback = new Promise((resolve) => {
      finishFeedback = resolve;
    });
    api.fetch.mockImplementation((_path: string, options?: RequestInit) =>
      options?.method === "PUT" ? feedback : Promise.resolve(article),
    );
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Nao resolveu, abrir chamado",
      }),
    );
    expect(screen.queryByText(/Novo chamado:/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrando feedback..." }),
    ).toBeDisabled();

    await act(async () => finishFeedback({ resolved: false }));

    expect(await screen.findByText(/Novo chamado:/)).toHaveTextContent(
      "Configurar VPN corporativa",
    );
    expect(screen.getByText(/Novo chamado:/)).toHaveTextContent("NETWORK");
  });

  it("nao exibe controles de feedback para tecnicos", async () => {
    auth.role = "TECHNICIAN";
    api.fetch.mockResolvedValue(article);
    renderPage();

    expect(await screen.findByText("Conteudo do artigo")).toBeInTheDocument();
    expect(
      screen.queryByText("Este artigo resolveu sua duvida?"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sim, resolveu" }),
    ).not.toBeInTheDocument();
  });
});
