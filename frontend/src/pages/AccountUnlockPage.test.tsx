import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/client";
import AccountUnlockPage from "./AccountUnlockPage";

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
const auth = vi.hoisted(() => ({
  user: {
    id: "employee-1",
    name: "Thiago",
    email: "thiago@example.test",
    role: "EMPLOYEE" as const,
    account_locked: true,
  },
  updateUser: vi.fn(),
  refreshUser: vi.fn(),
}));

vi.mock("../api/client", async () => {
  const actual =
    await vi.importActual<typeof import("../api/client")>("../api/client");
  return { ...actual, apiFetch: api.fetch };
});

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => auth,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AccountUnlockPage />
      </QueryClientProvider>,
    ),
  };
}

function activeChallenge() {
  return {
    challenge_id: "69968f17-79ab-4a90-a702-6f423f063d5e",
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    demo_code: "123456",
  };
}

describe("AccountUnlockPage", () => {
  beforeEach(() => {
    api.fetch.mockReset();
    auth.updateUser.mockReset();
    auth.refreshUser.mockReset();
    auth.user.account_locked = true;
  });

  it("atualiza usuario e dashboard depois da verificacao", async () => {
    const unlockedUser = { ...auth.user, account_locked: false };
    const challenge = activeChallenge();
    api.fetch
      .mockResolvedValueOnce(challenge)
      .mockResolvedValueOnce(unlockedUser);
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    await userEvent.click(
      screen.getByRole("button", { name: "Solicitar codigo de verificacao" }),
    );
    const code = await screen.findByRole("textbox", {
      name: "Codigo de verificacao",
    });
    await userEvent.type(code, "12a3456");
    expect(code).toHaveValue("123456");
    await userEvent.click(
      screen.getByRole("button", { name: "Verificar codigo" }),
    );

    expect(
      await screen.findByText("Conta desbloqueada com sucesso."),
    ).toBeInTheDocument();
    expect(auth.updateUser).toHaveBeenCalledWith(unlockedUser);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["user", "employee-1", "dashboard-summary"],
    });
    expect(api.fetch).toHaveBeenLastCalledWith(
      "/api/v1/account-unlocks/verify",
      expect.objectContaining({
        body: JSON.stringify({
          challenge_id: challenge.challenge_id,
          code: "123456",
        }),
      }),
    );
  });

  it("mantem o desafio apos codigo invalido e o remove ao atingir o limite", async () => {
    api.fetch
      .mockResolvedValueOnce(activeChallenge())
      .mockRejectedValueOnce(
        new ApiError(422, "Codigo invalido. Restam 1 tentativas"),
      )
      .mockRejectedValueOnce(
        new ApiError(429, "Limite de tentativas excedido"),
      );
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Solicitar codigo de verificacao" }),
    );
    let code = await screen.findByRole("textbox", {
      name: "Codigo de verificacao",
    });
    await userEvent.type(code, "000000");
    await userEvent.click(
      screen.getByRole("button", { name: "Verificar codigo" }),
    );
    expect(await screen.findByText(/Restam 1 tentativas/)).toBeInTheDocument();
    code = screen.getByRole("textbox", { name: "Codigo de verificacao" });
    expect(code).toHaveValue("");

    await userEvent.type(code, "000000");
    await userEvent.click(
      screen.getByRole("button", { name: "Verificar codigo" }),
    );
    expect(
      await screen.findByText("Limite de tentativas excedido"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Solicitar codigo de verificacao" }),
    ).toBeInTheDocument();
  });

  it("oferece novo codigo quando o desafio ja chegou expirado", async () => {
    api.fetch.mockResolvedValue({
      ...activeChallenge(),
      expires_at: "2020-01-01T00:00:00Z",
    });
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Solicitar codigo de verificacao" }),
    );

    expect(await screen.findByText(/Este codigo expirou/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Solicitar novo codigo" }),
    ).toBeEnabled();
  });
});
