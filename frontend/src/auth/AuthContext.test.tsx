import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveAuthSession } from "../api/client";
import { AuthProvider, useAuth } from "./AuthContext";

const currentUser = {
  id: "8ef2e5c5-7ce7-41ba-9e64-dde4f7fcd33a",
  name: "Thiago Almeida",
  email: "thiago@example.test",
  role: "EMPLOYEE" as const,
  account_locked: true,
};

function Consumer() {
  const { user, isLoading, sessionMessage, logout } = useAuth();
  if (isLoading) return <div>Carregando</div>;
  return (
    <div>
      <span>{user?.name ?? "Sem usuario"}</span>
      {sessionMessage && <span>{sessionMessage}</span>}
      <button onClick={logout}>Sair</button>
    </div>
  );
}

function renderProvider(queryClient = new QueryClient()) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("remove credenciais e cache ao sair", async () => {
    saveAuthSession("valid-token", 300);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(currentUser), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(["user", currentUser.id, "private"], "secret");
    renderProvider(queryClient);

    expect(await screen.findByText("Thiago Almeida")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(screen.getByText("Sem usuario")).toBeInTheDocument();
    expect(sessionStorage.getItem("access_token")).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("informa quando a sessao armazenada expirou", async () => {
    sessionStorage.setItem("access_token", "expired-token");
    sessionStorage.setItem("access_token_expires_at", String(Date.now() - 1));
    renderProvider();

    await waitFor(() =>
      expect(screen.getByText("Sem usuario")).toBeInTheDocument(),
    );
    expect(
      screen.getByText("Sua sessao expirou. Entre novamente para continuar."),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("access_token")).toBeNull();
  });
});
