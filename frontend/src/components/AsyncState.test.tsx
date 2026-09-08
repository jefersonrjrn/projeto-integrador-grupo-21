import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./AsyncState";

it("anuncia carregamento", () => {
  render(<LoadingState label="Carregando chamados" />);
  expect(screen.getByRole("status")).toHaveTextContent("Carregando chamados");
});

it("oferece nova tentativa por teclado", async () => {
  const retry = vi.fn();
  const user = userEvent.setup();
  render(<ErrorState message="Servico indisponivel" onRetry={retry} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Servico indisponivel");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(retry).toHaveBeenCalledOnce();
});

it("mostra proxima acao na lista vazia", () => {
  render(
    <EmptyState
      message="Nenhum chamado"
      action={<a href="/chamados/novo">Abrir chamado</a>}
    />,
  );
  expect(screen.getByText("Nenhum chamado")).toBeVisible();
  expect(screen.getByRole("link", { name: "Abrir chamado" })).toHaveAttribute(
    "href",
    "/chamados/novo",
  );
});
