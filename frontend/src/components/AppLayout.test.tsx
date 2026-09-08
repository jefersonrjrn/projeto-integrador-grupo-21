import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AppLayout from "./AppLayout";

const auth = vi.hoisted(() => ({
  user: { name: "Usuario demo", role: "EMPLOYEE" },
  logout: vi.fn(),
}));
vi.mock("../auth/AuthContext", () => ({ useAuth: () => auth }));

describe("navegacao do layout", () => {
  it("mostra caminhos de colaborador e aviso demonstrativo", () => {
    auth.user.role = "EMPLOYEE";
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Meus chamados" })).toHaveAttribute(
      "href",
      "/meus-chamados",
    );
    expect(
      screen.queryByRole("link", { name: "Fila de chamados" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Ambiente de demonstracao/)).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("mostra fila para tecnico", () => {
    auth.user.role = "TECHNICIAN";
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Fila de chamados" }),
    ).toHaveAttribute("href", "/tecnico/chamados");
    expect(
      screen.queryByRole("link", { name: "Abrir chamado" }),
    ).not.toBeInTheDocument();
  });
});
