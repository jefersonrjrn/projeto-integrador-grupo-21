import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ArticlesPage from "./ArticlesPage";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("../api/client", async () => {
  const actual =
    await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiFetch: api.fetch };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { id: "employee-1", role: "EMPLOYEE" } }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ArticlesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ArticlesPage", () => {
  beforeEach(() => {
    api.fetch.mockReset().mockResolvedValue([]);
  });

  it("so aplica o texto da pesquisa quando o formulario e enviado", async () => {
    renderPage();
    await waitFor(() => expect(api.fetch).toHaveBeenCalledOnce());

    await userEvent.type(
      screen.getByRole("searchbox", { name: "Pesquisar artigos" }),
      "  vpn  ",
    );
    expect(api.fetch).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(api.fetch).toHaveBeenCalledTimes(2));
    expect(api.fetch).toHaveBeenLastCalledWith("/api/v1/articles?q=vpn");
  });
});
